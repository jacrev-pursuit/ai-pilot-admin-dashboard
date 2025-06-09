#!/bin/bash

# Cloud Functions Deployment Script for Feedback Sentiment Analysis
# This script deploys the service as a Cloud Function

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
REGION="us-central1"
FUNCTION_NAME="feedback-sentiment-analysis"

echo "🚀 Starting Cloud Functions deployment for ${FUNCTION_NAME}"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install Google Cloud CLI: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: Not authenticated with Google Cloud"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo "📋 Setting project to ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable bigquery.googleapis.com

# Deploy the Cloud Function
echo "🚀 Deploying Cloud Function..."
gcloud functions deploy ${FUNCTION_NAME} \
    --runtime nodejs18 \
    --trigger-http \
    --allow-unauthenticated \
    --region ${REGION} \
    --memory 1GB \
    --timeout 540s \
    --entry-point analyzeFeedbackHandler \
    --source . \
    --service-account feedback-analysis@${PROJECT_ID}.iam.gserviceaccount.com \
    --set-env-vars PROJECT_ID=${PROJECT_ID},BIGQUERY_DATASET=pilot_agent_public,BIGQUERY_LOCATION=us-central1,NODE_ENV=production

# Get the function URL
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(httpsTrigger.url)")

echo "✅ Deployment completed successfully!"
echo "📍 Function URL: ${FUNCTION_URL}"
echo ""
echo "Next steps:"
echo "1. Test the health endpoint: curl ${FUNCTION_URL}/health"
echo "2. Set up Cloud Scheduler job (run the scheduler setup script)"
echo "3. Add your OpenAI API key: gcloud functions deploy ${FUNCTION_NAME} --update-env-vars OPENAI_API_KEY=your_key_here --region=${REGION}" 