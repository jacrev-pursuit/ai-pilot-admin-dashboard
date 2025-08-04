-- Create human_review table for storing demo rating feedback
-- This table stores human evaluations of builder demos with detailed feedback

CREATE TABLE IF NOT EXISTS `your-project-id.pilot_agent_public.human_review` (
  -- Primary identifiers
  builder_id STRING NOT NULL,
  task_id STRING,
  submission_id STRING,
  
  -- Rating and feedback
  score INTEGER NOT NULL,
  technical_feedback STRING,
  business_feedback STRING,
  professional_feedback STRING,
  overall_notes STRING,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY builder_id;

-- Create indexes for better query performance
-- Note: BigQuery automatically manages clustering and partitioning, 
-- but we cluster by builder_id since that will be our most common query pattern 