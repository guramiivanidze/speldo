from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.core import signing
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import re
import time


# Token expiration times in seconds
TOKEN_EXPIRY_DEFAULT = 60 * 60 * 24  # 1 day
TOKEN_EXPIRY_REMEMBER = 60 * 60 * 24 * 30  # 30 days


def create_auth_token(user, remember_me=False):
    """Create a signed auth token for a user with expiration."""
    expiry = TOKEN_EXPIRY_REMEMBER if remember_me else TOKEN_EXPIRY_DEFAULT
    exp_timestamp = int(time.time()) + expiry
    return signing.dumps({
        'user_id': user.id,
        'exp': exp_timestamp,
        'remember': remember_me,
    }, salt='api-auth')


class CsrfTokenView(APIView):
    """Return CSRF token for cross-origin requests"""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class WebSocketTokenView(APIView):
    """Return a signed token for WebSocket authentication"""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=401)
        # Create a signed token with user ID, expires in 1 hour
        token = signing.dumps({'user_id': request.user.id}, salt='websocket-auth')
        return Response({'token': token})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        nickname = request.data.get('username', '').strip()  # nickname is the username
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        
        # Validate nickname (username)
        if not nickname:
            return Response({'error': 'Nickname is required.'}, status=400)
        if len(nickname) > 40:
            return Response({'error': 'Nickname must be 40 characters or less.'}, status=400)
        if ' ' in nickname:
            return Response({'error': 'Nickname cannot contain spaces.'}, status=400)
        if User.objects.filter(username__iexact=nickname).exists():
            return Response({'error': 'Nickname already taken.'}, status=400)
        
        # Validate email
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        try:
            validate_email(email)
        except ValidationError:
            return Response({'error': 'Invalid email format.'}, status=400)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'Email already registered.'}, status=400)
        
        # Validate password
        if not password:
            return Response({'error': 'Password is required.'}, status=400)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=400)
        if not re.search(r'[a-z]', password):
            return Response({'error': 'Password must contain a lowercase letter.'}, status=400)
        if not re.search(r'[A-Z]', password):
            return Response({'error': 'Password must contain an uppercase letter.'}, status=400)
        if not re.search(r'\d', password):
            return Response({'error': 'Password must contain a number.'}, status=400)
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', password):
            return Response({'error': 'Password must contain a special character.'}, status=400)
        
        # Create user
        user = User.objects.create_user(username=nickname, email=email, password=password)
        login(request, user)
        token = create_auth_token(user)
        return Response({'id': user.id, 'username': user.username, 'token': token}, status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        remember_me = request.data.get('remember_me', False)
        
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        if not password:
            return Response({'error': 'Password is required.'}, status=400)
        
        # Look up user by email
        try:
            user_obj = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials.'}, status=400)
        
        # Authenticate with username (Django's default)
        user = authenticate(request, username=user_obj.username, password=password)
        if user is None:
            return Response({'error': 'Invalid credentials.'}, status=400)
        login(request, user)
        token = create_auth_token(user, remember_me=bool(remember_me))
        return Response({
            'id': user.id,
            'username': user.username,
            'token': token,
            'remember_me': bool(remember_me),
        })


class LogoutView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out.'})


class MeView(APIView):
    def get(self, request):
        return Response({'id': request.user.id, 'username': request.user.username})
