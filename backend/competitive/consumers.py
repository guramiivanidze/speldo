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
        self.lobby_group = None  # Track which lobby group we're in
        
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
        
        # If already in queue, join the lobby group
        if status.get('in_queue') and status.get('player_count'):
            await self.join_lobby_group(status['player_count'])
    
    async def disconnect(self, close_code):
        # Leave lobby group if in one
        if self.lobby_group:
            await self.channel_layer.group_discard(
                self.lobby_group,
                self.channel_name
            )
        
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"User {self.user.username} disconnected from matchmaking WebSocket")
    
    async def join_lobby_group(self, player_count: int):
        """Join a lobby group for a specific player count."""
        new_lobby = f"matchmaking_lobby_{player_count}p"
        
        # Leave old lobby if different
        if self.lobby_group and self.lobby_group != new_lobby:
            await self.channel_layer.group_discard(
                self.lobby_group,
                self.channel_name
            )
        
        self.lobby_group = new_lobby
        await self.channel_layer.group_add(
            self.lobby_group,
            self.channel_name
        )
        logger.info(f"User {self.user.username} joined lobby {new_lobby}")
    
    async def leave_lobby_group(self):
        """Leave the current lobby group."""
        if self.lobby_group:
            await self.channel_layer.group_discard(
                self.lobby_group,
                self.channel_name
            )
            logger.info(f"User {self.user.username} left lobby {self.lobby_group}")
            self.lobby_group = None
    
    async def receive(self, text_data):
        """Handle incoming messages from the client."""
        try:
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'join_queue':
                player_count = data.get('player_count', 2)
                result = await self.handle_join_queue(player_count)
                await self.send(json.dumps(result))
                
                # Join lobby group and broadcast update
                if result.get('success'):
                    await self.join_lobby_group(player_count)
                    await self.broadcast_lobby_update(player_count)
            
            elif action == 'leave_queue':
                # Get player count before leaving for broadcast
                status = await self.get_queue_status()
                player_count = status.get('player_count', 2)
                
                result = await self.handle_leave_queue()
                await self.send(json.dumps(result))
                
                # Leave lobby group and broadcast update
                if result.get('success'):
                    await self.leave_lobby_group()
                    await self.broadcast_lobby_update(player_count)
            
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
    def handle_join_queue(self, player_count=2):
        from .matchmaking import MatchmakingService, get_or_create_player
        from .serializers import MatchSerializer
        
        # Validate player count
        try:
            player_count = int(player_count)
            if player_count not in [2, 3, 4]:
                player_count = 2
        except (ValueError, TypeError):
            player_count = 2
        
        player = get_or_create_player(self.user)
        success, message, match = MatchmakingService.join_queue(player, player_count)
        
        result = {
            'type': 'queue_join_result',
            'success': success,
            'message': message,
            'player_count': player_count,
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
    
    @database_sync_to_async
    def get_lobby_players(self, player_count: int):
        """Get all players currently in queue for a specific player count."""
        from .models import MatchmakingQueue
        
        queue_entries = MatchmakingQueue.objects.filter(
            player_count_preference=player_count
        ).select_related('player__user').order_by('joined_at')
        
        return [
            {
                'username': entry.player.user.username,
                'rating': entry.player.rating,
                'division': entry.player.division,
            }
            for entry in queue_entries
        ]
    
    async def broadcast_lobby_update(self, player_count: int):
        """Broadcast lobby update to all players waiting for this player count."""
        lobby_players = await self.get_lobby_players(player_count)
        
        await self.channel_layer.group_send(
            f"matchmaking_lobby_{player_count}p",
            {
                'type': 'lobby_update',
                'player_count': player_count,
                'lobby_players': lobby_players,
                'players_needed': player_count - len(lobby_players),
            }
        )
    
    # Event handlers for messages sent to this consumer's group
    
    async def lobby_update(self, event):
        """Notify client about lobby changes."""
        await self.send(json.dumps({
            'type': 'lobby_update',
            'player_count': event['player_count'],
            'lobby_players': event['lobby_players'],
            'players_needed': event['players_needed'],
        }))
    
    async def match_found(self, event):
        """Notify client that a match has been found."""
        message = {
            'type': 'match_found',
            'game_code': event['game_code'],
            'player_count': event.get('player_count', 2),
            'opponents': event.get('opponents', []),
        }
        # Legacy support for 2-player matches
        if event.get('opponent'):
            message['opponent'] = event['opponent']
        await self.send(json.dumps(message))
    
    async def queue_update(self, event):
        """Send queue status update to client."""
        await self.send(json.dumps({
            'type': 'queue_update',
            'wait_time_seconds': event.get('wait_time_seconds'),
            'search_range': event.get('search_range'),
            'players_in_queue': event.get('players_in_queue')
        }))
