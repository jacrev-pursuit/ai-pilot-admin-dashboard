#!/bin/bash

# Clear all data from the human_review table
echo "🗑️  Human Review Table Cleanup Script"
echo "====================================="

# Check if BigQuery CLI is available
if ! command -v bq &> /dev/null; then
    echo "❌ BigQuery CLI (bq) is not installed or not in PATH"
    echo "Please install it with: gcloud components install bq"
    exit 1
fi

# Show current record count
echo "📊 Checking current record count..."
CURRENT_COUNT=$(bq query --use_legacy_sql=false --format=csv --quiet "SELECT COUNT(*) FROM \`pursuit-ops.pilot_agent_public.human_review\`" | tail -n 1)
echo "Current records in human_review table: $CURRENT_COUNT"

if [ "$CURRENT_COUNT" -eq 0 ]; then
    echo "✅ Table is already empty. Nothing to delete."
    exit 0
fi

# Confirmation prompt
echo ""
echo "⚠️  WARNING: This will permanently delete ALL $CURRENT_COUNT records from the human_review table!"
echo "This includes all demo ratings, feedback, and selection statuses."
echo ""
read -p "Are you sure you want to proceed? (yes/no): " -r

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Operation cancelled."
    exit 0
fi

echo ""
echo "🧹 Clearing human_review table..."

# Run the delete query
bq query --use_legacy_sql=false --quiet "DELETE FROM \`pursuit-ops.pilot_agent_public.human_review\` WHERE TRUE"

if [ $? -eq 0 ]; then
    echo "✅ Successfully deleted all records from human_review table"
    
    # Verify the table is empty
    echo "🔍 Verifying deletion..."
    FINAL_COUNT=$(bq query --use_legacy_sql=false --format=csv --quiet "SELECT COUNT(*) FROM \`pursuit-ops.pilot_agent_public.human_review\`" | tail -n 1)
    echo "Final record count: $FINAL_COUNT"
    
    if [ "$FINAL_COUNT" -eq 0 ]; then
        echo "✅ Confirmation: Table is now completely empty"
    else
        echo "⚠️  Warning: Table still contains $FINAL_COUNT records"
    fi
else
    echo "❌ Error occurred while deleting records"
    exit 1
fi

echo ""
echo "🎉 Human review table cleanup completed!" 