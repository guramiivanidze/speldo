#!/bin/bash
# Start the Splendor Online backend (Django + Daphne)
set -e
cd "$(dirname "$0")/backend"
source venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate --run-syncdb
daphne -b 0.0.0.0 -p 8000 splendor.asgi:application
