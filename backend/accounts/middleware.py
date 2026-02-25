"""
WebSocket authentication middleware using signed tokens.
"""
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import User, AnonymousUser
from django.core import signing


@database_sync_to_async
def get_user_from_token(token):
    """Validate token and return user."""
    try:
        # Token expires after 1 hour
        data = signing.loads(token, salt='websocket-auth', max_age=3600)
        user_id = data.get('user_id')
        if user_id:
            return User.objects.get(id=user_id)
    except (signing.BadSignature, signing.SignatureExpired, User.DoesNotExist):
        pass
    return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """Middleware that authenticates WebSocket connections using a token query parameter."""

    async def __call__(self, scope, receive, send):
        # Parse query string for token
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        elif 'user' not in scope or scope['user'].is_anonymous:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
