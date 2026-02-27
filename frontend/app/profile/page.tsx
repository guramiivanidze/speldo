'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMyProfile, getMatchHistory } from '@/lib/api';
import { PlayerProfile, Match, DIVISION_CONFIG, DIVISION_THRESHOLDS, Division } from '@/types/competitive';
import DivisionBadge from '@/components/DivisionBadge';
import RatingDisplay from '@/components/RatingDisplay';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    async function loadData() {
      try {
        const [profileData, matchesData] = await Promise.all([
          getMyProfile(),
          getMatchHistory(1, 10),
        ]);
        setProfile(profileData);
        setMatches(matchesData.matches || []);
      } catch (e) {
        setError('Failed to load profile');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400">{error || 'Profile not found'}</div>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  const config = DIVISION_CONFIG[profile.division];

  // Generate rating history data points for simple graph
  const generateGraphPoints = () => {
    // Simulate rating history from matches
    const points = [];
    let currentRating = profile.rating;
    
    // Work backwards through matches to estimate past ratings
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      // Support both multiplayer (players array) and legacy (player1/player2)
      const myData = match.players?.find(p => p.username === profile.username) 
        || (match.player1?.username === profile.username ? { rating_change: match.rating_change_p1 } : { rating_change: match.rating_change_p2 });
      const change = myData?.rating_change || 0;
      points.unshift(currentRating);
      currentRating -= change;
    }
    points.unshift(currentRating);
    
    return points;
  };

  const ratingHistory = generateGraphPoints();
  const minRating = Math.min(...ratingHistory) - 50;
  const maxRating = Math.max(...ratingHistory) + 50;
  const ratingRange = maxRating - minRating;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button 
          onClick={() => router.push('/')}
          className="text-slate-400 hover:text-slate-200 text-sm mb-4 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-slate-100">Ranked Profile</h1>
      </div>

      {/* Main Profile Card */}
      <div className="glass rounded-2xl p-8 border border-white/10 mb-8">
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

          {/* Stats */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{profile.username}</h2>
            
            <RatingDisplay 
              rating={profile.rating}
              division={profile.division}
              pointsToNext={profile.points_to_next_division}
              nextDivision={profile.next_division}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{profile.ranked_wins}</div>
              <div className="text-xs text-slate-400">Wins</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{profile.ranked_losses}</div>
              <div className="text-xs text-slate-400">Losses</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{profile.win_rate}%</div>
              <div className="text-xs text-slate-400">Win Rate</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{profile.peak_rating}</div>
              <div className="text-xs text-slate-400">Peak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Graph */}
      {ratingHistory.length > 1 && (
        <div className="glass rounded-2xl p-6 border border-white/10 mb-8">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Rating History</h3>
          <div className="relative h-40">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-slate-500">
              <span>{maxRating}</span>
              <span>{Math.round((maxRating + minRating) / 2)}</span>
              <span>{minRating}</span>
            </div>
            
            {/* Graph area */}
            <div className="ml-14 h-full relative">
              <svg className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#334155" strokeDasharray="4" />
                
                {/* Rating line */}
                <polyline
                  fill="none"
                  stroke={config.color}
                  strokeWidth="2"
                  points={ratingHistory.map((rating, i) => {
                    const x = (i / (ratingHistory.length - 1)) * 100;
                    const y = 100 - ((rating - minRating) / ratingRange) * 100;
                    return `${x}%,${y}%`;
                  }).join(' ')}
                />
                
                {/* Points */}
                {ratingHistory.map((rating, i) => {
                  const x = (i / (ratingHistory.length - 1)) * 100;
                  const y = 100 - ((rating - minRating) / ratingRange) * 100;
                  return (
                    <circle
                      key={i}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="4"
                      fill={config.color}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Match History */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Matches</h3>
        
        {matches.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No ranked matches yet. Start playing to see your history!
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              // Support both multiplayer (players array) and legacy (player1/player2)
              const myData = match.players?.find(p => p.username === profile.username);
              const opponents = match.players?.filter(p => p.username !== profile.username) || [];
              
              // Fallback to legacy fields
              const isPlayer1 = match.player1?.username === profile.username;
              const legacyOpponent = isPlayer1 ? match.player2 : match.player1;
              const ratingChange = myData?.rating_change 
                || (isPlayer1 ? match.rating_change_p1 : match.rating_change_p2) 
                || 0;
              
              // Determine win: placement 1 is a win for multiplayer, or positive rating change
              const won = myData ? myData.placement === 1 : ratingChange > 0;
              
              // Get display opponent(s)
              const displayOpponents = opponents.length > 0 ? opponents : (legacyOpponent ? [legacyOpponent] : []);
              
              return (
                <div 
                  key={match.id}
                  className={`
                    flex items-center justify-between p-4 rounded-xl
                    ${won ? 'bg-green-900/20 border border-green-500/20' : 'bg-red-900/20 border border-red-500/20'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl ${won ? 'text-green-400' : 'text-red-400'}`}>
                      {won ? '🏆' : '💔'}
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">
                        vs {displayOpponents.map(o => o.username).join(', ') || 'Unknown'}
                        {match.player_count && match.player_count > 2 && (
                          <span className="ml-2 text-xs text-slate-500">({match.player_count}p)</span>
                        )}
                      </div>
                      {displayOpponents[0] && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <DivisionBadge 
                            division={'division' in displayOpponents[0] 
                              ? displayOpponents[0].division 
                              : (displayOpponents[0] as { division_before?: Division }).division_before ?? 'Bronze'} 
                            size="sm" 
                            showLabel={false} 
                          />
                          <span>
                            {'rating' in displayOpponents[0] 
                              ? displayOpponents[0].rating 
                              : (displayOpponents[0] as { rating_before?: number }).rating_before ?? 1000}
                          </span>
                          {displayOpponents.length > 1 && <span>+{displayOpponents.length - 1} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${ratingChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ratingChange >= 0 ? '+' : ''}{ratingChange}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(match.finished_at || match.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {matches.length >= 10 && (
          <div className="text-center mt-4">
            <button className="text-sm text-indigo-400 hover:text-indigo-300">
              View all matches →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
