'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/hooks/useGameSocket';

const QUICK_PHRASES = [
  { emoji: '🍀', text: 'ოოოეე მალეეეე' },
  { emoji: '👏', text: 'ბარათს ხელი არ დაედოს' },
  { emoji: '🎯', text: 'ეს დაარეზერვე აი ეს ' },
  { emoji: '🙏', text: '2 წრეც და მუხლებზე ხართ' },
];

interface GameChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  myUserId: number;
  isOpen: boolean;
  onClose: () => void;
  /** Compact mode for mobile (no close button, full height) */
  compact?: boolean;
}

export default function GameChat({
  messages,
  onSendMessage,
  myUserId,
  isOpen,
  onClose,
  compact = false,
}: GameChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !compact) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, compact]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputValue('');
    }
  };

  const handleQuickPhrase = (text: string) => {
    onSendMessage(text);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div
      className={`
        flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-700/50
        ${compact 
          ? 'h-full rounded-none' 
          : 'fixed bottom-20 right-4 w-96 h-[30rem] rounded-2xl shadow-2xl z-40'
        }
      `}
    >
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <h3 className="font-bold text-slate-200 text-sm">Chat</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Quick phrases */}
      <div className="px-3 py-2 border-b border-slate-700/30">
        <div className="flex flex-wrap gap-1.5">
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase.text}
            onClick={() => handleQuickPhrase(phrase.text)}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
            title={phrase.text}
          >
            <span>{phrase.emoji}</span>
            <span>{phrase.text}</span>
          </button>
        ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === myUserId;
            return (
              <div
                key={index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-xl text-sm
                    ${isMe
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                    }
                  `}
                >
                  {!isMe && (
                    <div className="text-[10px] font-semibold text-indigo-400 mb-0.5">
                      {msg.username}
                    </div>
                  )}
                  <div>{msg.message}</div>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            maxLength={200}
            className="
              flex-1 px-3 py-2 rounded-lg text-sm
              bg-slate-800 border border-slate-700
              text-slate-100 placeholder-slate-500
              focus:outline-none focus:border-indigo-500
              transition-colors
            "
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Chat button for desktop
export function ChatButton({ 
  onClick, 
  unreadCount = 0 
}: { 
  onClick: () => void; 
  unreadCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all z-40 flex items-center justify-center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
