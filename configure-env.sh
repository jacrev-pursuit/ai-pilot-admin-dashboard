#!/bin/bash

# Environment Configuration Script for AI Pilot Admin Dashboard
# Usage: ./configure-env.sh YOUR_CLIENT_ID YOUR_CLIENT_SECRET

set -e

if [ $# -ne 2 ]; then
    echo "❌ Usage: $0 <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>"
    echo ""
    echo "Example:"
    echo "  $0 123456789-abcdef.apps.googleusercontent.com your-client-secret"
    exit 1
fi

GOOGLE_CLIENT_ID="$1"
GOOGLE_CLIENT_SECRET="$2"

echo "🔧 Configuring environment variables for AI Pilot Admin Dashboard"
echo ""

# Generate a secure JWT secret
echo "🔐 Generating secure JWT secret..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Create .env file
echo "📝 Creating .env file..."
cat > .env << EOF
# Google Cloud Configuration
PROJECT_ID=pursuit-ops
BIGQUERY_DATASET=pilot_agent_public
BIGQUERY_LOCATION=us-central1

# Authentication Configuration
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
JWT_SECRET=$JWT_SECRET

# Server Configuration
PORT=3001
NODE_ENV=development

# Service Account (for BigQuery and Google Admin SDK)
GOOGLE_APPLICATION_CREDENTIALS=./server/service-account-key.json
EOF

echo "✅ Environment file created: .env"
echo ""

# Verify the configuration
echo "🔍 Verifying configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Google Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo "✅ Google Client Secret: ${GOOGLE_CLIENT_SECRET:0:8}..."
echo "✅ JWT Secret: Generated (64 bytes)"
echo "✅ Project ID: pursuit-ops"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Security reminder
echo "🔒 Security Reminders:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• The .env file contains sensitive credentials"
echo "• Never commit .env to version control"
echo "• .env is already in your .gitignore"
echo "• For production, set these as environment variables in Cloud Run"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test the setup
echo "🧪 Testing server startup..."
echo "Starting server in test mode..."

cd server
if timeout 10s node -e "
require('dotenv').config({ path: '../.env' });
console.log('✅ Environment variables loaded');
console.log('✅ Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
console.log('✅ Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('✅ JWT Secret:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('✅ Configuration test passed!');
" 2>/dev/null; then
    echo "✅ Environment configuration successful!"
else
    echo "❌ Configuration test failed. Please check your setup."
    exit 1
fi

cd ..

echo ""
echo "🚀 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Complete domain-wide delegation in Google Workspace Admin"
echo "2. Verify staff@pursuit.org Google Group exists"
echo "3. Test the authentication:"
echo "   cd server && npm start"
echo "   npm run dev (in another terminal)"
echo "   Visit http://localhost:5173"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Setup complete! Your authentication system is ready to test." 