from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


class CsrfTokenView(APIView):
    """Return CSRF token for cross-origin requests"""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        if not username or not password:
            return Response({'error': 'Username and password required.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already taken.'}, status=400)
        user = User.objects.create_user(username=username, password=password)
        login(request, user)
        return Response({'id': user.id, 'username': user.username}, status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'error': 'Invalid credentials.'}, status=400)
        login(request, user)
        return Response({'id': user.id, 'username': user.username})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out.'})


class MeView(APIView):
    def get(self, request):
        return Response({'id': request.user.id, 'username': request.user.username})
