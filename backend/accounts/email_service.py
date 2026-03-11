"""
Email service using Brevo API for sending verification codes.
OTP codes are stored in the database and visible in Django admin.
"""
import random
import time
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.utils import timezone
import os

# Brevo (Sendinblue) API
try:
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
except ImportError:
    sib_api_v3_sdk = None
    ApiException = Exception


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
    Send verification email via Brevo API.
    Also saves the OTP to database for admin visibility.
    Returns (success, error_message).
    """
    # Always save to DB for admin visibility
    save_otp_to_db(email, otp)

    # Check for DEBUG mode
    is_debug = getattr(settings, 'DEBUG', False)
    print(f"[EMAIL] Attempting to send to {email}")
    if is_debug:
        print(f"[DEV MODE] Verification code for {email}: {otp} (static: 123456)")
        return True, ''

    # Brevo API configuration
    brevo_api_key = os.environ.get('BREVO_API_KEY') or getattr(settings, 'BREVO_API_KEY', None)
    brevo_sender = os.environ.get('BREVO_SENDER_EMAIL') or getattr(settings, 'BREVO_SENDER_EMAIL', None)

    if not brevo_api_key or not brevo_sender:
        print(f"[EMAIL ERROR] Brevo not configured! API_KEY={bool(brevo_api_key)}, SENDER={bool(brevo_sender)}")
        return False, 'Email service not configured. Please set BREVO_API_KEY and BREVO_SENDER_EMAIL.'

    if not sib_api_v3_sdk:
        print("[EMAIL ERROR] sib_api_v3_sdk package not installed!")
        return False, 'Brevo SDK not installed. Run: pip install sib-api-v3-sdk'

    print("[EMAIL] Using Brevo API for email delivery.")
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = brevo_api_key
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

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

    email_obj = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": email}],
        sender={"email": brevo_sender},
        subject=f"Your Spledor verification code: {otp}",
        html_content=html_content,
        text_content=text_content
    )

    try:
        api_instance.send_transac_email(email_obj)
        print(f"[EMAIL] Brevo: Successfully sent verification email to {email}")
        return True, ''
    except ApiException as e:
        print(f"[EMAIL ERROR] Brevo API error: {e}")
        return False, f'Failed to send email. Please try again.'
    except Exception as e:
        print(f"[EMAIL ERROR] Brevo general error: {e}")
        return False, f'Failed to send email. Please try again.'
