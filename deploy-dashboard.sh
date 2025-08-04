#!/bin/bash

# Cloud Run Deployment Script for AI Pilot Admin Dashboard
# This script deploys the full-stack React + Node.js application to Google Cloud Run

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
REGION="us-central1"
SERVICE_NAME="ai-pilot-admin-dashboard"
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

# Build the Docker image (using the root Dockerfile which builds both frontend and backend)
echo "🔨 Building Docker image for full-stack application..."
gcloud builds submit --tag ${IMAGE_NAME} .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --memory 2Gi \
    --cpu 2 \
    --timeout 3600 \
    --concurrency 100 \
    --max-instances 10 \
    --min-instances 1 \
    --set-env-vars NODE_ENV=production \
    --set-env-vars PROJECT_ID=${PROJECT_ID} \
    --set-env-vars BIGQUERY_DATASET=pilot_agent_public \
    --set-env-vars BIGQUERY_LOCATION=us-central1 \
    --allow-unauthenticated

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo "✅ Deployment completed successfully!"
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "🧪 Test the application:"
echo "  1. Open in browser: ${SERVICE_URL}"
echo "  2. Test API health: curl ${SERVICE_URL}/api/test"
echo ""
echo "📊 Monitoring:"
echo "  - View logs: gcloud logs read --resource-type=\"cloud_run_revision\" --log-filter=\"resource.labels.service_name=${SERVICE_NAME}\""
echo "  - Check service: gcloud run services describe ${SERVICE_NAME} --region=${REGION}" 