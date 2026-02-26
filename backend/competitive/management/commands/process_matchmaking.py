"""
Management command to process the matchmaking queue.
Run this periodically (e.g., every 5 seconds via cron/celery).
"""

from django.core.management.base import BaseCommand
from competitive.matchmaking import MatchmakingService


class Command(BaseCommand):
    help = 'Process the matchmaking queue and create matches'

    def add_arguments(self, parser):
        parser.add_argument(
            '--continuous',
            action='store_true',
            help='Run continuously (polls every 5 seconds)'
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=5,
            help='Polling interval in seconds (default: 5)'
        )

    def handle(self, *args, **options):
        continuous = options['continuous']
        interval = options['interval']
        
        if continuous:
            import time
            self.stdout.write('Starting continuous matchmaking processing...')
            self.stdout.write(f'Polling every {interval} seconds')
            self.stdout.write('Press Ctrl+C to stop\n')
            
            try:
                while True:
                    matches = MatchmakingService.process_queue()
                    if matches:
                        for match in matches:
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'Match created: {match.player1.user.username} vs '
                                    f'{match.player2.user.username} (Game: {match.game.code})'
                                )
                            )
                    time.sleep(interval)
            except KeyboardInterrupt:
                self.stdout.write('\nStopped matchmaking processor')
        else:
            matches = MatchmakingService.process_queue()
            
            if matches:
                for match in matches:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Match created: {match.player1.user.username} vs '
                            f'{match.player2.user.username} (Game: {match.game.code})'
                        )
                    )
            else:
                self.stdout.write('No matches created')
