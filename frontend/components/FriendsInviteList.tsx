'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGameFriends, sendGameInvitation, type GameFriend } from '@/lib/api';

interface FriendsInviteListProps {
  gameCode: string;
  slotsAvailable: number;
}

export default function FriendsInviteList({ gameCode, slotsAvailable }: FriendsInviteListProps) {
  const [friends, setFriends] = useState<GameFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGameFriends(gameCode);
      setFriends(data.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, [gameCode]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleInvite = async (friendId: number) => {
    setInvitingId(friendId);
    try {
      await sendGameInvitation(gameCode, friendId);
      // Update local state to show invitation sent
      setFriends(prev => prev.map(f => 
        f.id === friendId 
          ? { ...f, invitation_status: 'pending', can_invite: false }
          : f
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
      setTimeout(() => setError(''), 3000);
    } finally {
      setInvitingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 text-center text-slate-500 text-sm">
        Loading friends...
      </div>
    );
  }

  if (friends.length === 0) {
    return null; // Don't show section if no friends
  }

  const invitableFriends = friends.filter(f => f.can_invite);
  const displayedFriends = expanded ? friends : friends.slice(0, 4);

  return (
    <div className="mt-6 border-t border-slate-700/50 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-400">
          Invite Friends
        </h4>
        {slotsAvailable > 0 && invitableFriends.length > 0 && (
          <span className="text-[10px] text-slate-500">
            {slotsAvailable} slot{slotsAvailable > 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {displayedFriends.map(friend => (
          <div 
            key={friend.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/40"
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: 'linear-gradient(135deg, #475569, #1e293b)' }}
              >
                {friend.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm text-slate-200 font-medium">{friend.username}</span>
            </div>

            {friend.is_in_game ? (
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/20">
                In game
              </span>
            ) : friend.invitation_status === 'pending' ? (
              <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/20">
                Invited
              </span>
            ) : friend.invitation_status === 'accepted' ? (
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/20">
                Joined
              </span>
            ) : friend.invitation_status === 'declined' ? (
              <button
                onClick={() => handleInvite(friend.id)}
                disabled={invitingId === friend.id || slotsAvailable === 0}
                className="
                  text-[10px] font-semibold px-2.5 py-1 rounded
                  bg-slate-600/50 hover:bg-slate-600 
                  text-slate-300 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {invitingId === friend.id ? '...' : 'Resend'}
              </button>
            ) : friend.can_invite ? (
              <button
                onClick={() => handleInvite(friend.id)}
                disabled={invitingId === friend.id || slotsAvailable === 0}
                className="
                  text-[10px] font-semibold px-2.5 py-1 rounded
                  bg-indigo-600/80 hover:bg-indigo-500
                  text-white transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {invitingId === friend.id ? (
                  <span className="inline-flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                ) : 'Invite'}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {friends.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${friends.length - 4} more`}
        </button>
      )}
    </div>
  );
}
