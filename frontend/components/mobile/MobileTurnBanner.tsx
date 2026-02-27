'use client';

interface MobileTurnBannerProps {
  isMyTurn: boolean;
  currentPlayerName: string;
  myUsername: string;
}

export default function MobileTurnBanner({
  isMyTurn,
  currentPlayerName,
  myUsername,
}: MobileTurnBannerProps) {
  return (
    <div
      className={`
        px-4 py-2 text-center font-bold text-sm
        ${isMyTurn
          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-900 animate-pulse'
          : 'bg-slate-800 text-slate-300'}
      `}
    >
      {isMyTurn ? (
        <span className="flex items-center justify-center gap-2">
          <span className="text-lg">▶</span>
          Your Turn
          <span className="text-lg">▶</span>
        </span>
      ) : (
        <span>Waiting for {currentPlayerName}...</span>
      )}
    </div>
  );
}
