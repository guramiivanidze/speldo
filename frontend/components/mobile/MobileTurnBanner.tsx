'use client';

interface Player {
  id: number;
  username: string;
}

interface MobileTurnBannerProps {
  players: Player[];
  currentPlayerIndex: number;
  myUserId: number;
}

function truncateName(name: string, maxLength: number = 10): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + '…';
}

export default function MobileTurnBanner({
  players,
  currentPlayerIndex,
  myUserId,
}: MobileTurnBannerProps) {
  const isMyTurn = players[currentPlayerIndex]?.id === myUserId;
  
  return (
    <div className="px-2 py-2 text-center bg-slate-800">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {players.map((player, index) => {
          const isCurrent = index === currentPlayerIndex;
          const isMe = player.id === myUserId;
          const displayName = truncateName(player.username);
          
          return (
            <span key={player.id} className="flex items-center">
              <span
                className={`
                  px-2 py-1 rounded text-sm font-medium
                  ${isCurrent
                    ? 'bg-amber-500 text-amber-900 animate-pulse font-bold'
                    : isMe
                      ? 'text-amber-300'
                      : 'text-slate-300'}
                `}
              >
                {displayName}
              </span>
              {index < players.length - 1 && (
                <span className="text-slate-500 mx-1">→</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
