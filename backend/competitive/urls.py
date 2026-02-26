from django.urls import path
from . import views

app_name = 'competitive'

urlpatterns = [
    # Season
    path('season/', views.current_season, name='current_season'),
    
    # Player profiles
    path('profile/', views.my_profile, name='my_profile'),
    path('profile/<str:username>/', views.player_profile, name='player_profile'),
    
    # Leaderboard
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('leaderboard/<str:division>/', views.leaderboard_by_division, name='leaderboard_by_division'),
    
    # Matchmaking
    path('matchmaking/join/', views.join_matchmaking, name='join_matchmaking'),
    path('matchmaking/leave/', views.leave_matchmaking, name='leave_matchmaking'),
    path('matchmaking/status/', views.matchmaking_status, name='matchmaking_status'),
    path('matchmaking/process/', views.process_matchmaking_queue, name='process_queue'),
    
    # Match history
    path('matches/', views.match_history, name='match_history'),
    path('matches/<int:match_id>/', views.match_detail, name='match_detail'),
    path('matches/by-game/<str:game_id>/', views.match_by_game, name='match_by_game'),
    
    # Info
    path('divisions/', views.division_info, name='division_info'),
    
    # Admin
    path('admin/refresh-leaderboard/', views.refresh_leaderboard_cache, name='refresh_leaderboard'),
]
