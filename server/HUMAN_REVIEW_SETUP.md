# Human Review Table Setup

This directory contains scripts to set up the BigQuery table for storing human demo review feedback.

## Overview

The `human_review` table stores detailed feedback and ratings for builder demos, including:
- Demo ratings (1-5 stars)
- Technical feedback
- Business feedback  
- Professional feedback
- Overall notes
- Metadata (timestamps, IDs)

## Files

- `create-human-review-table.sql` - SQL script to create the table
- `setup-human-review-table.sh` - Automated setup script
- `test-human-review-table.sql` - Test script with sample data
- `HUMAN_REVIEW_SETUP.md` - This documentation

## Quick Setup

### Method 1: Automated Script (Recommended)

```bash
cd server
./setup-human-review-table.sh
```

This script will:
1. Load your environment variables
2. Create the table with proper schema
3. Verify the table was created successfully
4. Show you the table details

### Method 2: Manual SQL Execution

1. Edit `create-human-review-table.sql` and replace `your-project-id` with your actual project ID
2. Run the SQL in BigQuery console or via CLI:

```bash
bq query --use_legacy_sql=false < create-human-review-table.sql
```

## Environment Variables Required

Make sure these are set in your `.env` file:
- `PROJECT_ID` - Your Google Cloud Project ID
- `BIGQUERY_DATASET` - Your BigQuery dataset name (default: `pilot_agent_public`)

## Table Schema

```sql
human_review (
  builder_id STRING NOT NULL,           -- User ID of builder
  task_id STRING,                       -- Associated task ID
  submission_id STRING,                 -- Associated submission ID
  score INTEGER NOT NULL,               -- Rating 1-5 stars
  technical_feedback TEXT,              -- Technical evaluation
  business_feedback TEXT,               -- Business understanding
  professional_feedback TEXT,           -- Communication/presentation
  overall_notes TEXT,                   -- General notes
  created_at TIMESTAMP,                 -- When created
  updated_at TIMESTAMP                  -- When last updated
)
```

## Testing the Table

After creation, you can test the table:

```bash
# Edit test file to replace project ID
sed "s/your-project-id/YOUR_ACTUAL_PROJECT_ID/g" test-human-review-table.sql > temp-test.sql

# Run the test
bq query --use_legacy_sql=false < temp-test.sql

# Clean up
rm temp-test.sql
```

## Verifying Setup

To verify the table exists and check its schema:

```bash
bq show --schema your-project-id:pilot_agent_public.human_review
```

To see if data can be inserted:

```bash
bq query "SELECT COUNT(*) FROM \`your-project-id.pilot_agent_public.human_review\`"
```

## Troubleshooting

### Common Issues

1. **Permission denied**: Make sure you have BigQuery Data Editor role
2. **Project not found**: Verify PROJECT_ID is correct
3. **Dataset not found**: Make sure the dataset exists first

### Create Dataset First (if needed)

```bash
bq mk --dataset your-project-id:pilot_agent_public
```

### Check Your Permissions

```bash
bq ls --max_results=10 your-project-id:pilot_agent_public
```

## Integration

Once the table is created, the June L2 Selections tab will automatically:
- Save demo ratings and feedback to this table
- Load existing ratings on page load
- Display feedback history in the notes column

The API endpoints in `server/index.js` are already configured to use this table.

## Performance Notes

- Table is clustered by `builder_id` for optimal query performance
- Queries filtering by builder will be faster
- Consider partitioning by date if you expect large volumes

## Security

- Only authorized users should have access to this table
- Feedback data may contain sensitive evaluations
- Consider setting up appropriate IAM policies 