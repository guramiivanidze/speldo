"""
Token authentication for REST API using signed tokens.
"""
import time
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
            # Max age is 31 days to allow for clock skew, actual expiration is in the payload
            data = signing.loads(token, salt='api-auth', max_age=60 * 60 * 24 * 31)
            
            # Check custom expiration if present
            exp = data.get('exp')
            if exp and time.time() > exp:
                raise AuthenticationFailed('Token expired')
            
            user_id = data.get('user_id')
            if user_id:
                user = User.objects.get(id=user_id)
                return (user, token)
        except signing.SignatureExpired:
            raise AuthenticationFailed('Token expired')
        except signing.BadSignature:
            raise AuthenticationFailed('Invalid token')
        except User.DoesNotExist:
            raise AuthenticationFailed('User not found')
        
        return None
