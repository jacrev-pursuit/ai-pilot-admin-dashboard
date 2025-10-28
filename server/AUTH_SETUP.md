# Authentication Setup Guide

## Overview
This guide will help you set up Google OAuth authentication with Google Groups authorization for the AI Pilot Admin Dashboard.

## Prerequisites
- Google Cloud Console access
- Admin access to Pursuit.org Google Workspace
- Service account with appropriate permissions

## Step 1: Google OAuth Setup

### 1.1 Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `pursuit-ops`
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen if not done already
6. Set application type to **Web application**
7. Add authorized redirect URIs:
   - For development: `http://localhost:3001/auth/google/callback`
   - For production: `https://your-domain.com/auth/google/callback`

### 1.2 Enable Required APIs
Enable these APIs in Google Cloud Console:
- Google+ API (for user profile)
- Admin SDK API (for group membership checking)

## Step 2: Service Account Configuration

### 2.1 Update Service Account Permissions
Your existing service account needs additional scopes:
- `https://www.googleapis.com/auth/admin.directory.group.readonly`

### 2.2 Domain-wide Delegation
1. Go to **Google Workspace Admin Console**
2. Navigate to **Security** > **API Controls** > **Domain-wide Delegation**
3. Add your service account client ID
4. Add the required scope: `https://www.googleapis.com/auth/admin.directory.group.readonly`

## Step 3: Environment Variables

Create a `.env` file in the project root with:

```bash
# Google Cloud Configuration
PROJECT_ID=pursuit-ops
BIGQUERY_DATASET=pilot_agent_public
BIGQUERY_LOCATION=us-central1

# Authentication Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=your-secure-jwt-secret-key-change-in-production

# Server Configuration
PORT=3001
NODE_ENV=development

# Service Account (for BigQuery and Google Admin SDK)
GOOGLE_APPLICATION_CREDENTIALS=./server/service-account-key.json
```

## Step 4: Group Configuration

### 4.1 Verify Google Group
Ensure the `staff@pursuit.org` Google Group exists and contains the users who should have access.

### 4.2 Test Group Membership
You can test group membership using the Google Admin Console or by running the authentication flow.

## Step 5: Security Configuration

### 5.1 JWT Secret
Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5.2 Production URLs
For production deployment, update:
- OAuth redirect URIs in Google Cloud Console
- CORS settings if needed
- Environment variables in your deployment platform

## Step 6: Testing

### 6.1 Local Testing
1. Start the server: `cd server && npm start`
2. Start the frontend: `npm run dev`
3. Navigate to `http://localhost:5173`
4. You should be redirected to login
5. Click "Sign in with Google"
6. Complete OAuth flow
7. Verify you're redirected back and authenticated

### 6.2 Verify Group Checking
Test with users both inside and outside the `staff@pursuit.org` group to ensure proper access control.

## Troubleshooting

### Common Issues

1. **"Access denied: Invalid domain"**
   - User's email is not @pursuit.org
   - Check the user's Google account email

2. **"Access denied: Not a member of required group"**
   - User is not in staff@pursuit.org group
   - Add user to the group or verify group name

3. **"Error checking group membership"**
   - Service account lacks Admin SDK permissions
   - Domain-wide delegation not configured
   - Check service account key file

4. **OAuth errors**
   - Check client ID and secret
   - Verify redirect URIs match exactly
   - Ensure APIs are enabled

### Debug Mode
Set `NODE_ENV=development` to see detailed error logs.

## Security Notes

- Only users with @pursuit.org email addresses can authenticate
- Users must be members of the staff@pursuit.org Google Group
- JWT tokens expire after 24 hours
- Service account has minimal required permissions
- All API endpoints are protected by authentication middleware 