-- Add selection_status column to human_review table (3-step process for BigQuery)
-- This stores the selection decision: strong, maybe, drop, pending

-- Step 1: Add the column
ALTER TABLE `pursuit-ops.pilot_agent_public.human_review`
ADD COLUMN selection_status STRING;

-- Step 2: Set default value for the column
ALTER TABLE `pursuit-ops.pilot_agent_public.human_review`
ALTER COLUMN selection_status SET DEFAULT 'pending';

-- Step 3: Update existing rows to have the default value
UPDATE `pursuit-ops.pilot_agent_public.human_review`
SET selection_status = 'pending'
WHERE selection_status IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM `pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'human_review'
ORDER BY ordinal_position; 