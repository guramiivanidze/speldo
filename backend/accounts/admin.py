from django.contrib import admin
from django.utils import timezone
from .models import FriendRequest, Friendship, EmailVerificationCode, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'email_verified', 'advisor_enabled', 'created_at', 'updated_at')
    list_filter = ('email_verified', 'advisor_enabled', 'created_at')
    search_fields = ('user__username', 'user__email')
    raw_id_fields = ('user',)
    ordering = ('-created_at',)


@admin.register(EmailVerificationCode)
class EmailVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'code', 'status', 'created_at', 'expires_at', 'used_at')
    list_filter = ('used', 'created_at')
    search_fields = ('email', 'code')
    ordering = ('-created_at',)
    readonly_fields = ('email', 'code', 'created_at', 'expires_at', 'used', 'used_at')
    
    def status(self, obj):
        if obj.used:
            return '✓ Used'
        elif obj.is_expired:
            return '⏰ Expired'
        else:
            return '🟢 Active'
    status.short_description = 'Status'


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ('from_user', 'to_user', 'status', 'created_at', 'responded_at')
    list_filter = ('status', 'created_at')
    search_fields = ('from_user__username', 'to_user__username')
    raw_id_fields = ('from_user', 'to_user')
    ordering = ('-created_at',)


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ('user', 'friend', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'friend__username')
    raw_id_fields = ('user', 'friend')
    ordering = ('-created_at',)
