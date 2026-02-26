'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPlayerProfile, getMatchHistory } from '@/lib/api';
import { PlayerProfile, Match, DIVISION_CONFIG } from '@/types/competitive';
import DivisionBadge from '@/components/DivisionBadge';
import RatingDisplay from '@/components/RatingDisplay';

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const profileData = await getPlayerProfile(username);
        setProfile(profileData);
      } catch (e) {
        setError('Player not found');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    if (username) {
      loadData();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <div className="text-xl text-slate-400">{error || 'Profile not found'}</div>
        <button 
          onClick={() => router.push('/leaderboard')}
          className="mt-4 text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Leaderboard
        </button>
      </div>
    );
  }

  const config = DIVISION_CONFIG[profile.division];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => router.back()}
          className="text-slate-400 hover:text-slate-200 text-sm mb-4 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-slate-100">{profile.username}</h1>
      </div>

      {/* Main Profile Card */}
      <div className="glass rounded-2xl p-8 border border-white/10">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar & Division */}
          <div className="flex flex-col items-center">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-4"
              style={{ 
                backgroundColor: config.bgColor,
                border: `3px solid ${config.color}`,
              }}
            >
              {config.icon}
            </div>
            <DivisionBadge division={profile.division} size="lg" />
          </div>

          {/* Rating */}
          <div className="flex-1 text-center md:text-left">
            <RatingDisplay 
              rating={profile.rating}
              division={profile.division}
              showProgress={false}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{profile.ranked_games_played}</div>
              <div className="text-xs text-slate-400">Games</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{profile.win_rate}%</div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{profile.ranked_wins}</div>
              <div className="text-xs text-slate-400">Wins</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{profile.ranked_losses}</div>
              <div className="text-xs text-slate-400">Losses</div>
            </div>
          </div>
        </div>

        {/* Peak Rating */}
        <div className="mt-6 pt-6 border-t border-white/10 flex justify-center">
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-1">Peak Rating</div>
            <div className="text-2xl font-bold text-yellow-400">{profile.peak_rating}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
