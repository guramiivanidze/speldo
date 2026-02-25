"""
Token authentication for REST API using signed tokens.
"""
from django.contrib.auth.models import User, AnonymousUser
from django.core import signing
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SignedTokenAuthentication(BaseAuthentication):
    """
    Token authentication using Django's signing module.
    Clients should authenticate by passing the token in the Authorization header.
    Example: Authorization: Bearer <token>
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return None  # No token provided, let other auth methods try
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        try:
            # Token expires after 7 days
            data = signing.loads(token, salt='api-auth', max_age=60 * 60 * 24 * 7)
            user_id = data.get('user_id')
            if user_id:
                user = User.objects.get(id=user_id)
                return (user, token)
        except (signing.BadSignature, signing.SignatureExpired):
            raise AuthenticationFailed('Invalid or expired token')
        except User.DoesNotExist:
            raise AuthenticationFailed('User not found')
        
        return None
