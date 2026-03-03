"""
WebSocket consumer for user notifications (game invitations, etc.).
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """Handles real-time notifications for logged-in users."""
    
    async def connect(self):
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # Subscribe to user-specific notification channel
        self.notification_group = f'notifications_{self.user.id}'
        await self.channel_layer.group_add(
            self.notification_group,
            self.channel_name
        )
        await self.accept()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group'):
            await self.channel_layer.group_discard(
                self.notification_group,
                self.channel_name
            )
    
    async def receive(self, text_data):
        # Client can send heartbeat or other messages
        pass
    
    # ─── Message Handlers ───────────────────────────────────
    
    async def game_invitation(self, event):
        """Handle incoming game invitation notification."""
        await self.send(text_data=json.dumps({
            'type': 'game_invitation',
            'invitation_id': event['invitation_id'],
            'game_code': event['game_code'],
            'from_user_id': event['from_user_id'],
            'from_username': event['from_username'],
            'max_players': event['max_players'],
            'current_players': event['current_players'],
        }))
    
    async def invitation_expired(self, event):
        """Notify client that an invitation has expired."""
        await self.send(text_data=json.dumps({
            'type': 'invitation_expired',
            'invitation_id': event['invitation_id'],
            'reason': event.get('reason', 'Game started or room was closed'),
        }))
