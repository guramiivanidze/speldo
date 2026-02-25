# Generated data migration to seed cards and nobles
from django.db import migrations


def seed_cards(apps, schema_editor):
    DevelopmentCard = apps.get_model('game', 'DevelopmentCard')
    Noble = apps.get_model('game', 'Noble')
    
    # Level 1 cards (40 total)
    level1_cards = [
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 1, "cost_blue": 1, "cost_green": 0, "cost_red": 1, "cost_black": 1},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 0, "cost_black": 2},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 2, "cost_blue": 1, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 3},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 2, "cost_black": 0},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 1, "cost_black": 2},
        {"level": 1, "bonus": "black", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 3, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "black", "points": 1, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 4},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 1, "cost_blue": 1, "cost_green": 1, "cost_red": 1, "cost_black": 0},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 3, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 0, "cost_blue": 1, "cost_green": 0, "cost_red": 2, "cost_black": 0},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 1, "cost_blue": 2, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 1},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 2},
        {"level": 1, "bonus": "blue",  "points": 0, "cost_white": 0, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "blue",  "points": 1, "cost_white": 4, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 1, "cost_green": 1, "cost_red": 1, "cost_black": 1},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 3},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 1, "cost_green": 0, "cost_red": 0, "cost_black": 2},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 1, "cost_black": 0},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 2, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 2, "cost_black": 0},
        {"level": 1, "bonus": "white", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "white", "points": 1, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 4, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 1, "cost_blue": 1, "cost_green": 1, "cost_red": 0, "cost_black": 1},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 0, "cost_blue": 1, "cost_green": 0, "cost_red": 2, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 0, "cost_blue": 2, "cost_green": 1, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 0, "cost_black": 1},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 3, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 2, "cost_blue": 0, "cost_green": 2, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 0, "cost_white": 0, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "green", "points": 1, "cost_white": 0, "cost_blue": 4, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 1, "cost_blue": 1, "cost_green": 1, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 0, "cost_blue": 2, "cost_green": 1, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 0, "cost_blue": 1, "cost_green": 1, "cost_red": 0, "cost_black": 1},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 2, "cost_blue": 0, "cost_green": 1, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 0, "cost_blue": 2, "cost_green": 0, "cost_red": 0, "cost_black": 2},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 0, "cost_white": 3, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 1, "bonus": "red",   "points": 1, "cost_white": 0, "cost_blue": 0, "cost_green": 4, "cost_red": 0, "cost_black": 0},
    ]
    
    # Level 2 cards (30 total)
    level2_cards = [
        {"level": 2, "bonus": "black", "points": 1, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 2, "cost_black": 3},
        {"level": 2, "bonus": "black", "points": 1, "cost_white": 0, "cost_blue": 0, "cost_green": 2, "cost_red": 3, "cost_black": 0},
        {"level": 2, "bonus": "black", "points": 2, "cost_white": 1, "cost_blue": 4, "cost_green": 2, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "black", "points": 2, "cost_white": 0, "cost_blue": 0, "cost_green": 3, "cost_red": 3, "cost_black": 0},
        {"level": 2, "bonus": "black", "points": 2, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 5},
        {"level": 2, "bonus": "black", "points": 3, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 6},
        {"level": 2, "bonus": "blue",  "points": 1, "cost_white": 3, "cost_blue": 0, "cost_green": 2, "cost_red": 2, "cost_black": 0},
        {"level": 2, "bonus": "blue",  "points": 1, "cost_white": 2, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "blue",  "points": 2, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 4, "cost_black": 1},
        {"level": 2, "bonus": "blue",  "points": 2, "cost_white": 0, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 3},
        {"level": 2, "bonus": "blue",  "points": 2, "cost_white": 0, "cost_blue": 5, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "blue",  "points": 3, "cost_white": 0, "cost_blue": 6, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "white", "points": 1, "cost_white": 0, "cost_blue": 3, "cost_green": 2, "cost_red": 0, "cost_black": 2},
        {"level": 2, "bonus": "white", "points": 1, "cost_white": 2, "cost_blue": 0, "cost_green": 3, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "white", "points": 2, "cost_white": 0, "cost_blue": 4, "cost_green": 1, "cost_red": 2, "cost_black": 0},
        {"level": 2, "bonus": "white", "points": 2, "cost_white": 3, "cost_blue": 0, "cost_green": 0, "cost_red": 3, "cost_black": 0},
        {"level": 2, "bonus": "white", "points": 2, "cost_white": 5, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "white", "points": 3, "cost_white": 6, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "green", "points": 1, "cost_white": 0, "cost_blue": 2, "cost_green": 3, "cost_red": 2, "cost_black": 0},
        {"level": 2, "bonus": "green", "points": 1, "cost_white": 2, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 3},
        {"level": 2, "bonus": "green", "points": 2, "cost_white": 4, "cost_blue": 2, "cost_green": 1, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "green", "points": 2, "cost_white": 0, "cost_blue": 3, "cost_green": 3, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "green", "points": 2, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 5, "cost_black": 0},
        {"level": 2, "bonus": "green", "points": 3, "cost_white": 0, "cost_blue": 0, "cost_green": 6, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "red",   "points": 1, "cost_white": 2, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 2},
        {"level": 2, "bonus": "red",   "points": 1, "cost_white": 3, "cost_blue": 0, "cost_green": 2, "cost_red": 0, "cost_black": 0},
        {"level": 2, "bonus": "red",   "points": 2, "cost_white": 0, "cost_blue": 1, "cost_green": 4, "cost_red": 0, "cost_black": 2},
        {"level": 2, "bonus": "red",   "points": 2, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 3, "cost_black": 3},
        {"level": 2, "bonus": "red",   "points": 2, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 5, "cost_black": 0},
        {"level": 2, "bonus": "red",   "points": 3, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 6, "cost_black": 0},
    ]
    
    # Level 3 cards (20 total)
    level3_cards = [
        {"level": 3, "bonus": "black", "points": 3, "cost_white": 3, "cost_blue": 5, "cost_green": 3, "cost_red": 3, "cost_black": 3},
        {"level": 3, "bonus": "black", "points": 4, "cost_white": 7, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "black", "points": 4, "cost_white": 6, "cost_blue": 3, "cost_green": 0, "cost_red": 0, "cost_black": 3},
        {"level": 3, "bonus": "black", "points": 5, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 7},
        {"level": 3, "bonus": "blue",  "points": 3, "cost_white": 3, "cost_blue": 3, "cost_green": 5, "cost_red": 0, "cost_black": 3},
        {"level": 3, "bonus": "blue",  "points": 4, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 7},
        {"level": 3, "bonus": "blue",  "points": 4, "cost_white": 0, "cost_blue": 0, "cost_green": 3, "cost_red": 3, "cost_black": 6},
        {"level": 3, "bonus": "blue",  "points": 5, "cost_white": 0, "cost_blue": 7, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "white", "points": 3, "cost_white": 3, "cost_blue": 3, "cost_green": 0, "cost_red": 5, "cost_black": 3},
        {"level": 3, "bonus": "white", "points": 4, "cost_white": 0, "cost_blue": 7, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "white", "points": 4, "cost_white": 3, "cost_blue": 6, "cost_green": 3, "cost_red": 0, "cost_black": 3},
        {"level": 3, "bonus": "white", "points": 5, "cost_white": 7, "cost_blue": 0, "cost_green": 0, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "green", "points": 3, "cost_white": 0, "cost_blue": 3, "cost_green": 3, "cost_red": 3, "cost_black": 5},
        {"level": 3, "bonus": "green", "points": 4, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 7, "cost_black": 0},
        {"level": 3, "bonus": "green", "points": 4, "cost_white": 3, "cost_blue": 0, "cost_green": 3, "cost_red": 6, "cost_black": 0},
        {"level": 3, "bonus": "green", "points": 5, "cost_white": 0, "cost_blue": 0, "cost_green": 7, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "red",   "points": 3, "cost_white": 5, "cost_blue": 3, "cost_green": 0, "cost_red": 3, "cost_black": 3},
        {"level": 3, "bonus": "red",   "points": 4, "cost_white": 0, "cost_blue": 0, "cost_green": 7, "cost_red": 0, "cost_black": 0},
        {"level": 3, "bonus": "red",   "points": 4, "cost_white": 0, "cost_blue": 3, "cost_green": 6, "cost_red": 3, "cost_black": 0},
        {"level": 3, "bonus": "red",   "points": 5, "cost_white": 0, "cost_blue": 0, "cost_green": 0, "cost_red": 7, "cost_black": 0},
    ]
    
    # Create all cards
    all_cards = level1_cards + level2_cards + level3_cards
    for card_data in all_cards:
        DevelopmentCard.objects.create(**card_data)
    
    # Nobles (10 total)
    nobles = [
        {"points": 3, "req_white": 3, "req_blue": 3, "req_green": 3, "req_red": 0, "req_black": 0},
        {"points": 3, "req_white": 3, "req_blue": 3, "req_green": 0, "req_red": 0, "req_black": 3},
        {"points": 3, "req_white": 0, "req_blue": 3, "req_green": 3, "req_red": 3, "req_black": 0},
        {"points": 3, "req_white": 0, "req_blue": 0, "req_green": 3, "req_red": 3, "req_black": 3},
        {"points": 3, "req_white": 3, "req_blue": 0, "req_green": 0, "req_red": 3, "req_black": 3},
        {"points": 3, "req_white": 4, "req_blue": 4, "req_green": 0, "req_red": 0, "req_black": 0},
        {"points": 3, "req_white": 4, "req_blue": 0, "req_green": 0, "req_red": 0, "req_black": 4},
        {"points": 3, "req_white": 0, "req_blue": 4, "req_green": 4, "req_red": 0, "req_black": 0},
        {"points": 3, "req_white": 0, "req_blue": 0, "req_green": 4, "req_red": 4, "req_black": 0},
        {"points": 3, "req_white": 0, "req_blue": 0, "req_green": 0, "req_red": 4, "req_black": 4},
    ]
    
    for noble_data in nobles:
        Noble.objects.create(**noble_data)


def reverse_seed(apps, schema_editor):
    DevelopmentCard = apps.get_model('game', 'DevelopmentCard')
    Noble = apps.get_model('game', 'Noble')
    DevelopmentCard.objects.all().delete()
    Noble.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('game', '0003_card_noble_models'),
    ]

    operations = [
        migrations.RunPython(seed_cards, reverse_seed),
    ]
