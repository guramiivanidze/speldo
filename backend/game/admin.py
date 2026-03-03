from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib import messages
from import_export import resources, fields
from import_export.admin import ImportExportModelAdmin
from .models import Game, GamePlayer, DevelopmentCard, Noble, GameInvitation
from .game_logic import clear_card_cache


class DevelopmentCardResource(resources.ModelResource):
    """Resource for importing/exporting DevelopmentCard via CSV."""
    
    class Meta:
        model = DevelopmentCard
        fields = ('id', 'level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black')
        export_order = ('id', 'level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black')
        import_id_fields = ('id',)
        skip_unchanged = True
        report_skipped = True


class NobleResource(resources.ModelResource):
    """Resource for importing/exporting Noble via CSV."""
    
    class Meta:
        model = Noble
        fields = ('id', 'name', 'points', 'req_white', 'req_blue', 'req_green', 'req_red', 'req_black')
        export_order = ('id', 'name', 'points', 'req_white', 'req_blue', 'req_green', 'req_red', 'req_black')
        import_id_fields = ('id',)
        skip_unchanged = True
        report_skipped = True


@admin.register(DevelopmentCard)
class DevelopmentCardAdmin(ImportExportModelAdmin):
    resource_class = DevelopmentCardResource
    list_display = ['id', 'level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black', 'image_preview_small']
    list_filter = ['level', 'bonus', 'points']
    list_editable = ['level', 'bonus', 'points', 'cost_white', 'cost_blue', 'cost_green', 'cost_red', 'cost_black']
    ordering = ['level', 'bonus', 'id']
    search_fields = ['bonus']
    readonly_fields = ['image_preview']
    actions = ['bulk_upload_images', 'bulk_remove_images', 'bulk_upload_single_image']
    
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
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('bulk-upload-images/', self.admin_site.admin_view(self.bulk_upload_view), name='game_developmentcard_bulk_upload'),
            path('bulk-upload-single/', self.admin_site.admin_view(self.bulk_upload_single_view), name='game_developmentcard_bulk_upload_single'),
        ]
        return custom_urls + urls
    
    @admin.action(description='Bulk upload images for selected cards')
    def bulk_upload_images(self, request, queryset):
        # Store selected card IDs in session
        selected_ids = list(queryset.values_list('id', flat=True))
        request.session['bulk_upload_card_ids'] = selected_ids
        return redirect('admin:game_developmentcard_bulk_upload')
    
    @admin.action(description='Bulk remove images from selected cards')
    def bulk_remove_images(self, request, queryset):
        count = 0
        for card in queryset:
            if card.background_image:
                card.background_image.delete(save=False)
                card.background_image = None
                card.save()
                count += 1
        clear_card_cache()
        messages.success(request, f'Successfully removed images from {count} cards.')
    
    @admin.action(description='Upload single image for all selected cards')
    def bulk_upload_single_image(self, request, queryset):
        selected_ids = list(queryset.values_list('id', flat=True))
        request.session['bulk_upload_single_card_ids'] = selected_ids
        return redirect('admin:game_developmentcard_bulk_upload_single')
    
    def bulk_upload_view(self, request):
        card_ids = request.session.get('bulk_upload_card_ids', [])
        cards = DevelopmentCard.objects.filter(id__in=card_ids).order_by('level', 'bonus', 'id')
        
        if request.method == 'POST':
            uploaded_count = 0
            for card in cards:
                file_key = f'image_{card.id}'
                if file_key in request.FILES:
                    card.background_image = request.FILES[file_key]
                    card.save()
                    uploaded_count += 1
            
            clear_card_cache()
            messages.success(request, f'Successfully uploaded {uploaded_count} images.')
            # Clear session
            if 'bulk_upload_card_ids' in request.session:
                del request.session['bulk_upload_card_ids']
            return redirect('admin:game_developmentcard_changelist')
        
        context = {
            'title': 'Bulk Upload Card Images',
            'cards': cards,
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        return render(request, 'admin/game/developmentcard/bulk_upload.html', context)
    
    def bulk_upload_single_view(self, request):
        card_ids = request.session.get('bulk_upload_single_card_ids', [])
        cards = DevelopmentCard.objects.filter(id__in=card_ids).order_by('level', 'bonus', 'id')
        
        if request.method == 'POST':
            if 'single_image' in request.FILES:
                image_file = request.FILES['single_image']
                count = 0
                for card in cards:
                    # Each card gets the same image file - need to save with different name
                    from django.core.files.base import ContentFile
                    image_file.seek(0)  # Reset file pointer for each card
                    # Generate unique filename for each card
                    ext = image_file.name.split('.')[-1] if '.' in image_file.name else 'jpg'
                    new_filename = f'card_{card.id}_{card.level}_{card.bonus}.{ext}'
                    card.background_image.save(new_filename, ContentFile(image_file.read()), save=True)
                    count += 1
                
                clear_card_cache()
                messages.success(request, f'Successfully applied image to {count} cards.')
                if 'bulk_upload_single_card_ids' in request.session:
                    del request.session['bulk_upload_single_card_ids']
                return redirect('admin:game_developmentcard_changelist')
            else:
                messages.error(request, 'Please select an image file.')
        
        context = {
            'title': 'Upload Single Image for Multiple Cards',
            'cards': cards,
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        return render(request, 'admin/game/developmentcard/bulk_upload_single.html', context)
    
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
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        clear_card_cache()  # Clear cache so new images are picked up


@admin.register(Noble)
class NobleAdmin(ImportExportModelAdmin):
    resource_class = NobleResource
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
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        clear_card_cache()  # Clear cache so new images are picked up


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ['code', 'status', 'max_players', 'created_at']
    list_filter = ['status']
    readonly_fields = ['id', 'created_at']


@admin.register(GamePlayer)
class GamePlayerAdmin(admin.ModelAdmin):
    list_display = ['game', 'user', 'order', 'prestige_points', 'is_online']
    list_filter = ['game__status', 'is_online']


@admin.register(GameInvitation)
class GameInvitationAdmin(admin.ModelAdmin):
    list_display = ['id', 'game', 'from_user', 'to_user', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['from_user__username', 'to_user__username', 'game__code']
    readonly_fields = ['created_at', 'responded_at']
