'use client';

type MobileTab = 'board' | 'me' | 'opponents' | 'chat';

interface MobileNavTabsProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  opponentCount: number;
  flashMeTab?: boolean;
  showChat?: boolean;
  unreadChatCount?: number;
}

export default function MobileNavTabs({
  activeTab,
  onTabChange,
  opponentCount,
  flashMeTab = false,
  showChat = false,
  unreadChatCount = 0,
}: MobileNavTabsProps) {
  const tabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'board', label: 'Board', icon: '🎴' },
    { id: 'me', label: 'Me', icon: '👤' },
    { id: 'opponents', label: `Opponents (${opponentCount})`, icon: '👥' },
  ];

  // Add chat tab if enabled
  if (showChat) {
    tabs.push({ id: 'chat', label: 'Chat', icon: '💬' });
  }

  return (
    <div className="flex bg-slate-900 border-t border-white/10 safe-area-bottom">
      {tabs.map((tab) => {
        const shouldFlash = tab.id === 'me' && flashMeTab && activeTab !== 'me';
        const shouldFlashChat = tab.id === 'chat' && unreadChatCount > 0 && activeTab !== 'chat';
        return (
          <button
            key={tab.id}
            className={`
              flex-1 py-3 flex items-center justify-center gap-1.5
              transition-colors relative
              ${activeTab === tab.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'}
              ${shouldFlash ? 'animate-pulse-green' : ''}
              ${shouldFlashChat ? 'animate-pulse' : ''}
            `}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide">{tab.label}</span>
            {shouldFlash && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            {shouldFlashChat && unreadChatCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
