'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLeaderboard, getLeaderboardByDivision, getCurrentSeason, getCasualLeaderboard } from '@/lib/api';
import { LeaderboardEntry, Season, Division, DIVISION_CONFIG } from '@/types/competitive';
import DivisionBadge from '@/components/DivisionBadge';

type LeaderboardMode = 'ranked' | 'casual';
type Tab = 'global' | Division;

interface CasualEntry {
  rank: number;
  username: string;
  games: number;
  wins: number;
  losses: number;
}

const DIVISION_TABS: Division[] = ['Grandmaster', 'Master', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

export default function LeaderboardPage() {
  const router = useRouter();
  
  const [mode, setMode] = useState<LeaderboardMode | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [casualEntries, setCasualEntries] = useState<CasualEntry[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [seasonChecked, setSeasonChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  // Check season on initial load
  useEffect(() => {
    async function checkSeason() {
      const seasonData = await getCurrentSeason().catch(() => null);
      setSeason(seasonData);
      setSeasonChecked(true);
      // Always use casual mode (ranked leaderboard hidden)
      setMode('casual');
    }
    checkSeason();
  }, []);

  useEffect(() => {
    if (!mode) return; // Wait until mode is set
    
    async function loadData() {
      setLoading(true);
      try {
        if (mode === 'casual') {
          const data = await getCasualLeaderboard().catch(() => ({ entries: [], total: 0 }));
          setCasualEntries(data.entries || []);
          setTotal(data.total || 0);
        } else {
          const leaderboardData = await (activeTab === 'global' 
            ? getLeaderboard(page, perPage).catch(() => ({ entries: [], total: 0 }))
            : getLeaderboardByDivision(activeTab).catch(() => ({ entries: [], total: 0 })));
          
          setEntries(leaderboardData.entries || []);
          setTotal(leaderboardData.total || leaderboardData.entries?.length || 0);
        }
      } catch (e) {
        console.error('Failed to load leaderboard:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mode, activeTab, page]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => router.push('/')}
          className="text-slate-400 hover:text-slate-200 text-sm mb-4 inline-block"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              {mode === 'casual' ? 'Top 50 Casual Players' : 'Leaderboard'}
            </h1>
            {season && mode === 'ranked' && (
              <p className="text-sm text-slate-400 mt-1">{season.name}</p>
            )}
          </div>
          {mode === 'ranked' && (
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-400">{total}</div>
              <div className="text-xs text-slate-400">Total Players</div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher - Hidden (ranked leaderboard disabled) */}

      {/* Division Tabs (Ranked only) */}
      {mode === 'ranked' && (
        <div className="glass rounded-xl p-1 mb-6 border border-white/10 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {/* Global tab */}
            <button
              onClick={() => { setActiveTab('global'); setPage(1); }}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === 'global' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }
              `}
            >
              🌍 Global
            </button>
            
            {/* Division tabs */}
            {DIVISION_TABS.map((div) => (
              <button
                key={div}
                onClick={() => { setActiveTab(div); setPage(1); }}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${activeTab === div 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }
                `}
                style={activeTab === div ? { backgroundColor: DIVISION_CONFIG[div].color + '80' } : {}}
              >
                {DIVISION_CONFIG[div].icon} {div}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : mode === 'casual' ? (
          /* Casual Leaderboard */
          casualEntries.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No casual games played yet.
            </div>
          ) : (
            <>
              {/* Casual Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-800/50 border-b border-white/5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-5">Player</div>
                <div className="col-span-2 text-center">Games</div>
                <div className="col-span-2 text-center">Wins</div>
                <div className="col-span-2 text-center">Losses</div>
              </div>

              {/* Casual Table Body */}
              <div className="divide-y divide-white/5">
                {casualEntries.map((entry) => {
                  const isTop3 = entry.rank <= 3;
                  return (
                    <div 
                      key={entry.username}
                      className={`
                        grid grid-cols-12 gap-4 px-6 py-4 items-center
                        transition-colors hover:bg-slate-800/30
                        ${isTop3 ? 'bg-gradient-to-r from-emerald-900/10 to-transparent' : ''}
                      `}
                    >
                      {/* Rank */}
                      <div className="col-span-1">
                        {isTop3 ? (
                          <span className="text-2xl">
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span className="text-lg font-bold text-slate-400">#{entry.rank}</span>
                        )}
                      </div>

                      {/* Player */}
                      <div className="col-span-5">
                        <button
                          onClick={() => router.push(`/profile/${entry.username}`)}
                          className="font-medium text-slate-100 hover:text-emerald-400 transition-colors"
                        >
                          {entry.username}
                        </button>
                      </div>

                      {/* Games */}
                      <div className="col-span-2 text-center text-slate-300 font-medium">
                        {entry.games}
                      </div>

                      {/* Wins */}
                      <div className="col-span-2 text-center text-emerald-400 font-medium">
                        {entry.wins}
                      </div>

                      {/* Losses */}
                      <div className="col-span-2 text-center text-red-400 font-medium">
                        {entry.losses}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            No players found in this division yet.
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-800/50 border-b border-white/5 text-xs font-medium text-slate-400 uppercase tracking-wider">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Player</div>
              <div className="col-span-2 text-center">Division</div>
              <div className="col-span-2 text-center">Rating</div>
              <div className="col-span-1 text-center">W</div>
              <div className="col-span-1 text-center">L</div>
              <div className="col-span-1 text-center">%</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-white/5">
              {entries.map((entry, index) => {
                const isTop3 = entry.rank <= 3;
                const config = DIVISION_CONFIG[entry.division];
                const winRate = entry.games_played > 0 
                  ? Math.round((entry.wins / entry.games_played) * 100) 
                  : 0;

                return (
                  <div 
                    key={entry.player_id}
                    className={`
                      grid grid-cols-12 gap-4 px-6 py-4 items-center
                      transition-colors hover:bg-slate-800/30
                      ${isTop3 ? 'bg-gradient-to-r from-yellow-900/10 to-transparent' : ''}
                    `}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {isTop3 ? (
                        <span className="text-2xl">
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-slate-400">#{entry.rank}</span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="col-span-4">
                      <button
                        onClick={() => router.push(`/profile/${entry.username}`)}
                        className="font-medium text-slate-100 hover:text-indigo-400 transition-colors"
                      >
                        {entry.username}
                      </button>
                    </div>

                    {/* Division */}
                    <div className="col-span-2 flex justify-center">
                      <DivisionBadge division={entry.division} size="sm" />
                    </div>

                    {/* Rating */}
                    <div className="col-span-2 text-center">
                      <span 
                        className="text-lg font-bold"
                        style={{ color: config.color }}
                      >
                        {entry.rating}
                      </span>
                    </div>

                    {/* Wins */}
                    <div className="col-span-1 text-center text-green-400 font-medium">
                      {entry.wins}
                    </div>

                    {/* Losses */}
                    <div className="col-span-1 text-center text-red-400 font-medium">
                      {entry.losses}
                    </div>

                    {/* Win Rate */}
                    <div className="col-span-1 text-center text-slate-300">
                      {winRate}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {activeTab === 'global' && totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 px-6 py-4 border-t border-white/5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded bg-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
