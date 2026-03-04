'use client';

import { useState } from 'react';
import { FriendRequest, respondToFriendRequest } from '@/lib/api';

interface FriendRequestsModalProps {
  requests: FriendRequest[];
  onClose: () => void;
  onRequestHandled: (requestId: number) => void;
}

export default function FriendRequestsModal({ requests, onClose, onRequestHandled }: FriendRequestsModalProps) {
  const [respondingTo, setRespondingTo] = useState<number | null>(null);

  const handleRespond = async (requestId: number, action: 'accept' | 'reject') => {
    setRespondingTo(requestId);
    try {
      await respondToFriendRequest(requestId, action);
      onRequestHandled(requestId);
    } catch (err) {
      console.error('Failed to respond to friend request:', err);
    } finally {
      setRespondingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h2 className="font-bold text-slate-100">Friend Requests</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {requests.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">
              No pending friend requests
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-900/30 border border-indigo-700/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {request.from_username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-200">{request.from_username}</span>
                      <p className="text-[10px] text-slate-500">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(request.id, 'accept')}
                      disabled={respondingTo === request.id}
                      className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                      title="Accept"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRespond(request.id, 'reject')}
                      disabled={respondingTo === request.id}
                      className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50"
                      title="Reject"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
