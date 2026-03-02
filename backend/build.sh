#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run migrations
python manage.py migrate


python manage.py createsuperuser --no-input --username superuser --email superuser@example.com --password Skullbusher123