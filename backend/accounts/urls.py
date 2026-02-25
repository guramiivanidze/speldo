from django.urls import path
from .views import CsrfTokenView, RegisterView, LoginView, LogoutView, MeView

urlpatterns = [
    path('csrf/', CsrfTokenView.as_view(), name='csrf'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
]
