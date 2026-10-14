#!/bin/bash
set -e

cd '/mnt/d/Indian Empty-Leg Flight Marketplace'

echo "Starting Supabase stack..."
docker compose -f docker-compose.supabase.yml up -d

echo "Waiting for services to be healthy..."
sleep 30

echo "Running database migrations..."
docker exec -i supabase_db_indian-empty-leg-flight-marketplace psql -U postgres < supabase/migrations/001_initial_schema.sql

echo "Seeding data..."
docker exec -i supabase_db_indian-empty-leg-flight-marketplace psql -U postgres < supabase/seed.sql

echo "Verifying data..."
docker exec supabase_db_indian-empty-leg-flight-marketplace psql -U postgres -c "SELECT count(*) FROM available_offers_view;"
docker exec supabase_db_indian-empty-leg-flight-marketplace psql -U postgres -c "SELECT count(*) FROM operators;"
docker exec supabase_db_indian-empty-leg-flight-marketplace psql -U postgres -c "SELECT count(*) FROM empty_leg_offers;"

echo "Running API tests from within WSL..."
export SUPABASE_URL="http://localhost:3000"
export ANON_KEY="${ANON_KEY:?ANON_KEY environment variable is required}"

# Test REST API
curl -s "$SUPABASE_URL/available_offers_view?select=*" -H "apikey: $ANON_KEY" | jq 'length'

echo "All checks passed!"