-- Test script for human_review table
-- This script inserts sample data and queries it back to verify the table works

-- Insert sample test data
INSERT INTO `your-project-id.pilot_agent_public.human_review` (
  builder_id,
  task_id,
  submission_id,
  score,
  technical_feedback,
  business_feedback,
  professional_feedback,
  overall_notes
) VALUES 
  (
    'test-builder-001',
    'task-123',
    'submission-456',
    4,
    'Good implementation of the requirements. Clean code structure and proper error handling.',
    'Shows good understanding of the business problem. User experience could be improved.',
    'Clear presentation and good communication skills. Professional demeanor throughout.',
    'Overall solid performance with room for improvement in UX design.'
  ),
  (
    'test-builder-002',
    'task-124',
    'submission-789',
    5,
    'Excellent technical implementation. Sophisticated architecture and best practices followed.',
    'Deep understanding of business requirements. Innovative solutions proposed.',
    'Outstanding presentation skills. Very professional and confident delivery.',
    'Exceptional performance across all areas. Strong candidate for advancement.'
  );

-- Query the data back to verify it was inserted correctly
SELECT 
  builder_id,
  task_id,
  score,
  technical_feedback,
  business_feedback,
  professional_feedback,
  overall_notes,
  created_at,
  updated_at
FROM `your-project-id.pilot_agent_public.human_review`
WHERE builder_id LIKE 'test-builder-%'
ORDER BY created_at DESC;

-- Get summary statistics
SELECT 
  COUNT(*) as total_reviews,
  AVG(score) as average_rating,
  MIN(score) as min_rating,
  MAX(score) as max_rating,
  COUNT(DISTINCT builder_id) as unique_builders
FROM `your-project-id.pilot_agent_public.human_review`
WHERE builder_id LIKE 'test-builder-%';

-- Clean up test data (uncomment to remove test records)
-- DELETE FROM `your-project-id.pilot_agent_public.human_review`
-- WHERE builder_id LIKE 'test-builder-%'; 