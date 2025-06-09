# Cloud Run Deployment Guide - Feedback Sentiment Analysis

This guide walks you through deploying the feedback sentiment analysis service to Google Cloud Run with automated daily scheduling at 6 AM Eastern Time.

## Overview

The deployment creates:
- A Cloud Run service that analyzes peer feedback sentiment using OpenAI GPT-3.5-turbo
- A Cloud Scheduler job that triggers the analysis daily at 6 AM ET
- Proper service accounts and IAM permissions
- Health check endpoints for monitoring

## Prerequisites

1. **Google Cloud CLI installed and authenticated**
   ```bash
   # Install gcloud CLI if not already installed
   # https://cloud.google.com/sdk/docs/install
   
   # Authenticate
   gcloud auth login
   
   # Set your project
   gcloud config set project pursuit-ops
   ```

2. **OpenAI API Key**
   - You'll need your OpenAI API key for the sentiment analysis
   - This will be set as an environment variable during deployment

3. **Required permissions**
   - Cloud Run Admin
   - Cloud Scheduler Admin
   - Service Account Admin
   - IAM Admin

## Deployment Steps

### Step 1: Set up the Service Account

```bash
cd server
chmod +x setup-service-account.sh
./setup-service-account.sh
```

This creates a service account with the necessary permissions:
- BigQuery Data Editor (to read/write feedback data)
- BigQuery Job User (to run analysis queries)
- Cloud Run Service Agent (to run the service)
- Logging Log Writer (to write application logs)

### Step 2: Deploy to Cloud Run

```bash
chmod +x cloud-run-deploy.sh
./cloud-run-deploy.sh
```

This script will:
- Enable required Google Cloud APIs
- Build the Docker image using Cloud Build
- Deploy the service to Cloud Run with optimized settings
- Configure environment variables

**Note:** You'll need to add your OpenAI API key after deployment:

```bash
gcloud run services update feedback-sentiment-analysis \
    --region=us-central1 \
    --set-env-vars OPENAI_API_KEY=your_openai_api_key_here
```

### Step 3: Set up Daily Scheduling

```bash
chmod +x setup-scheduler.sh
./setup-scheduler.sh
```

This creates a Cloud Scheduler job that:
- Runs daily at 6 AM Eastern Time
- Triggers the `/api/analyze-feedback` endpoint
- Uses OIDC authentication for security
- Includes proper error handling and logging

## Testing the Deployment

### 1. Test the Health Endpoint

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe feedback-sentiment-analysis --region=us-central1 --format="value(status.url)")

# Test health check
curl "${SERVICE_URL}/health"
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-04-17T10:00:00.000Z",
  "service": "ai-pilot-feedback-analysis"
}
```

### 2. Test the Feedback Analysis Endpoint

```bash
# Manual trigger (processes yesterday's feedback)
curl -X POST "${SERVICE_URL}/api/analyze-feedback" \
     -H "Content-Type: application/json" \
     -d '{}'
```

Expected response:
```json
{
  "success": true,
  "message": "Feedback sentiment analysis completed successfully",
  "date": "2024-04-16",
  "timestamp": "2024-04-17T10:00:00.000Z"
}
```

### 3. Test the Scheduler Job

```bash
# Manually trigger the scheduled job
gcloud scheduler jobs run daily-feedback-analysis --location=us-central1

# Check job status
gcloud scheduler jobs describe daily-feedback-analysis --location=us-central1
```

## Monitoring and Maintenance

### View Logs

```bash
# Cloud Run service logs
gcloud logs read --resource-type="cloud_run_revision" --log-filter="resource.labels.service_name=feedback-sentiment-analysis"

# Scheduler job logs
gcloud logs read --resource-type="cloud_scheduler_job" --log-filter="resource.labels.job_id=daily-feedback-analysis"
```

### Monitor Job Executions

```bash
# Check scheduler job details and next run time
gcloud scheduler jobs describe daily-feedback-analysis --location=us-central1

# List recent job executions
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=daily-feedback-analysis" --limit=10 --format="table(timestamp,severity,textPayload)"
```

### Update Environment Variables

```bash
# Add or update environment variables
gcloud run services update feedback-sentiment-analysis \
    --region=us-central1 \
    --set-env-vars OPENAI_API_KEY=new_key,OTHER_VAR=value

# View current environment variables
gcloud run services describe feedback-sentiment-analysis \
    --region=us-central1 \
    --format="export" | grep env:
```

## Architecture Details

### Service Configuration
- **Memory**: 1GB (sufficient for OpenAI API calls and BigQuery operations)
- **CPU**: 1 vCPU
- **Timeout**: 1 hour (3600 seconds) for large batches
- **Concurrency**: 10 requests per instance
- **Max instances**: 3 (prevents overwhelming OpenAI API)

### Scheduler Configuration
- **Schedule**: `0 6 * * *` (6 AM daily)
- **Timezone**: America/New_York (Eastern Time)
- **Authentication**: OIDC with dedicated service account
- **Retry**: Automatic retries on failure

### Security
- Service uses dedicated service accounts with minimal required permissions
- OIDC authentication between Scheduler and Cloud Run
- Environment variables for sensitive data (API keys)
- No public internet access required (uses Google Cloud internal services)

## Troubleshooting

### Common Issues

1. **"Invalid JWT Signature" errors**
   - Check that the service account has proper BigQuery permissions
   - Verify the service is using the correct service account

2. **OpenAI API errors**
   - Confirm the OPENAI_API_KEY environment variable is set correctly
   - Check your OpenAI account has sufficient credits

3. **Scheduler not triggering**
   - Verify the Cloud Scheduler API is enabled
   - Check that the scheduler service account has `roles/run.invoker` permission

4. **Memory or timeout issues**
   - Monitor logs for memory usage
   - Consider increasing memory allocation if processing large batches
   - Adjust timeout settings if needed

### Log Analysis

```bash
# Filter for errors
gcloud logs read --resource-type="cloud_run_revision" \
    --log-filter="resource.labels.service_name=feedback-sentiment-analysis AND severity>=ERROR" \
    --limit=20

# Filter for specific operations
gcloud logs read --resource-type="cloud_run_revision" \
    --log-filter="resource.labels.service_name=feedback-sentiment-analysis AND textPayload:\"feedback sentiment analysis\"" \
    --limit=10
```

## Cost Optimization

- The service runs only when triggered (no idle costs)
- Memory and CPU are optimized for the workload
- Max instances limit prevents unexpected scaling costs
- BigQuery costs are minimal for the data volumes involved

## Maintenance

### Regular Tasks
1. Monitor scheduler job execution logs weekly
2. Check service health endpoint daily
3. Review OpenAI API usage monthly
4. Update dependencies quarterly

### Updates
To deploy code changes:
```bash
# Make your changes, then redeploy
./cloud-run-deploy.sh
```

The scheduler will automatically use the updated service. 