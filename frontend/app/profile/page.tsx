'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyProfile, getMatchHistory, getUserGameHistory, getCasualStats,
  sendFriendRequest, getPendingFriendRequests, respondToFriendRequest,
  getFriendsList, removeFriend,
  sendEmailChangeCode, changeEmail, changePassword,
  FriendRequest, Friend, CasualStats
} from '@/lib/api';
import { PlayerProfile, Match, DIVISION_CONFIG, DIVISION_THRESHOLDS, Division } from '@/types/competitive';
import DivisionBadge from '@/components/DivisionBadge';

interface GameHistoryItem {
  id: string;
  code: string;
  finished_at: string;
  player_count: number;
  players: {
    username: string;
    placement: number;
    prestige_points: number;
    total_cards: number;
    is_winner: boolean;
    is_me: boolean;
  }[];
  my_placement: number;
  my_points: number;
  won: boolean;
}

function ProfileContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state - read initial value from URL params
  const getInitialTab = (): 'stats' | 'games' | 'friends' | 'settings' => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'games' || tabParam === 'history') return 'games';
    if (tabParam === 'friends') return 'friends';
    if (tabParam === 'settings') return 'settings';
    return 'stats';
  };
  const [activeTab, setActiveTab] = useState<'stats' | 'games' | 'friends' | 'settings'>(getInitialTab);

  // Game history state
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [gameHistoryLoading, setGameHistoryLoading] = useState(false);
  const [gameHistoryLoaded, setGameHistoryLoaded] = useState(false);
  const [casualStats, setCasualStats] = useState<CasualStats | null>(null);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendNickname, setFriendNickname] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsLoaded, setFriendsLoaded] = useState(false);

  // Settings state
  const [newEmail, setNewEmail] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Sync tab with URL params on navigation
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'games' || tabParam === 'history') setActiveTab('games');
    else if (tabParam === 'friends') setActiveTab('friends');
    else if (tabParam === 'settings') setActiveTab('settings');
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    async function loadData() {
      try {
        const [profileData, matchesData, casualStatsData] = await Promise.all([
          getMyProfile(),
          getMatchHistory(1, 10),
          getCasualStats(),
        ]);
        setProfile(profileData);
        setMatches(matchesData.matches || []);
        setCasualStats(casualStatsData);
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

  // Load game history when games tab is selected
  useEffect(() => {
    if (activeTab === 'games' && !gameHistoryLoaded && !gameHistoryLoading) {
      setGameHistoryLoading(true);
      getUserGameHistory(1, 20)
        .then(data => setGameHistory(data.games || []))
        .catch(console.error)
        .finally(() => {
          setGameHistoryLoading(false);
          setGameHistoryLoaded(true);
        });
    }
  }, [activeTab, gameHistoryLoaded, gameHistoryLoading]);

  // Load friends when friends tab is selected
  useEffect(() => {
    if (activeTab === 'friends' && !friendsLoaded && !friendsLoading) {
      loadFriends();
    }
  }, [activeTab, friendsLoaded, friendsLoading]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getFriendsList(),
        getPendingFriendRequests()
      ]);
      setFriends(friendsData.friends || []);
      setFriendRequests(requestsData.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setFriendsLoading(false);
      setFriendsLoaded(true);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!friendNickname.trim()) return;
    setFriendError('');
    setFriendSuccess('');
    try {
      const data = await sendFriendRequest(friendNickname.trim());
      setFriendSuccess(data.message);
      setFriendNickname('');
      if (data.status === 'accepted') {
        loadFriends();
      }
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : 'Failed to send request');
    }
  };

  const handleRespondToRequest = async (requestId: number, action: 'accept' | 'reject') => {
    try {
      await respondToFriendRequest(requestId, action);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accept') {
        loadFriends();
      }
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : 'Failed to respond');
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    try {
      await removeFriend(friendId);
      setFriends(prev => prev.filter(f => f.id !== friendId));
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : 'Failed to remove friend');
    }
  };

  const handleSendEmailCode = async () => {
    if (!newEmail.trim()) return;
    setEmailError('');
    setEmailSuccess('');
    setEmailSending(true);
    try {
      const data = await sendEmailChangeCode(newEmail.trim());
      setEmailVerificationToken(data.verification_token);
      setEmailCodeSent(true);
      setEmailSuccess('Verification code sent to your new email.');
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setEmailSending(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!emailVerificationCode.trim()) return;
    setEmailError('');
    setEmailSuccess('');
    try {
      await changeEmail(newEmail.trim(), emailVerificationToken, emailVerificationCode.trim());
      setEmailSuccess('Email changed successfully!');
      setNewEmail('');
      setEmailVerificationCode('');
      setEmailCodeSent(false);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to change email');
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    
    setPasswordChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setPasswordChanging(false);
    }
  };

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
      <div className="mb-4">
        <button 
          onClick={() => router.push('/')}
          className="text-slate-400 hover:text-slate-200 text-sm mb-2 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-slate-100">Profile</h1>
      </div>

      {/* Main Profile Card - Compact */}
      <div className="glass rounded-xl p-4 border border-white/10 mb-4">
        {/* Avatar & Username Row */}
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ 
              backgroundColor: config.bgColor,
              border: `2px solid ${config.color}`,
            }}
          >
            {config.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{profile.username}</h2>
            <div className="flex items-center gap-2">
              <DivisionBadge division={profile.division} size="sm" />
              <span className="text-sm font-semibold" style={{ color: config.color }}>{profile.rating}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-green-400">{profile.ranked_wins}</div>
            <div className="text-[10px] text-slate-400">Wins</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-red-400">{profile.ranked_losses}</div>
            <div className="text-[10px] text-slate-400">Losses</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-slate-100">{profile.win_rate}%</div>
            <div className="text-[10px] text-slate-400">Win%</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-yellow-400">{profile.peak_rating}</div>
            <div className="text-[10px] text-slate-400">Peak</div>
          </div>
        </div>
      </div>

      {/* Casual Stats Card - Compact */}
      {casualStats && (
        <div className="glass rounded-xl p-3 border border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-400">Casual</h3>
            <div className="flex-1 grid grid-cols-4 gap-2">
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-indigo-400">{casualStats.total_games}</div>
                <div className="text-[10px] text-slate-400">Games</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-400">{casualStats.wins}</div>
                <div className="text-[10px] text-slate-400">Wins</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-400">{casualStats.losses}</div>
                <div className="text-[10px] text-slate-400">Losses</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-slate-100">{casualStats.win_rate}%</div>
                <div className="text-[10px] text-slate-400">Win%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['stats', 'games', 'friends', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'stats' && '📊 Ranked Stats'}
            {tab === 'games' && '🎮 Game History'}
            {tab === 'friends' && (
              <>
                👥 Friends
                {friendRequests.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {friendRequests.length}
                  </span>
                )}
              </>
            )}
            {tab === 'settings' && '⚙️ Settings'}
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <>
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
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Ranked Matches</h3>
            
            {matches.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No ranked matches yet. Start playing to see your history!
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => {
                  const myData = match.players?.find(p => p.username === profile.username);
                  const opponents = match.players?.filter(p => p.username !== profile.username) || [];
                  const isPlayer1 = match.player1?.username === profile.username;
                  const legacyOpponent = isPlayer1 ? match.player2 : match.player1;
                  const ratingChange = myData?.rating_change 
                    || (isPlayer1 ? match.rating_change_p1 : match.rating_change_p2) 
                    || 0;
                  const won = myData ? myData.placement === 1 : ratingChange > 0;
                  const displayOpponents = opponents.length > 0 ? opponents : (legacyOpponent ? [legacyOpponent] : []);
                  
                  return (
                    <div 
                      key={match.id}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        won ? 'bg-green-900/20 border border-green-500/20' : 'bg-red-900/20 border border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`text-2xl ${won ? 'text-green-400' : 'text-red-400'}`}>
                          {won ? '🏆' : '💔'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-100">
                            vs {displayOpponents.map(o => o.username).join(', ') || 'Unknown'}
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
          </div>
        </>
      )}

      {/* Game History Tab */}
      {activeTab === 'games' && (
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">All Games Played</h3>
          
          {gameHistoryLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : gameHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No finished games yet.
            </div>
          ) : (
            <div className="space-y-3">
              {gameHistory.map((game) => (
                <div 
                  key={game.id}
                  className={`p-4 rounded-xl ${
                    game.won ? 'bg-green-900/20 border border-green-500/20' : 'bg-slate-800/50 border border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{game.won ? '🏆' : `#${game.my_placement}`}</span>
                      <div>
                        <div className="font-medium text-slate-100">
                          {game.player_count} Player Game
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(game.finished_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-100">{game.my_points} pts</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {game.players.map((player, idx) => (
                      <span 
                        key={idx}
                        className={`text-xs px-2 py-1 rounded ${
                          player.is_me 
                            ? 'bg-indigo-600/30 text-indigo-300' 
                            : player.is_winner 
                              ? 'bg-yellow-600/30 text-yellow-300'
                              : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        #{player.placement} {player.username} ({player.prestige_points}pts)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-6">
          {/* Add Friend */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Add Friend</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={friendNickname}
                onChange={(e) => setFriendNickname(e.target.value)}
                placeholder="Enter nickname..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
                onKeyDown={(e) => e.key === 'Enter' && handleSendFriendRequest()}
              />
              <button
                onClick={handleSendFriendRequest}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                Send Request
              </button>
            </div>
            {friendError && <p className="text-red-400 text-sm mt-2">{friendError}</p>}
            {friendSuccess && <p className="text-green-400 text-sm mt-2">{friendSuccess}</p>}
          </div>

          {/* Pending Requests */}
          {friendRequests.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                Friend Requests ({friendRequests.length})
              </h3>
              <div className="space-y-2">
                {friendRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <span className="font-medium text-slate-100">{req.from_username}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondToRequest(req.id, 'accept')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(req.id, 'reject')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Friends ({friends.length})
            </h3>
            {friendsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No friends yet. Add some friends to play together!
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <span className="font-medium text-slate-100">{friend.username}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        Friends since {new Date(friend.since).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Change Email */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Change Email</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailCodeSent(false); }}
                  placeholder="New email address..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
                  disabled={emailCodeSent}
                />
                {!emailCodeSent && (
                  <button
                    onClick={handleSendEmailCode}
                    disabled={emailSending || !newEmail}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg"
                  >
                    {emailSending ? 'Sending...' : 'Send Code'}
                  </button>
                )}
              </div>
              {emailCodeSent && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailVerificationCode}
                    onChange={(e) => setEmailVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
                    maxLength={6}
                  />
                  <button
                    onClick={handleChangeEmail}
                    disabled={emailVerificationCode.length !== 6}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg"
                  >
                    Confirm
                  </button>
                </div>
              )}
              {emailError && <p className="text-red-400 text-sm">{emailError}</p>}
              {emailSuccess && <p className="text-green-400 text-sm">{emailSuccess}</p>}
            </div>
          </div>

          {/* Change Password */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Change Password</h3>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-100"
              />
              <button
                onClick={handleChangePassword}
                disabled={passwordChanging || !currentPassword || !newPassword || !confirmPassword}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg"
              >
                {passwordChanging ? 'Changing...' : 'Change Password'}
              </button>
              {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
              {passwordSuccess && <p className="text-green-400 text-sm">{passwordSuccess}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-slate-400">Loading...</div></div>}>
      <ProfileContent />
    </Suspense>
  );
}
