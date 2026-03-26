from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_add_advisor_enabled'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='userprofile',
            name='advisor_enabled',
        ),
    ]
