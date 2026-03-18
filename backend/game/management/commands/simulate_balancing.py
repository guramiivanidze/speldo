"""
Management command to simulate games with and without balancing.

Usage:
    python manage.py simulate_balancing              # 1000 games, default
    python manage.py simulate_balancing --games 5000
    python manage.py simulate_balancing --players 3
"""

from django.core.management.base import BaseCommand

from game.balancing import simulate_games
from game.game_logic import get_card, get_noble, get_all_cards, _load_nobles


class Command(BaseCommand):
    help = 'Simulate N game setups and compare balanced vs unbalanced distributions.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--games', '-n', type=int, default=1000,
            help='Number of games to simulate (default: 1000)',
        )
        parser.add_argument(
            '--players', '-p', type=int, default=2, choices=[2, 3, 4],
            help='Number of players per game (default: 2)',
        )

    def handle(self, *args, **options):
        n = options['games']
        player_count = options['players']

        self.stdout.write(
            f'Simulating {n} games with {player_count} players...\n'
        )

        all_cards = get_all_cards()

        if not all_cards:
            self.stderr.write(self.style.ERROR(
                'No cards in database. Run migrations and seed card data first.'
            ))
            return

        all_card_ids_by_level = {
            '1': [c['id'] for c in all_cards if c['level'] == 1],
            '2': [c['id'] for c in all_cards if c['level'] == 2],
            '3': [c['id'] for c in all_cards if c['level'] == 3],
        }
        all_noble_ids = list(_load_nobles().keys())

        if not all_noble_ids:
            self.stderr.write(self.style.ERROR(
                'No nobles in database. Seed noble data first.'
            ))
            return

        results = simulate_games(
            n,
            get_card_fn=get_card,
            get_noble_fn=get_noble,
            all_card_ids_by_level=all_card_ids_by_level,
            all_noble_ids=all_noble_ids,
            player_count=player_count,
        )

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f'  Simulation Results — {n} games, {player_count} players'
        ))
        self.stdout.write('=' * 60 + '\n')

        for label in ('without_balancing', 'with_balancing'):
            data = results[label]
            total_rows = data.get('total_rows', 1) or 1
            total_games = data.get('total_games', 1) or 1

            title = label.replace('_', ' ').title()
            self.stdout.write(f'\n  {title}:')
            self.stdout.write(f'    Total rows examined:     {total_rows}')
            self.stdout.write(
                f'    3+ same color (extreme): {data.get("extreme_same_color", 0)} '
                f'({data.get("extreme_same_color", 0) / total_rows * 100:.1f}%)'
            )
            self.stdout.write(
                f'    >2 same color:           {data.get("over_2_same_color", 0)} '
                f'({data.get("over_2_same_color", 0) / total_rows * 100:.1f}%)'
            )
            self.stdout.write(
                f'    <3 unique colors:         {data.get("under_3_unique", 0)} '
                f'({data.get("under_3_unique", 0) / total_rows * 100:.1f}%)'
            )
            self.stdout.write(
                f'    Noble conflicts:          {data.get("noble_conflicts", 0)} '
                f'({data.get("noble_conflicts", 0) / total_games * 100:.1f}%)'
            )

        self.stdout.write('\n' + '=' * 60 + '\n')
