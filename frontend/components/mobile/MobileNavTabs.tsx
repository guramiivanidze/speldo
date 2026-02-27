'use client';

type MobileTab = 'board' | 'me' | 'opponents';

interface MobileNavTabsProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  opponentCount: number;
  flashMeTab?: boolean;
}

export default function MobileNavTabs({
  activeTab,
  onTabChange,
  opponentCount,
  flashMeTab = false,
}: MobileNavTabsProps) {
  const tabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'board', label: 'Board', icon: '🎴' },
    { id: 'me', label: 'Me', icon: '👤' },
    { id: 'opponents', label: `Opponents (${opponentCount})`, icon: '👥' },
  ];

  return (
    <div className="flex bg-slate-900 border-t border-white/10 safe-area-bottom">
      {tabs.map((tab) => {
        const shouldFlash = tab.id === 'me' && flashMeTab && activeTab !== 'me';
        return (
          <button
            key={tab.id}
            className={`
              flex-1 py-3 flex items-center justify-center gap-1.5
              transition-colors
              ${activeTab === tab.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'}
              ${shouldFlash ? 'animate-pulse-green' : ''}
            `}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide">{tab.label}</span>
            {shouldFlash && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
        );
      })}
    </div>
  );
}
