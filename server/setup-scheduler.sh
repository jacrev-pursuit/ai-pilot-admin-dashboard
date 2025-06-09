#!/bin/bash

# Cloud Scheduler Setup Script for Feedback Sentiment Analysis
# This script creates a Cloud Scheduler job to trigger the analysis daily at 6 AM

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
REGION="us-central1"
SERVICE_NAME="feedback-sentiment-analysis"
JOB_NAME="daily-feedback-analysis"
SCHEDULE="0 6 * * *"  # 6 AM daily (UTC)
TIME_ZONE="America/New_York"  # Eastern Time

echo "⏰ Setting up Cloud Scheduler job for daily feedback analysis"

# Get the Cloud Run service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

if [ -z "$SERVICE_URL" ]; then
    echo "❌ Error: Could not find Cloud Run service '${SERVICE_NAME}' in region '${REGION}'"
    echo "Please make sure the service is deployed first using the deployment script"
    exit 1
fi

echo "📍 Service URL: ${SERVICE_URL}"

# Create or update the Cloud Scheduler job
echo "📅 Creating/updating Cloud Scheduler job..."

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
        --role="roles/run.invoker"
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
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${SERVICE_URL}/api/analyze-feedback" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{}' \
    --oidc-service-account-email=${SA_EMAIL} \
    --description="Daily feedback sentiment analysis at 6 AM Eastern Time"

echo "✅ Cloud Scheduler job created successfully!"
echo ""
echo "📋 Job Details:"
echo "  Name: ${JOB_NAME}"
echo "  Schedule: ${SCHEDULE} (${TIME_ZONE})"
echo "  Target: ${SERVICE_URL}/api/analyze-feedback"
echo "  Next run: $(gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION} --format="value(scheduleTime)")"
echo ""
echo "🧪 Test the job manually:"
echo "  gcloud scheduler jobs run ${JOB_NAME} --location=${REGION}"
echo ""
echo "📊 Monitor job executions:"
echo "  gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION}" 