#!/bin/bash

# Cloud Run Deployment Script for Feedback Sentiment Analysis
# This script deploys the service to Google Cloud Run

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
REGION="us-central1"
SERVICE_NAME="feedback-sentiment-analysis"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Starting Cloud Run deployment for ${SERVICE_NAME}"

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
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

# Build the Docker image
echo "🔨 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME} .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --memory 1Gi \
    --cpu 1 \
    --timeout 3600 \
    --concurrency 10 \
    --max-instances 3 \
    --set-env-vars NODE_ENV=production \
    --set-env-vars PROJECT_ID=${PROJECT_ID} \
    --set-env-vars BIGQUERY_DATASET=pilot_agent_public \
    --set-env-vars BIGQUERY_LOCATION=us-central1 \
    --service-account feedback-analysis@${PROJECT_ID}.iam.gserviceaccount.com

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo "✅ Deployment completed successfully!"
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "1. Test the health endpoint: curl ${SERVICE_URL}/health"
echo "2. Set up Cloud Scheduler job (run the scheduler setup script)"
echo "3. Test the feedback analysis endpoint manually if needed" 