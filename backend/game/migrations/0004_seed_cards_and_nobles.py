# Generated data migration to seed cards and nobles
from django.db import migrations


def seed_cards(apps, schema_editor):
    # Cards and nobles are now seeded via management command
    pass


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('game', '0003_card_noble_models'),
    ]

    operations = [
        migrations.RunPython(seed_cards, reverse_seed),
    ]
