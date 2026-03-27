import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'splendor.settings')

django.setup()

from game.routing import websocket_urlpatterns as game_ws_urlpatterns
from accounts.routing import websocket_urlpatterns as accounts_ws_urlpatterns
from accounts.middleware import TokenAuthMiddleware

# Combine all WebSocket URL patterns
all_websocket_urlpatterns = game_ws_urlpatterns + accounts_ws_urlpatterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': TokenAuthMiddleware(
        URLRouter(all_websocket_urlpatterns)
    ),
})
