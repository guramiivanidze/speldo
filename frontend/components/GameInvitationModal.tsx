'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { respondToGameInvitation } from '@/lib/api';
import type { GameInvitationNotification } from '@/hooks/useNotifications';

interface GameInvitationModalProps {
  invitation: GameInvitationNotification;
  onClose: () => void;
}

export default function GameInvitationModal({ invitation, onClose }: GameInvitationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setLoading('accept');
    setError('');
    try {
      const response = await respondToGameInvitation(invitation.invitation_id, 'accept');
      if (response.game_code) {
        router.push(`/game/${response.game_code}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    setLoading('decline');
    setError('');
    try {
      await respondToGameInvitation(invitation.invitation_id, 'decline');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-sm border border-white/10 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-slate-100 mb-1">Game Invitation</h3>
          <p className="text-slate-400 text-sm">
            <span className="text-indigo-400 font-semibold">{invitation.from_username}</span> invited you to play!
          </p>
        </div>

        {/* Room Info */}
        <div className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/40">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Room Code</p>
              <p className="font-mono font-black text-lg gold-text tracking-widest">{invitation.game_code}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Players</p>
              <p className="text-slate-200 font-semibold">
                {invitation.current_players}/{invitation.max_players}
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={loading !== null}
            className="
              flex-1 py-3 rounded-xl font-bold text-sm
              bg-slate-700/60 hover:bg-slate-700
              text-slate-300 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {loading === 'decline' ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Declining...
              </span>
            ) : 'Decline'}
          </button>
          <button
            onClick={handleAccept}
            disabled={loading !== null}
            className="
              flex-1 py-3 rounded-xl font-bold text-sm
              bg-gradient-to-r from-emerald-600 to-teal-600
              hover:from-emerald-500 hover:to-teal-500
              text-white transition-all shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {loading === 'accept' ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Joining...
              </span>
            ) : 'Join Game'}
          </button>
        </div>
      </div>
    </div>
  );
}
