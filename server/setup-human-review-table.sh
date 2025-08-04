#!/bin/bash

# Setup script for creating the human_review table in BigQuery
# This script creates the table and verifies it was created successfully

echo "Setting up human_review table in BigQuery..."

# Load environment variables
if [ -f "../.env" ]; then
    source ../.env
    echo "Loaded environment variables from .env"
else
    echo "Warning: .env file not found. Make sure PROJECT_ID and BIGQUERY_DATASET are set."
fi

# Set default values if not provided
PROJECT_ID=${PROJECT_ID:-"your-project-id"}
DATASET=${BIGQUERY_DATASET:-"pilot_agent_public"}

echo "Project ID: $PROJECT_ID"
echo "Dataset: $DATASET"

# Replace placeholders in SQL file
sed "s/your-project-id/$PROJECT_ID/g" create-human-review-table.sql > temp-create-table.sql

echo "Creating human_review table..."

# Execute the SQL file
bq query \
    --use_legacy_sql=false \
    --project_id="$PROJECT_ID" \
    < temp-create-table.sql

if [ $? -eq 0 ]; then
    echo "✅ human_review table created successfully!"
    
    # Verify table was created
    echo "Verifying table schema..."
    bq show --schema --format=prettyjson "$PROJECT_ID:$DATASET.human_review"
    
    echo ""
    echo "🎉 Setup complete! The human_review table is ready to use."
    echo ""
    echo "Table details:"
    echo "- Project: $PROJECT_ID"
    echo "- Dataset: $DATASET"
    echo "- Table: human_review"
    echo "- Clustered by: builder_id"
    echo ""
    echo "You can now use the demo rating feature in the June L2 Selections tab!"
    
else
    echo "❌ Error creating table. Please check your BigQuery permissions and project settings."
    exit 1
fi

# Clean up temp file
rm -f temp-create-table.sql

echo "Script completed." 