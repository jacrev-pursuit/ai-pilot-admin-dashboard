#!/bin/bash

# Cloud Scheduler Setup Script for Cloud Functions Feedback Sentiment Analysis
# This script creates a Cloud Scheduler job to trigger the function daily at 6 AM

set -e  # Exit on any error

# Configuration
PROJECT_ID="pursuit-ops"
REGION="us-central1"
FUNCTION_NAME="feedback-sentiment-analysis"
JOB_NAME="hourly-feedback-analysis"
SCHEDULE="0 * * * *"  # Every hour at minute 0
TIME_ZONE="America/New_York"  # Eastern Time

echo "⏰ Setting up Cloud Scheduler job for hourly feedback analysis (Cloud Function)"

# Get the Cloud Function URL
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(httpsTrigger.url)")

if [ -z "$FUNCTION_URL" ]; then
    echo "❌ Error: Could not find Cloud Function '${FUNCTION_NAME}' in region '${REGION}'"
    echo "Please make sure the function is deployed first using the deployment script"
    exit 1
fi

echo "📍 Function URL: ${FUNCTION_URL}"

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
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${FUNCTION_URL}" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{}' \
    --oidc-service-account-email=${SA_EMAIL} \
    --description="Hourly feedback sentiment analysis (processes unprocessed feedback only)"

echo "✅ Cloud Scheduler job created successfully!"
echo ""
echo "📋 Job Details:"
echo "  Name: ${JOB_NAME}"
echo "  Schedule: ${SCHEDULE} (${TIME_ZONE}) - Every hour"
echo "  Target: ${FUNCTION_URL}"
echo "  Next run: $(gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION} --format="value(scheduleTime)")"
echo ""
echo "🧪 Test the job manually:"
echo "  gcloud scheduler jobs run ${JOB_NAME} --location=${REGION}"
echo ""
echo "📊 Monitor job executions:"
echo "  gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION}" 