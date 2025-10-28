#!/bin/bash

# OAuth Setup Script for AI Pilot Admin Dashboard
# This script helps you set up Google OAuth authentication

set -e

PROJECT_ID="pursuit-ops"
REDIRECT_URI_DEV="http://localhost:3001/auth/google/callback"
REDIRECT_URI_PROD="https://ai-pilot-admin-dashboard-866060457933.us-central1.run.app/auth/google/callback"

echo "🔐 Setting up OAuth for AI Pilot Admin Dashboard"
echo "Project: $PROJECT_ID"
echo ""

# Step 1: Ensure required APIs are enabled
echo "📋 Step 1: Enabling required APIs..."
gcloud services enable admin.googleapis.com --project=$PROJECT_ID
gcloud services enable people.googleapis.com --project=$PROJECT_ID
gcloud services enable iamcredentials.googleapis.com --project=$PROJECT_ID
echo "✅ APIs enabled"
echo ""

# Step 2: Get service account info for domain-wide delegation
echo "📋 Step 2: Service Account Information"
echo "Looking for existing service accounts..."

# Find the service account (likely the one being used for BigQuery)
SERVICE_ACCOUNTS=$(gcloud iam service-accounts list --project=$PROJECT_ID --format="value(email)" 2>/dev/null)

if [ -z "$SERVICE_ACCOUNTS" ]; then
    echo "❌ No service accounts found. Creating one..."
    SERVICE_ACCOUNT_EMAIL="ai-pilot-admin@${PROJECT_ID}.iam.gserviceaccount.com"
    gcloud iam service-accounts create ai-pilot-admin \
        --display-name="AI Pilot Admin Dashboard" \
        --description="Service account for AI Pilot Admin Dashboard authentication" \
        --project=$PROJECT_ID
    
    # Grant necessary roles
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/admin.directory.group.readonly"
else
    echo "✅ Found existing service accounts:"
    echo "$SERVICE_ACCOUNTS"
    SERVICE_ACCOUNT_EMAIL=$(echo "$SERVICE_ACCOUNTS" | head -n1)
    echo "Using: $SERVICE_ACCOUNT_EMAIL"
fi

# Get the service account's unique ID for domain-wide delegation
SERVICE_ACCOUNT_ID=$(gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID --format="value(uniqueId)")

echo ""
echo "📝 IMPORTANT: Save this information for Google Workspace Admin setup:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Service Account Email: $SERVICE_ACCOUNT_EMAIL"
echo "Service Account ID: $SERVICE_ACCOUNT_ID"
echo "Required Scope: https://www.googleapis.com/auth/admin.directory.group.readonly"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 3: OAuth Client Creation (manual step with guidance)
echo "📋 Step 3: OAuth 2.0 Client Setup"
echo ""
echo "⚠️  OAuth 2.0 Client creation requires the Google Cloud Console web interface."
echo "    Opening the console for you..."
echo ""

# Generate the console URL
CONSOLE_URL="https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"

echo "🌐 Please complete these steps in your browser:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 📱 Configure OAuth Consent Screen (if not done):"
echo "   - User Type: Internal"
echo "   - App Name: AI Pilot Admin Dashboard"
echo "   - User support email: your email"
echo "   - Scopes: Add 'email', 'profile', 'openid'"
echo ""
echo "2. 🔑 Create OAuth 2.0 Client ID:"
echo "   - Click 'Create Credentials' > 'OAuth 2.0 Client IDs'"
echo "   - Application Type: Web application"
echo "   - Name: AI Pilot Admin Dashboard"
echo "   - Authorized redirect URIs:"
echo "     • $REDIRECT_URI_DEV"
echo "     • $REDIRECT_URI_PROD"
echo ""
echo "3. 📋 Copy the Client ID and Client Secret"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open the browser (works on macOS)
if command -v open >/dev/null 2>&1; then
    echo "🚀 Opening Google Cloud Console..."
    open "$CONSOLE_URL"
fi

echo ""
echo "📋 Step 4: Domain-wide Delegation Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  You'll also need to set up domain-wide delegation in Google Workspace Admin:"
echo ""
echo "1. Go to Google Workspace Admin Console (admin.google.com)"
echo "2. Security > API Controls > Domain-wide Delegation"
echo "3. Add new:"
echo "   - Client ID: $SERVICE_ACCOUNT_ID"
echo "   - OAuth Scopes: https://www.googleapis.com/auth/admin.directory.group.readonly"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Step 5: Environment Configuration"
echo "After getting your OAuth credentials, run:"
echo "  ./configure-env.sh YOUR_CLIENT_ID YOUR_CLIENT_SECRET"
echo ""

echo "✅ OAuth setup guidance complete!"
echo "   Continue with the web console steps above." 