#!/bin/bash

# Complete Cloud Functions Deployment Script for Feedback Sentiment Analysis
# This script runs the full deployment process: service account, Cloud Function, and scheduler

set -e  # Exit on any error

echo "🚀 Starting complete Cloud Functions deployment for Feedback Sentiment Analysis"
echo "==============================================================================="
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
echo "This will be securely stored as an environment variable in Cloud Functions."
echo ""
read -s -p "Enter your OpenAI API key: " OPENAI_API_KEY
echo ""

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OpenAI API key is required"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Configuration
REGION="us-central1"
FUNCTION_NAME="feedback-sentiment-analysis"
JOB_NAME="hourly-feedback-analysis"

# Step 1: Set up service account
echo "👤 Step 1/3: Setting up service account..."
echo "================================================"
./setup-service-account.sh
echo "✅ Service account setup completed"
echo ""

# Step 2: Deploy Cloud Function
echo "🚀 Step 2/3: Deploying Cloud Function..."
echo "========================================"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable bigquery.googleapis.com

# Install dependencies
echo "📦 Installing dependencies..."
npm install

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
    --set-env-vars PROJECT_ID=${PROJECT_ID},BIGQUERY_DATASET=pilot_agent_public,BIGQUERY_LOCATION=us-central1,NODE_ENV=production,OPENAI_API_KEY="${OPENAI_API_KEY}"

echo "✅ Cloud Function deployment completed"
echo ""

# Step 3: Set up scheduler
echo "⏰ Step 3/3: Setting up Cloud Scheduler..."
echo "=========================================="

# Get the Cloud Function URL
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(httpsTrigger.url)")

# Create service account for scheduler if it doesn't exist
SA_EMAIL="cloud-scheduler-feedback@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe ${SA_EMAIL} &>/dev/null; then
    echo "👤 Creating service account for scheduler..."
    gcloud iam service-accounts create cloud-scheduler-feedback \
        --display-name="Cloud Scheduler for Feedback Analysis" \
        --description="Service account used by Cloud Scheduler to trigger feedback sentiment analysis"
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/cloudfunctions.invoker"
else
    echo "👤 Service account already exists: ${SA_EMAIL}"
fi

# Delete existing job if it exists
if gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION} &>/dev/null; then
    echo "🗑️  Deleting existing scheduler job..."
    gcloud scheduler jobs delete ${JOB_NAME} --location=${REGION} --quiet
fi

# Create the new scheduler job
echo "🆕 Creating new scheduler job..."
gcloud scheduler jobs create http ${JOB_NAME} \
    --location=${REGION} \
    --schedule="0 * * * *" \
    --time-zone="America/New_York" \
    --uri="${FUNCTION_URL}" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{}' \
    --oidc-service-account-email=${SA_EMAIL} \
    --description="Hourly feedback sentiment analysis (processes unprocessed feedback only)"

echo "✅ Cloud Scheduler setup completed"
echo ""

echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "====================================="
echo ""
echo "📍 Function URL: ${FUNCTION_URL}"
echo ""
echo "🧪 Quick Tests:"
echo "  1. Health check:"
echo "     curl \"${FUNCTION_URL}\""
echo ""
echo "  2. Manual feedback analysis:"
echo "     curl -X POST \"${FUNCTION_URL}\" -H \"Content-Type: application/json\" -d '{}'"
echo ""
echo "  3. Test scheduler job:"
echo "     gcloud scheduler jobs run ${JOB_NAME} --location=${REGION}"
echo ""
echo "📊 Monitoring:"
echo "  - Function logs: gcloud functions logs read ${FUNCTION_NAME} --region=${REGION}"
echo "  - Scheduler logs: gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION}"
echo ""
echo "⏰ The function will automatically analyze feedback HOURLY"
echo "📖 This approach is much simpler and more reliable than containers!" 