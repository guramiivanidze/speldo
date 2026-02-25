from django.contrib import admin
from django.utils.html import format_html
from .models import Game, GamePlayer, DevelopmentCard, Noble


@admin.register(DevelopmentCard)
class DevelopmentCardAdmin(admin.ModelAdmin):
    list_display = ['id', 'level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black', 'image_preview_small']
    list_filter = ['level', 'bonus', 'points']
    list_editable = ['level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black']
    ordering = ['level', 'bonus', 'id']
    search_fields = ['bonus']
    readonly_fields = ['image_preview']
    
    fieldsets = (
        ('Card Info', {
            'fields': ('level', 'bonus', 'points')
        }),
        ('Gem Costs', {
            'fields': (('cost_white', 'cost_blue', 'cost_green'), ('cost_red', 'cost_black')),
        }),
        ('Appearance', {
            'fields': ('background_image', 'image_preview'),
        }),
    )
    
    def image_preview_small(self, obj):
        if obj.background_image:
            return format_html('<img src="{}" style="max-height: 40px; max-width: 60px;" />', obj.background_image.url)
        return '-'
    image_preview_small.short_description = 'Image'
    
    def image_preview(self, obj):
        if obj.background_image:
            return format_html('<img src="{}" style="max-height: 200px;" />', obj.background_image.url)
        return 'No image uploaded'
    image_preview.short_description = 'Preview'


@admin.register(Noble)
class NobleAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'points', 'req_white', 'req_blue', 'req_green', 'req_red', 'req_black', 'image_preview_small']
    list_filter = ['points']
    list_editable = ['name', 'points', 'req_white', 'req_blue', 'req_green', 'req_red', 'req_black']
    ordering = ['id']
    readonly_fields = ['image_preview']
    
    fieldsets = (
        ('Noble Info', {
            'fields': ('name', 'points')
        }),
        ('Required Bonuses', {
            'fields': (('req_white', 'req_blue', 'req_green'), ('req_red', 'req_black')),
        }),
        ('Appearance', {
            'fields': ('background_image', 'image_preview'),
        }),
    )
    
    def image_preview_small(self, obj):
        if obj.background_image:
            return format_html('<img src="{}" style="max-height: 40px; max-width: 60px;" />', obj.background_image.url)
        return '-'
    image_preview_small.short_description = 'Image'
    
    def image_preview(self, obj):
        if obj.background_image:
            return format_html('<img src="{}" style="max-height: 200px;" />', obj.background_image.url)
        return 'No image uploaded'
    image_preview.short_description = 'Preview'


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ['code', 'status', 'max_players', 'created_at']
    list_filter = ['status']
    readonly_fields = ['id', 'created_at']


@admin.register(GamePlayer)
class GamePlayerAdmin(admin.ModelAdmin):
    list_display = ['game', 'user', 'order', 'prestige_points', 'is_online']
    list_filter = ['game__status', 'is_online']
