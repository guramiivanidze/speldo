from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_remove_advisor_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='advisor_enabled',
            field=models.BooleanField(
                default=False,
                help_text='When checked, this player receives AI advisor hints in every game.',
            ),
        ),
    ]
