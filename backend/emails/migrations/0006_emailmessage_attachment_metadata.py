from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('emails', '0005_alter_emailmessage_unique_together_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailmessage',
            name='attachment_metadata',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
