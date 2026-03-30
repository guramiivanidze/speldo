from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0012_add_balancing_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdvisorConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False)),
                ('advised_player_index', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('game', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='advisor_config',
                    to='game.game',
                )),
            ],
        ),
    ]
