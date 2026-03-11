from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.core import signing
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import re
import time

from .email_service import generate_otp, create_otp_token, verify_otp_token, send_verification_email
from .models import FriendRequest, Friendship


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


class AuthConfigView(APIView):
    """Return auth configuration (e.g., whether email verification is enabled)."""
    permission_classes = [AllowAny]

    def get(self, request):
        from django.conf import settings as django_settings
        return Response({
            'email_verification_enabled': getattr(django_settings, 'EMAIL_VERIFICATION_ENABLED', True),
        })


class WebSocketTokenView(APIView):
    """Return a signed token for WebSocket authentication"""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=401)
        # Create a signed token with user ID, expires in 1 hour
        token = signing.dumps({'user_id': request.user.id}, salt='websocket-auth')
        return Response({'token': token})


class SendVerificationCodeView(APIView):
    """Send OTP verification code to email for registration."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        
        # Validate email format
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        try:
            validate_email(email)
        except ValidationError:
            return Response({'error': 'Invalid email format.'}, status=400)
        
        # Check if email is already registered
        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'Email already registered.'}, status=400)
        
        # Generate and send OTP
        otp = generate_otp()
        success, error = send_verification_email(email, otp)
        
        if not success:
            return Response({'error': error or 'Failed to send verification code.'}, status=500)
        
        # Create verification token
        verification_token = create_otp_token(email, otp)
        
        return Response({
            'message': 'Verification code sent.',
            'verification_token': verification_token,
        })


class VerifyCodeView(APIView):
    """Verify OTP code before registration."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()
        verification_token = request.data.get('verification_token', '')
        
        if not email or not code or not verification_token:
            return Response({'error': 'Email, code, and verification token are required.'}, status=400)
        
        success, error = verify_otp_token(verification_token, email, code)
        
        if not success:
            return Response({'error': error}, status=400)
        
        return Response({'message': 'Email verified.', 'verified': True})


class SendUserVerificationCodeView(APIView):
    """Send OTP verification code to logged-in user's email for verification."""

    def post(self, request):
        from .models import UserProfile
        
        user = request.user
        email = user.email
        
        if not email:
            return Response({'error': 'No email associated with this account.'}, status=400)
        
        # Check if already verified
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.email_verified:
            return Response({'error': 'Email already verified.'}, status=400)
        
        # Generate and send OTP
        otp = generate_otp()
        success, error = send_verification_email(email, otp)
        
        if not success:
            return Response({'error': error or 'Failed to send verification code.'}, status=500)
        
        # Create verification token
        verification_token = create_otp_token(email, otp)
        
        return Response({
            'message': 'Verification code sent.',
            'verification_token': verification_token,
            'email': email,
        })


class VerifyUserEmailView(APIView):
    """Verify logged-in user's email with OTP code."""

    def post(self, request):
        from .models import UserProfile
        
        user = request.user
        code = request.data.get('code', '').strip()
        verification_token = request.data.get('verification_token', '')
        
        if not code or not verification_token:
            return Response({'error': 'Code and verification token are required.'}, status=400)
        
        # Check if already verified
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.email_verified:
            return Response({'error': 'Email already verified.'}, status=400)
        
        success, error = verify_otp_token(verification_token, user.email, code)
        
        if not success:
            return Response({'error': error}, status=400)
        
        # Mark email as verified
        profile.email_verified = True
        profile.save()
        
        return Response({'message': 'Email verified successfully.', 'email_verified': True})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.conf import settings as django_settings
        
        nickname = request.data.get('username', '').strip()  # nickname is the username
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        verification_token = request.data.get('verification_token', '')
        verification_code = request.data.get('verification_code', '').strip()
        
        # Verify email (skip if verification is disabled)
        if getattr(django_settings, 'EMAIL_VERIFICATION_ENABLED', True):
            if not verification_token or not verification_code:
                return Response({'error': 'Email verification is required.'}, status=400)
            
            success, error = verify_otp_token(verification_token, email, verification_code)
            if not success:
                return Response({'error': error}, status=400)
        
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
        
        # Mark email as verified (they just verified it)
        from .models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.email_verified = True
        profile.save()
        
        login(request, user)
        token = create_auth_token(user)
        return Response({'id': user.id, 'username': user.username, 'token': token, 'email_verified': True}, status=201)


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
        
        # Get email_verified status
        from .models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'token': token,
            'remember_me': bool(remember_me),
            'email_verified': profile.email_verified,
        })


class LogoutView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out.'})


class MeView(APIView):
    def get(self, request):
        from .models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'email_verified': profile.email_verified,
        })


# ============ FRIEND VIEWS ============

class SendFriendRequestView(APIView):
    """Send a friend request by nickname."""

    def post(self, request):
        nickname = request.data.get('nickname', '').strip()
        
        if not nickname:
            return Response({'error': 'Nickname is required.'}, status=400)
        
        # Find user by nickname
        try:
            to_user = User.objects.get(username__iexact=nickname)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)
        
        # Can't send to yourself
        if to_user == request.user:
            return Response({'error': 'You cannot send a friend request to yourself.'}, status=400)
        
        # Check if already friends
        if Friendship.objects.filter(user=request.user, friend=to_user).exists():
            return Response({'error': 'You are already friends with this user.'}, status=400)
        
        # Check if request already exists (in either direction)
        existing = FriendRequest.objects.filter(
            from_user=request.user,
            to_user=to_user,
            status=FriendRequest.STATUS_PENDING
        ).first()
        if existing:
            return Response({'error': 'Friend request already sent.'}, status=400)
        
        # Check if they already sent us a request - auto-accept
        incoming = FriendRequest.objects.filter(
            from_user=to_user,
            to_user=request.user,
            status=FriendRequest.STATUS_PENDING
        ).first()
        if incoming:
            # Auto-accept the incoming request
            incoming.status = FriendRequest.STATUS_ACCEPTED
            incoming.responded_at = timezone.now()
            incoming.save()
            
            # Create bidirectional friendship
            Friendship.objects.get_or_create(user=request.user, friend=to_user)
            Friendship.objects.get_or_create(user=to_user, friend=request.user)
            
            return Response({
                'message': f'You are now friends with {to_user.username}!',
                'status': 'accepted'
            })
        
        # Create new friend request
        FriendRequest.objects.create(from_user=request.user, to_user=to_user)
        
        return Response({
            'message': f'Friend request sent to {to_user.username}.',
            'status': 'pending'
        }, status=201)


class PendingFriendRequestsView(APIView):
    """Get pending friend requests for the current user."""

    def get(self, request):
        # Requests sent TO the current user
        received = FriendRequest.objects.filter(
            to_user=request.user,
            status=FriendRequest.STATUS_PENDING
        ).select_related('from_user')
        
        return Response({
            'requests': [
                {
                    'id': req.id,
                    'from_username': req.from_user.username,
                    'created_at': req.created_at.isoformat(),
                }
                for req in received
            ],
            'count': received.count()
        })


class RespondFriendRequestView(APIView):
    """Accept or reject a friend request."""

    def post(self, request, request_id, action):
        if action not in ['accept', 'reject']:
            return Response({'error': 'Invalid action.'}, status=400)
        
        try:
            friend_request = FriendRequest.objects.get(
                id=request_id,
                to_user=request.user,
                status=FriendRequest.STATUS_PENDING
            )
        except FriendRequest.DoesNotExist:
            return Response({'error': 'Friend request not found.'}, status=404)
        
        if action == 'accept':
            friend_request.status = FriendRequest.STATUS_ACCEPTED
            friend_request.responded_at = timezone.now()
            friend_request.save()
            
            # Create bidirectional friendship
            Friendship.objects.get_or_create(user=request.user, friend=friend_request.from_user)
            Friendship.objects.get_or_create(user=friend_request.from_user, friend=request.user)
            
            return Response({
                'message': f'You are now friends with {friend_request.from_user.username}!'
            })
        else:
            friend_request.status = FriendRequest.STATUS_REJECTED
            friend_request.responded_at = timezone.now()
            friend_request.save()
            
            return Response({'message': 'Friend request rejected.'})


class FriendsListView(APIView):
    """Get list of friends for the current user."""

    def get(self, request):
        friendships = Friendship.objects.filter(
            user=request.user
        ).select_related('friend')
        
        return Response({
            'friends': [
                {
                    'id': fs.friend.id,
                    'username': fs.friend.username,
                    'since': fs.created_at.isoformat(),
                }
                for fs in friendships
            ],
            'count': friendships.count()
        })


class FriendsWithStatsView(APIView):
    """Get list of friends with their casual game stats, sorted by wins."""

    def get(self, request):
        from game.models import Game
        from django.db.models import Count, Q
        
        friendships = Friendship.objects.filter(
            user=request.user
        ).select_related('friend')
        
        friends_data = []
        for fs in friendships:
            friend = fs.friend
            
            # Count casual wins (games where friend won and no ranked_match)
            casual_wins = Game.objects.filter(
                status=Game.STATUS_FINISHED,
                winner=friend,
                ranked_match__isnull=True
            ).count()
            
            friends_data.append({
                'id': friend.id,
                'username': friend.username,
                'since': fs.created_at.isoformat(),
                'casual_wins': casual_wins,
            })
        
        # Sort by casual wins descending
        friends_data.sort(key=lambda x: x['casual_wins'], reverse=True)
        
        return Response({
            'friends': friends_data,
            'count': len(friends_data)
        })


class RemoveFriendView(APIView):
    """Remove a friend."""

    def post(self, request, friend_id):
        try:
            friend = User.objects.get(id=friend_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)
        
        # Remove bidirectional friendship
        Friendship.objects.filter(user=request.user, friend=friend).delete()
        Friendship.objects.filter(user=friend, friend=request.user).delete()
        
        return Response({'message': f'Removed {friend.username} from friends.'})


# ============ EMAIL/PASSWORD CHANGE VIEWS ============

class SendEmailChangeCodeView(APIView):
    """Send verification code to new email for email change."""

    def post(self, request):
        new_email = request.data.get('new_email', '').strip().lower()
        
        if not new_email:
            return Response({'error': 'New email is required.'}, status=400)
        
        # Validate email format
        try:
            validate_email(new_email)
        except ValidationError:
            return Response({'error': 'Invalid email format.'}, status=400)
        
        # Check if same as current email
        if request.user.email.lower() == new_email:
            return Response({'error': 'New email must be different from current email.'}, status=400)
        
        # Check if email is already used by another user
        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response({'error': 'Email already in use.'}, status=400)
        
        # Generate and send OTP
        otp = generate_otp()
        success, error = send_verification_email(new_email, otp)
        
        if not success:
            return Response({'error': error or 'Failed to send verification code.'}, status=500)
        
        # Create verification token
        verification_token = create_otp_token(new_email, otp)
        
        return Response({
            'message': 'Verification code sent to new email.',
            'verification_token': verification_token,
        })


class ChangeEmailView(APIView):
    """Change user email after verification."""

    def post(self, request):
        new_email = request.data.get('new_email', '').strip().lower()
        verification_token = request.data.get('verification_token', '')
        verification_code = request.data.get('verification_code', '').strip()
        
        if not new_email or not verification_token or not verification_code:
            return Response({'error': 'New email, verification token, and verification code are required.'}, status=400)
        
        # Verify the code
        success, error = verify_otp_token(verification_token, new_email, verification_code)
        if not success:
            return Response({'error': error}, status=400)
        
        # Check if email is still available
        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response({'error': 'Email already in use.'}, status=400)
        
        # Update email
        request.user.email = new_email
        request.user.save()
        
        return Response({'message': 'Email changed successfully.'})


class ChangePasswordView(APIView):
    """Change user password."""

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        
        if not current_password or not new_password:
            return Response({'error': 'Current and new password are required.'}, status=400)
        
        # Verify current password
        if not request.user.check_password(current_password):
            return Response({'error': 'Current password is incorrect.'}, status=400)
        
        # Check if new password is different
        if request.user.check_password(new_password):
            return Response({'error': 'New password must be different from current password.'}, status=400)
        
        # Validate new password
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=400)
        if not re.search(r'[a-z]', new_password):
            return Response({'error': 'Password must contain a lowercase letter.'}, status=400)
        if not re.search(r'[A-Z]', new_password):
            return Response({'error': 'Password must contain an uppercase letter.'}, status=400)
        if not re.search(r'\d', new_password):
            return Response({'error': 'Password must contain a number.'}, status=400)
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', new_password):
            return Response({'error': 'Password must contain a special character.'}, status=400)
        
        # Set new password
        request.user.set_password(new_password)
        request.user.save()
        
        # Re-authenticate user with new password
        user = authenticate(request, username=request.user.username, password=new_password)
        if user:
            login(request, user)
        
        return Response({'message': 'Password changed successfully.'})


class SendPasswordResetCodeView(APIView):
    """Send OTP code to email for password reset."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        
        try:
            validate_email(email)
        except ValidationError:
            return Response({'error': 'Invalid email format.'}, status=400)
        
        # Check if user exists with this email
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Don't reveal if email exists - just say code sent
            return Response({
                'message': 'If an account exists with this email, a reset code has been sent.',
                'verification_token': '',
            })
        
        # Generate and send OTP
        otp = generate_otp()
        success, error = send_verification_email(email, otp)
        
        if not success:
            return Response({'error': error or 'Failed to send reset code.'}, status=500)
        
        # Create verification token
        verification_token = create_otp_token(email, otp)
        
        return Response({
            'message': 'Password reset code sent.',
            'verification_token': verification_token,
        })


class ResetPasswordView(APIView):
    """Reset password using OTP code."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()
        verification_token = request.data.get('verification_token', '')
        new_password = request.data.get('new_password', '')
        
        if not email or not code or not verification_token or not new_password:
            return Response({'error': 'Email, code, verification token, and new password are required.'}, status=400)
        
        # Verify OTP
        success, error = verify_otp_token(verification_token, email, code)
        if not success:
            return Response({'error': error}, status=400)
        
        # Find user
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=404)
        
        # Validate new password
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=400)
        if not re.search(r'[a-z]', new_password):
            return Response({'error': 'Password must contain a lowercase letter.'}, status=400)
        if not re.search(r'[A-Z]', new_password):
            return Response({'error': 'Password must contain an uppercase letter.'}, status=400)
        if not re.search(r'\d', new_password):
            return Response({'error': 'Password must contain a number.'}, status=400)
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]', new_password):
            return Response({'error': 'Password must contain a special character.'}, status=400)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        return Response({'message': 'Password reset successfully.'})
