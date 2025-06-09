#!/bin/bash

# Setup Google Drive API access for BigQuery external tables
# Run this script to enable Drive API and configure the service account

set -e

PROJECT_ID="pursuit-ops"
SERVICE_ACCOUNT_EMAIL="bq-nlp@pursuit-ops.iam.gserviceaccount.com"

echo "🔧 Setting up Google Drive API access for BigQuery external tables..."
echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Step 1: Enable Google Drive API
echo "1️⃣ Enabling Google Drive API..."
gcloud services enable drive.googleapis.com --project=$PROJECT_ID
echo "✅ Google Drive API enabled"
echo ""

# Step 2: Enable Google Sheets API (often needed for external tables)
echo "2️⃣ Enabling Google Sheets API..."
gcloud services enable sheets.googleapis.com --project=$PROJECT_ID
echo "✅ Google Sheets API enabled"
echo ""

# Step 3: Check current service account roles
echo "3️⃣ Current service account roles:"
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:$SERVICE_ACCOUNT_EMAIL"
echo ""

# Step 4: Add necessary roles for BigQuery external tables
echo "4️⃣ Adding necessary roles for BigQuery external tables..."

# BigQuery Data Editor (to read external tables)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/bigquery.dataEditor"

# BigQuery User (to run queries)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/bigquery.user"

# Storage Object Viewer (for external data sources)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.objectViewer"

echo "✅ Service account roles configured"
echo ""

# Step 5: Instructions for Google Sheet access
echo "5️⃣ MANUAL STEP REQUIRED: Grant access to the Google Sheet"
echo ""
echo "To complete the setup, you need to:"
echo "1. Open the Google Sheet that contains the enrollments data"
echo "2. Click 'Share' in the top right"
echo "3. Add this email as a Viewer: $SERVICE_ACCOUNT_EMAIL"
echo "4. Make sure the permission is set to 'Viewer' (not Editor)"
echo ""
echo "The Google Sheet URL is likely something like:"
echo "https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit"
echo ""

# Step 6: Test the configuration
echo "6️⃣ Testing BigQuery access..."
bq query --use_legacy_sql=false \
  "SELECT table_name, table_type FROM \`$PROJECT_ID.pilot_agent_public.INFORMATION_SCHEMA.TABLES\` WHERE table_name = 'enrollments'"

echo ""
echo "🎉 Setup complete! After adding the service account to the Google Sheet,"
echo "your enrollments table should work properly."
echo ""
echo "To test, run: cd server && node test-enrollments.js" 