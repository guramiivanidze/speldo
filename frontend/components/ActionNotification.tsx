'use client';

import { LastAction } from '@/types/game';

interface ActionNotificationProps {
  lastAction: LastAction | null;
  myUserId: number;
}

function truncateName(name: string, maxLength: number = 12): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + '…';
}

function getColorEmoji(color: string): string {
  const emojis: Record<string, string> = {
    white: '⚪',
    blue: '🔵',
    green: '🟢',
    red: '🔴',
    black: '⚫',
    gold: '🟡',
  };
  return emojis[color] || '●';
}

export default function ActionNotification({ lastAction, myUserId }: ActionNotificationProps) {
  if (!lastAction) return null;

  const { type, player_id, player_username, data } = lastAction;
  const isMe = player_id === myUserId;
  const playerName = isMe ? 'You' : truncateName(player_username);

  let message = '';
  let details = '';

  switch (type) {
    case 'take_tokens': {
      const colors = data.colors || [];
      if (colors.length === 0) {
        message = `${playerName} took tokens`;
      } else if (colors.length === 2 && colors[0] === colors[1]) {
        // Taking 2 of the same
        message = `${playerName} took 2 ${colors[0]} tokens`;
        details = `${getColorEmoji(colors[0])} ${getColorEmoji(colors[0])}`;
      } else {
        // Taking different colors
        message = `${playerName} took ${colors.length} token${colors.length > 1 ? 's' : ''}`;
        details = colors.map(c => getColorEmoji(c)).join(' ');
      }
      break;
    }
    case 'reserve_card': {
      const goldReceived = data.gold_received;
      const fromDeck = data.from_deck;
      if (fromDeck) {
        message = goldReceived
          ? `${playerName} reserved from deck + 🟡`
          : `${playerName} reserved from deck`;
      } else {
        message = goldReceived
          ? `${playerName} reserved a card + 🟡`
          : `${playerName} reserved a card`;
      }
      break;
    }
    case 'buy_card': {
      const fromReserved = data.from_reserved;
      const tokensSpent = data.tokens_spent || {};
      const spentColors = Object.entries(tokensSpent)
        .filter(([_, count]) => count > 0)
        .map(([color, count]) => {
          return Array(count).fill(getColorEmoji(color)).join('');
        })
        .join(' ');
      
      if (fromReserved) {
        message = `${playerName} bought a reserved card`;
      } else {
        message = `${playerName} bought a card`;
      }
      if (spentColors) {
        details = `Spent: ${spentColors}`;
      }
      break;
    }
    case 'noble_visit': {
      message = `${playerName} was visited by a noble!`;
      details = '👑';
      break;
    }
    default:
      return null;
  }

  return (
    <div className="fixed top-16 left-4 z-40 px-4 py-2 bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-600/50 shadow-lg shadow-black/25 text-left animate-fade-in pointer-events-none">
      <div className="text-sm text-slate-200 font-medium whitespace-nowrap">
        {message}
      </div>
      {details && (
        <div className="text-xs text-slate-400 mt-0.5">
          {details}
        </div>
      )}
    </div>
  );
}
