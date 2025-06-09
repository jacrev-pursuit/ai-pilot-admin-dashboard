#!/bin/bash

# Service Account Setup Script for Feedback Sentiment Analysis
# This script creates and configures the service account for the Cloud Run service

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
SA_NAME="feedback-analysis"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SA_DISPLAY_NAME="Feedback Sentiment Analysis Service"
SA_DESCRIPTION="Service account for running feedback sentiment analysis in Cloud Run"

echo "👤 Setting up service account for feedback sentiment analysis"

# Check if service account exists
if gcloud iam service-accounts describe ${SA_EMAIL} &>/dev/null; then
    echo "ℹ️  Service account already exists: ${SA_EMAIL}"
else
    echo "🆕 Creating service account..."
    gcloud iam service-accounts create ${SA_NAME} \
        --display-name="${SA_DISPLAY_NAME}" \
        --description="${SA_DESCRIPTION}"
fi

# Grant necessary permissions
echo "🔐 Granting permissions..."

# BigQuery permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/bigquery.jobUser"

# Cloud Run permissions (for the service to run)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.serviceAgent"

# Logging permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/logging.logWriter"

echo "✅ Service account setup completed!"
echo ""
echo "📋 Service Account Details:"
echo "  Email: ${SA_EMAIL}"
echo "  Name: ${SA_DISPLAY_NAME}"
echo ""
echo "🔐 Granted Permissions:"
echo "  - BigQuery Data Editor (to read/write data)"
echo "  - BigQuery Job User (to run queries)"
echo "  - Cloud Run Service Agent (to run the service)"
echo "  - Logging Log Writer (to write logs)"
echo ""
echo "⚠️  Important: Make sure to set the OPENAI_API_KEY environment variable"
echo "   You can do this during deployment or update the service later with:"
echo "   gcloud run services update feedback-sentiment-analysis --region=us-central1 --set-env-vars OPENAI_API_KEY=your_key_here" 