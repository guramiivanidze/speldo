'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentSeason, getMyProfile, createGame } from '@/lib/api';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { Season, PlayerProfile, DIVISION_CONFIG } from '@/types/competitive';
import DivisionBadge from './DivisionBadge';
import RatingDisplay from './RatingDisplay';

interface GameModeSelectionProps {
  onCasualClick?: () => void;
}

export default function GameModeSelection({ onCasualClick }: GameModeSelectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [season, setSeason] = useState<Season | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [casualLoading, setCasualLoading] = useState(false);
  
  const { 
    status, 
    matchFound, 
    error, 
    connected, 
    joinQueue, 
    leaveQueue 
  } = useMatchmaking();

  // Load season and profile
  useEffect(() => {
    async function loadData() {
      try {
        const [seasonData, profileData] = await Promise.all([
          getCurrentSeason().catch(() => null),
          getMyProfile().catch(() => null),
        ]);
        setSeason(seasonData);
        setProfile(profileData);
      } catch (e) {
        console.error('Failed to load competitive data:', e);
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      loadData();
    }
  }, [user]);

  // Redirect when match found
  useEffect(() => {
    if (matchFound) {
      router.push(`/game/${matchFound.game_code}`);
    }
  }, [matchFound, router]);

  // Calculate season countdown
  const getSeasonCountdown = () => {
    if (!season) return null;
    const end = new Date(season.end_date);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Season ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const handleCasualClick = async () => {
    if (onCasualClick) {
      onCasualClick();
    } else {
      // Default: create a casual game
      setCasualLoading(true);
      try {
        const game = await createGame(2);
        router.push(`/game/${game.code}`);
      } catch (e) {
        console.error('Failed to create game:', e);
      } finally {
        setCasualLoading(false);
      }
    }
  };

  const handleRankedClick = () => {
    if (status?.in_queue) {
      leaveQueue();
    } else {
      joinQueue();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Player Rating Card */}
      {profile && (
        <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ backgroundColor: DIVISION_CONFIG[profile.division].bgColor }}
              >
                {DIVISION_CONFIG[profile.division].icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{profile.username}</h3>
                <DivisionBadge division={profile.division} size="sm" />
              </div>
            </div>
            <RatingDisplay 
              rating={profile.rating}
              division={profile.division}
              pointsToNext={profile.points_to_next_division}
              nextDivision={profile.next_division}
              size="sm"
              showProgress={false}
            />
          </div>
          
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-100">{profile.ranked_games_played}</div>
              <div className="text-xs text-slate-400">Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{profile.win_rate}%</div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-100">{profile.peak_rating}</div>
              <div className="text-xs text-slate-400">Peak Rating</div>
            </div>
          </div>
        </div>
      )}

      {/* Season Info */}
      {season && (
        <div className="text-center mb-6">
          <div className="text-sm text-slate-400">{season.name}</div>
          <div className="text-xs text-indigo-400">{getSeasonCountdown()}</div>
        </div>
      )}

      {/* Game Mode Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Casual Match */}
        <button
          onClick={handleCasualClick}
          disabled={casualLoading || status?.in_queue}
          className="
            group relative overflow-hidden
            bg-slate-800 hover:bg-slate-700
            border border-slate-700 hover:border-slate-600
            rounded-2xl p-6 transition-all duration-300
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-xl font-bold text-slate-100 mb-2">Casual Match</h3>
          <p className="text-sm text-slate-400">
            Play for fun. No ranking or rating changes.
          </p>
          {casualLoading && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
            </div>
          )}
        </button>

        {/* Ranked Match */}
        <button
          onClick={handleRankedClick}
          disabled={!season || !connected}
          className={`
            group relative overflow-hidden
            rounded-2xl p-6 transition-all duration-300
            border
            ${status?.in_queue 
              ? 'bg-red-900/30 border-red-500/50 hover:bg-red-900/40' 
              : 'bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30 hover:border-indigo-400/50'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {/* Animated background for searching */}
          {status?.in_queue && (
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />
            </div>
          )}
          
          <div className="relative">
            <div className="text-4xl mb-3">⚔️</div>
            <h3 className="text-xl font-bold text-slate-100 mb-2 flex items-center justify-center gap-2">
              Ranked Match
              <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                COMPETITIVE
              </span>
            </h3>
            
            {status?.in_queue ? (
              <div className="text-sm text-slate-300">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Searching for opponent...
                </div>
                <div className="text-xs text-slate-400">
                  {status.wait_time_seconds !== undefined && (
                    <span>{Math.floor(status.wait_time_seconds)}s • </span>
                  )}
                  {status.search_range !== undefined && (
                    <span>±{status.search_range} rating</span>
                  )}
                </div>
                <div className="text-xs text-red-300 mt-2">Click to cancel</div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Compete for rating and climb the ranks!
              </p>
            )}
          </div>

          {/* Not connected warning */}
          {!connected && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-2xl">
              <div className="text-sm text-slate-400">Connecting...</div>
            </div>
          )}

          {/* No season warning */}
          {!season && connected && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-2xl">
              <div className="text-sm text-slate-400">No active season</div>
            </div>
          )}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-sm text-red-300 text-center">
          {error}
        </div>
      )}

      {/* Quick links */}
      <div className="flex justify-center gap-6 mt-8">
        <button
          onClick={() => router.push('/leaderboard')}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          📊 Leaderboard
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          👤 My Profile
        </button>
      </div>
    </div>
  );
}
