#!/bin/bash

# Complete Cloud Run Deployment Script for Feedback Sentiment Analysis
# This script runs the full deployment process: service account, Cloud Run, and scheduler

set -e  # Exit on any error

echo "🚀 Starting complete deployment of Feedback Sentiment Analysis to Cloud Run"
echo "=================================================================="
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if gcloud is installed
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

# Confirm project
PROJECT_ID=$(gcloud config get-value project)
echo "📋 Current project: ${PROJECT_ID}"
echo ""

# Prompt for OpenAI API key
echo "🔑 OpenAI API Key Required"
echo "You'll need to provide your OpenAI API key for the sentiment analysis."
echo "This will be securely stored as an environment variable in Cloud Run."
echo ""
read -s -p "Enter your OpenAI API key: " OPENAI_API_KEY
echo ""

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OpenAI API key is required"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Step 1: Set up service account
echo "👤 Step 1/3: Setting up service account..."
echo "================================================"
./setup-service-account.sh
echo "✅ Service account setup completed"
echo ""

# Step 2: Deploy to Cloud Run
echo "🚀 Step 2/3: Deploying to Cloud Run..."
echo "======================================="
./cloud-run-deploy.sh
echo "✅ Cloud Run deployment completed"
echo ""

# Add OpenAI API key to the service
echo "🔑 Adding OpenAI API key to the service..."
gcloud run services update feedback-sentiment-analysis \
    --region=us-central1 \
    --set-env-vars OPENAI_API_KEY="${OPENAI_API_KEY}"
echo "✅ OpenAI API key configured"
echo ""

# Step 3: Set up scheduler
echo "⏰ Step 3/3: Setting up Cloud Scheduler..."
echo "=========================================="
./setup-scheduler.sh
echo "✅ Cloud Scheduler setup completed"
echo ""

# Get service URL for testing
SERVICE_URL=$(gcloud run services describe feedback-sentiment-analysis --region=us-central1 --format="value(status.url)")

echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "====================================="
echo ""
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "🧪 Quick Tests:"
echo "  1. Health check:"
echo "     curl \"${SERVICE_URL}/health\""
echo ""
echo "  2. Manual feedback analysis:"
echo "     curl -X POST \"${SERVICE_URL}/api/analyze-feedback\" -H \"Content-Type: application/json\" -d '{}'"
echo ""
echo "  3. Test scheduler job:"
echo "     gcloud scheduler jobs run daily-feedback-analysis --location=us-central1"
echo ""
echo "📊 Monitoring:"
echo "  - Service logs: gcloud logs read --resource-type=\"cloud_run_revision\" --log-filter=\"resource.labels.service_name=feedback-sentiment-analysis\""
echo "  - Scheduler logs: gcloud logs read --resource-type=\"cloud_scheduler_job\" --log-filter=\"resource.labels.job_id=daily-feedback-analysis\""
echo ""
echo "⏰ The service will automatically analyze feedback daily at 6 AM Eastern Time"
echo "📖 For detailed documentation, see CLOUD_RUN_DEPLOYMENT.md" 