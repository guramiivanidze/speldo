from django.urls import path
from .views import (
    GameListCreateView, GameJoinView,
    GameStartView, GameStateView, MyGamesView, FriendsWaitingGamesView,
    GameHistoryView, UserGameHistoryView, CasualStatsView, CasualLeaderboardView,
    GameFriendsListView, SendGameInvitationView, 
    RespondGameInvitationView, PendingGameInvitationsView,
)

urlpatterns = [
    path('games/', GameListCreateView.as_view(), name='game-list-create'),
    path('games/mine/', MyGamesView.as_view(), name='my-games'),
    path('games/friends-waiting/', FriendsWaitingGamesView.as_view(), name='friends-waiting-games'),
    path('games/history/', UserGameHistoryView.as_view(), name='user-game-history'),
    path('games/casual-stats/', CasualStatsView.as_view(), name='casual-stats'),
    path('games/casual-leaderboard/', CasualLeaderboardView.as_view(), name='casual-leaderboard'),
    path('games/invitations/', PendingGameInvitationsView.as_view(), name='pending-game-invitations'),
    path('games/<str:code>/join/', GameJoinView.as_view(), name='game-join'),
    path('games/<str:code>/start/', GameStartView.as_view(), name='game-start'),
    path('games/<str:code>/state/', GameStateView.as_view(), name='game-state'),
    path('games/<str:code>/history/', GameHistoryView.as_view(), name='game-history'),
    path('games/<str:code>/friends/', GameFriendsListView.as_view(), name='game-friends'),
    path('games/<str:code>/invite/', SendGameInvitationView.as_view(), name='send-game-invitation'),
    path('games/invitation/<int:invitation_id>/<str:action>/', RespondGameInvitationView.as_view(), name='respond-game-invitation'),
]
