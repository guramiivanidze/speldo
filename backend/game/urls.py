from django.urls import path
from .views import (
    GameListCreateView, GameJoinView,
    GameStartView, GameStateView, MyGamesView,
)

urlpatterns = [
    path('games/', GameListCreateView.as_view(), name='game-list-create'),
    path('games/mine/', MyGamesView.as_view(), name='my-games'),
    path('games/<str:code>/join/', GameJoinView.as_view(), name='game-join'),
    path('games/<str:code>/start/', GameStartView.as_view(), name='game-start'),
    path('games/<str:code>/state/', GameStateView.as_view(), name='game-state'),
]
