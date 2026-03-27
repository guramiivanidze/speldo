'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCasualLeaderboard, getPointsLeaderboard } from '@/lib/api';
import { placementPointsHint } from '@/lib/scoring';

type LeaderboardMode = 'casual' | 'points';
type PlayerCountTab = 2 | 3 | 4;
type PointsFilterTab = 2 | 3 | 4 | 'all';

interface CasualEntry {
  rank: number;
  username: string;
  games: number;
  pos_1: number;
  pos_2?: number;
  pos_3?: number;
  pos_4?: number;
}

interface PointsEntry {
  rank: number;
  username: string;
  points: number;
  games: number;
  wins: number;
  win_rate: number;
}

const PLAYER_COUNT_TABS: PlayerCountTab[] = [2, 3, 4];
const POINTS_FILTER_TABS: { value: PointsFilterTab; label: string }[] = [
  { value: 'all', label: 'All Games' },
  { value: 2,     label: '2-Player' },
  { value: 3,     label: '3-Player' },
  { value: 4,     label: '4-Player' },
];

export default function LeaderboardPage() {
  const router = useRouter();

  const [mode, setMode] = useState<LeaderboardMode>('points');
  const [playerCountTab, setPlayerCountTab] = useState<PlayerCountTab>(2);
  const [pointsFilterTab, setPointsFilterTab] = useState<PointsFilterTab>('all');
  const [casualEntries, setCasualEntries] = useState<CasualEntry[]>([]);
  const [pointsEntries, setPointsEntries] = useState<PointsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (mode === 'casual') {
          const data = await getCasualLeaderboard(playerCountTab).catch(() => ({ entries: [], total: 0 }));
          setCasualEntries(data.entries || []);
        } else {
          const filter = pointsFilterTab === 'all' ? undefined : pointsFilterTab;
          const data = await getPointsLeaderboard(filter).catch(() => ({ entries: [], total: 0 }));
          setPointsEntries(data.entries || []);
        }
      } catch (e) {
        console.error('Failed to load leaderboard:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mode, playerCountTab, pointsFilterTab]);

  const rankIcon = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

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
        <h1 className="text-3xl font-bold text-slate-100">Leaderboard</h1>
      </div>

      {/* Mode switcher */}
      <div className="glass rounded-xl p-1 mb-6 border border-white/10">
        <div className="flex gap-1">
          {(
            [
              { value: 'points', label: '⭐ Points' },
              { value: 'casual', label: '🃏 Placement' },
            ] as { value: LeaderboardMode; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={`
                flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${mode === value
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Points filter tabs */}
      {mode === 'points' && (
        <div className="glass rounded-xl p-1 mb-6 border border-white/10">
          <div className="flex gap-1">
            {POINTS_FILTER_TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPointsFilterTab(value)}
                className={`
                  flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${pointsFilterTab === value
                    ? 'bg-violet-700 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Casual player-count tabs */}
      {mode === 'casual' && (
        <div className="glass rounded-xl p-1 mb-6 border border-white/10">
          <div className="flex gap-1">
            {PLAYER_COUNT_TABS.map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCountTab(count)}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${playerCountTab === count
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }
                `}
              >
                {count}-Player
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>

        ) : mode === 'points' ? (
          /* ── Points leaderboard ── */
          pointsEntries.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No games played yet.</div>
          ) : (
            <>
              {/* Points table hint */}
              <div className="px-6 py-3 bg-violet-900/20 border-b border-violet-500/20 text-xs text-violet-300">
                Points: {placementPointsHint()}
              </div>

              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-slate-800/50 border-b border-white/5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2 text-center">Points</div>
                <div className="col-span-2 text-center">Games</div>
                <div className="col-span-1 text-center">Wins</div>
                <div className="col-span-2 text-center">Win %</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/5">
                {pointsEntries.map((entry) => {
                  const icon = rankIcon(entry.rank);
                  return (
                    <div
                      key={entry.username}
                      className={`
                        grid grid-cols-12 gap-2 px-6 py-4 items-center transition-colors hover:bg-slate-800/30
                        ${entry.rank <= 3 ? 'bg-gradient-to-r from-violet-900/15 to-transparent' : ''}
                      `}
                    >
                      <div className="col-span-1">
                        {icon
                          ? <span className="text-2xl">{icon}</span>
                          : <span className="text-lg font-bold text-slate-400">#{entry.rank}</span>
                        }
                      </div>
                      <div className="col-span-4">
                        <button
                          onClick={() => router.push(`/profile/${entry.username}`)}
                          className="font-medium text-slate-100 hover:text-violet-400 transition-colors truncate"
                        >
                          {entry.username}
                        </button>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-lg font-bold text-violet-300">{entry.points}</span>
                      </div>
                      <div className="col-span-2 text-center text-slate-300">{entry.games}</div>
                      <div className="col-span-1 text-center text-emerald-400 font-medium">{entry.wins}</div>
                      <div className="col-span-2 text-center text-slate-300">{entry.win_rate}%</div>
                    </div>
                  );
                })}
              </div>
            </>
          )

        ) : mode === 'casual' ? (
          /* ── Casual / Placement leaderboard ── */
          casualEntries.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No {playerCountTab}-player casual games played yet.
            </div>
          ) : (
            <>
              <div className={`grid gap-2 px-6 py-3 bg-slate-800/50 border-b border-white/5 text-xs font-medium text-slate-400 uppercase tracking-wider ${
                playerCountTab === 2 ? 'grid-cols-8' : playerCountTab === 3 ? 'grid-cols-9' : 'grid-cols-10'
              }`}>
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Player</div>
                <div className="col-span-2 text-center">Games</div>
                <div className="col-span-1 text-center" title="1st Place">🥇</div>
                <div className="col-span-1 text-center" title="2nd Place">🥈</div>
                {playerCountTab >= 3 && <div className="col-span-1 text-center" title="3rd Place">🥉</div>}
                {playerCountTab >= 4 && <div className="col-span-1 text-center" title="4th Place">4th</div>}
              </div>

              <div className="divide-y divide-white/5">
                {casualEntries.map((entry) => {
                  const icon = rankIcon(entry.rank);
                  return (
                    <div
                      key={entry.username}
                      className={`
                        grid gap-2 px-6 py-4 items-center transition-colors hover:bg-slate-800/30
                        ${entry.rank <= 3 ? 'bg-gradient-to-r from-emerald-900/10 to-transparent' : ''}
                        ${playerCountTab === 2 ? 'grid-cols-8' : playerCountTab === 3 ? 'grid-cols-9' : 'grid-cols-10'}
                      `}
                    >
                      <div className="col-span-1">
                        {icon
                          ? <span className="text-2xl">{icon}</span>
                          : <span className="text-lg font-bold text-slate-400">#{entry.rank}</span>
                        }
                      </div>
                      <div className="col-span-3">
                        <button
                          onClick={() => router.push(`/profile/${entry.username}`)}
                          className="font-medium text-slate-100 hover:text-emerald-400 transition-colors truncate"
                        >
                          {entry.username}
                        </button>
                      </div>
                      <div className="col-span-2 text-center text-slate-300 font-medium">{entry.games}</div>
                      <div className="col-span-1 text-center text-amber-400 font-bold">{entry.pos_1}</div>
                      <div className="col-span-1 text-center text-slate-300 font-medium">{entry.pos_2 ?? 0}</div>
                      {playerCountTab >= 3 && (
                        <div className="col-span-1 text-center text-amber-700 font-medium">{entry.pos_3 ?? 0}</div>
                      )}
                      {playerCountTab >= 4 && (
                        <div className="col-span-1 text-center text-slate-500 font-medium">{entry.pos_4 ?? 0}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )

        ) : null}
      </div>
    </div>
  );
}
