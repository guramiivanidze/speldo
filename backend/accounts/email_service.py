"""
Email service using Django SMTP for sending verification codes.
OTP codes are stored in the database and visible in Django admin.
"""
import random
import time
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.utils import timezone


# OTP settings
OTP_EXPIRY_SECONDS = 300  # 5 minutes
OTP_LENGTH = 6
DEV_STATIC_OTP = '123456'  # Static code for local development


def generate_otp():
    """Generate a 6-digit OTP code. Returns static code in DEBUG mode."""
    if getattr(settings, 'DEBUG', False):
        return DEV_STATIC_OTP
    return ''.join([str(random.randint(0, 9)) for _ in range(OTP_LENGTH)])


def create_otp_token(email: str, otp: str) -> str:
    """Create a signed token containing the OTP and email."""
    return signing.dumps({
        'email': email.lower(),
        'otp': otp,
        'exp': int(time.time()) + OTP_EXPIRY_SECONDS,
    }, salt='email-verification')


def verify_otp_token(token: str, email: str, otp: str) -> tuple[bool, str]:
    """
    Verify the OTP token.
    Returns (success, error_message).
    """
    try:
        data = signing.loads(token, salt='email-verification')
    except signing.BadSignature:
        return False, 'Invalid or expired verification code.'

    # Check expiration
    if int(time.time()) > data.get('exp', 0):
        return False, 'Verification code expired.'

    # Check email matches
    if data.get('email', '').lower() != email.lower():
        return False, 'Email does not match.'

    # Check OTP matches
    if data.get('otp') != otp:
        return False, 'Incorrect verification code.'

    return True, ''


def save_otp_to_db(email: str, otp: str):
    """Save OTP code to database for admin visibility."""
    from .models import EmailVerificationCode

    # Delete any existing unused codes for this email
    EmailVerificationCode.objects.filter(
        email=email.lower(), used=False).delete()

    # Create new code
    EmailVerificationCode.objects.create(
        email=email.lower(),
        code=otp,
        expires_at=timezone.now() + timedelta(seconds=OTP_EXPIRY_SECONDS)
    )


def send_verification_email(email: str, otp: str) -> tuple[bool, str]:
    """
    Send verification email via Django SMTP.
    Also saves the OTP to database for admin visibility.
    Returns (success, error_message).
    """
    # Always save to DB for admin visibility
    save_otp_to_db(email, otp)

    # Check if email sending is configured
    email_host = getattr(settings, 'EMAIL_HOST', '')

    if not email_host or getattr(settings, 'DEBUG', False):
        # Development mode - skip email, use static code
        print(
            f"[DEV MODE] Verification code for {email}: {otp} (static: 123456)")
        return True, ''

    # Simple, minimalistic email content
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            margin: 0;
            padding: 40px 20px;
        }}
        .container {{
            max-width: 400px;
            margin: 0 auto;
            text-align: center;
        }}
        h1 {{
            font-size: 24px;
            margin-bottom: 16px;
            color: #f8fafc;
        }}
        .code {{
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            padding: 24px 0;
        }}
        .note {{
            font-size: 14px;
            color: #94a3b8;
            margin-top: 24px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Verify your email</h1>
        <p>Your Spledor verification code is:</p>
        <div class="code">{otp}</div>
        <p class="note">This code expires in 5 minutes.</p>
    </div>
</body>
</html>
"""

    text_content = f"Your Splendor verification code is: {otp}\n\nThis code expires in 5 minutes."
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL',
                         settings.EMAIL_HOST_USER)

    try:
        send_mail(
            subject=f"Your Spledor verification code: {otp}",
            message=text_content,
            from_email=from_email,
            recipient_list=[email],
            html_message=html_content,
            fail_silently=False,
        )
        return True, ''

    except Exception as e:
        return False, f'Email service error: {str(e)}'
