"""
WebSocket consumer for matchmaking notifications.
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class MatchmakingConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time matchmaking updates."""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        self.group_name = f"matchmaking_{self.user.id}"
        
        # Join user's matchmaking group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"User {self.user.username} connected to matchmaking WebSocket")
        
        # Send current queue status
        status = await self.get_queue_status()
        await self.send(json.dumps({
            'type': 'queue_status',
            **status
        }))
    
    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"User {self.user.username} disconnected from matchmaking WebSocket")
    
    async def receive(self, text_data):
        """Handle incoming messages from the client."""
        try:
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'join_queue':
                result = await self.handle_join_queue()
                await self.send(json.dumps(result))
            
            elif action == 'leave_queue':
                result = await self.handle_leave_queue()
                await self.send(json.dumps(result))
            
            elif action == 'get_status':
                status = await self.get_queue_status()
                await self.send(json.dumps({
                    'type': 'queue_status',
                    **status
                }))
        
        except json.JSONDecodeError:
            await self.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    @database_sync_to_async
    def get_queue_status(self):
        from .matchmaking import MatchmakingService, get_or_create_player
        player = get_or_create_player(self.user)
        return MatchmakingService.get_queue_status(player)
    
    @database_sync_to_async
    def handle_join_queue(self):
        from .matchmaking import MatchmakingService, get_or_create_player
        from .serializers import MatchSerializer
        
        player = get_or_create_player(self.user)
        success, message, match = MatchmakingService.join_queue(player)
        
        result = {
            'type': 'queue_join_result',
            'success': success,
            'message': message
        }
        
        if match:
            result['match'] = MatchSerializer(match).data
        
        return result
    
    @database_sync_to_async
    def handle_leave_queue(self):
        from .matchmaking import MatchmakingService, get_or_create_player
        
        player = get_or_create_player(self.user)
        success, message = MatchmakingService.leave_queue(player)
        
        return {
            'type': 'queue_leave_result',
            'success': success,
            'message': message
        }
    
    # Event handlers for messages sent to this consumer's group
    
    async def match_found(self, event):
        """Notify client that a match has been found."""
        await self.send(json.dumps({
            'type': 'match_found',
            'game_code': event['game_code'],
            'opponent': event['opponent']
        }))
    
    async def queue_update(self, event):
        """Send queue status update to client."""
        await self.send(json.dumps({
            'type': 'queue_update',
            'wait_time_seconds': event.get('wait_time_seconds'),
            'search_range': event.get('search_range'),
            'players_in_queue': event.get('players_in_queue')
        }))
