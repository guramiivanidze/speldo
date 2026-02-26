"""
Management command to create a new competitive season.
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from competitive.models import Season


class Command(BaseCommand):
    help = 'Create a new competitive season'

    def add_arguments(self, parser):
        parser.add_argument(
            'name',
            type=str,
            help='Season name (e.g., "Season 1")'
        )
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Duration in days (default: 90)'
        )
        parser.add_argument(
            '--start-now',
            action='store_true',
            help='Start the season immediately'
        )
        parser.add_argument(
            '--activate',
            action='store_true',
            help='Activate this season (deactivates other seasons)'
        )

    def handle(self, *args, **options):
        name = options['name']
        days = options['days']
        start_now = options['start_now']
        activate = options['activate']
        
        if Season.objects.filter(name=name).exists():
            raise CommandError(f'Season "{name}" already exists')
        
        start_date = timezone.now() if start_now else timezone.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=days)
        
        season = Season.objects.create(
            name=name,
            start_date=start_date,
            end_date=end_date,
            is_active=activate
        )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Created season "{name}"\n'
                f'  Start: {start_date}\n'
                f'  End: {end_date}\n'
                f'  Active: {activate}'
            )
        )
