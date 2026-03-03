'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications, GameInvitationNotification } from '@/hooks/useNotifications';
import GameInvitationModal from '@/components/GameInvitationModal';

interface NotificationContextType {
  connected: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  connected: false,
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: ReactNode;
}

function NotificationHandler() {
  const [pendingInvitation, setPendingInvitation] = useState<GameInvitationNotification | null>(null);
  const [expiredInvitationIds, setExpiredInvitationIds] = useState<Set<number>>(new Set());

  const handleGameInvitation = useCallback((invitation: GameInvitationNotification) => {
    // Don't show if already expired
    if (expiredInvitationIds.has(invitation.invitation_id)) return;
    setPendingInvitation(invitation);
  }, [expiredInvitationIds]);

  const handleInvitationExpired = useCallback((data: { invitation_id: number }) => {
    setExpiredInvitationIds(prev => new Set([...prev, data.invitation_id]));
    // Close modal if this invitation is currently shown
    setPendingInvitation(prev => {
      if (prev?.invitation_id === data.invitation_id) {
        return null;
      }
      return prev;
    });
  }, []);

  const { connected } = useNotifications({
    onGameInvitation: handleGameInvitation,
    onInvitationExpired: handleInvitationExpired,
  });

  const handleCloseModal = useCallback(() => {
    setPendingInvitation(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ connected }}>
      {pendingInvitation && (
        <GameInvitationModal
          invitation={pendingInvitation}
          onClose={handleCloseModal}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();

  return (
    <>
      {children}
      {/* Only connect to notifications when logged in */}
      {user && <NotificationHandler />}
    </>
  );
}
