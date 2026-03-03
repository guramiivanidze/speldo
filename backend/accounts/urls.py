from django.urls import path
from .views import (
    CsrfTokenView, AuthConfigView, WebSocketTokenView, RegisterView, LoginView, LogoutView, MeView,
    SendVerificationCodeView, VerifyCodeView,
    SendFriendRequestView, PendingFriendRequestsView, RespondFriendRequestView,
    FriendsListView, FriendsWithStatsView, RemoveFriendView,
    SendEmailChangeCodeView, ChangeEmailView, ChangePasswordView,
)

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='csrf'),
    path('config/', AuthConfigView.as_view(), name='auth-config'),
    path('ws-token/', WebSocketTokenView.as_view(), name='ws-token'),
    path('send-verification/', SendVerificationCodeView.as_view(), name='send-verification'),
    path('verify-code/', VerifyCodeView.as_view(), name='verify-code'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    
    # Friend endpoints
    path('friend-request/', SendFriendRequestView.as_view(), name='send-friend-request'),
    path('friend-requests/', PendingFriendRequestsView.as_view(), name='pending-friend-requests'),
    path('friend-request/<int:request_id>/<str:action>/', RespondFriendRequestView.as_view(), name='respond-friend-request'),
    path('friends/', FriendsListView.as_view(), name='friends-list'),
    path('friends/with-stats/', FriendsWithStatsView.as_view(), name='friends-with-stats'),
    path('friends/<int:friend_id>/remove/', RemoveFriendView.as_view(), name='remove-friend'),
    
    # Profile change endpoints
    path('send-email-change-code/', SendEmailChangeCodeView.as_view(), name='send-email-change-code'),
    path('change-email/', ChangeEmailView.as_view(), name='change-email'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
]
