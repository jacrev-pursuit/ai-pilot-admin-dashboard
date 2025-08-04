-- Clear all data from the human_review table
-- This will delete all demo ratings and feedback

DELETE FROM `pursuit-ops.pilot_agent_public.human_review`
WHERE TRUE;

-- Verify the table is empty
SELECT COUNT(*) as remaining_records FROM `pursuit-ops.pilot_agent_public.human_review`; 