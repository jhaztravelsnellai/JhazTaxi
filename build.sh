#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Collecting static files..."
python backend/manage.py collectstatic --no-input

echo "Applying database migrations..."
python backend/manage.py migrate

echo "Initializing production database (admin account, vehicle categories, fare rules)..."
python backend/init_production.py || true

echo "Build process completed successfully!"
