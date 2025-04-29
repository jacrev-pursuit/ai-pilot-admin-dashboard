console.log('Server script starting...');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const logger = require('./logger');

console.log('Required modules loaded.');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- BigQuery Client Initialization using ADC ---
const PROJECT_ID = process.env.PROJECT_ID;
const DATASET = process.env.BIGQUERY_DATASET || 'pilot_agent_public';
const BIGQUERY_LOCATION = process.env.BIGQUERY_LOCATION || 'us-central1';
// Note: GOOGLE_APPLICATION_CREDENTIALS env var should be set in Cloud Run

console.log('Credentials Configuration Check (ADC):');
console.log(`  PROJECT_ID: ${PROJECT_ID ? 'Present' : 'MISSING'}`);
console.log(`  GOOGLE_APPLICATION_CREDENTIALS (Path): ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? process.env.GOOGLE_APPLICATION_CREDENTIALS : 'MISSING/Not Set'}`);

let bigquery;
try {
  console.log('Initializing BigQuery client using ADC...');
  bigquery = new BigQuery({
    projectId: PROJECT_ID,
    location: BIGQUERY_LOCATION,
  });
  console.log('BigQuery client initialized successfully (ADC).');
} catch (error) {
  console.error('FATAL ERROR during BigQuery client initialization (ADC):\n', error);
  logger.error('FATAL ERROR during BigQuery client initialization (ADC):', { error: error.message, stack: error.stack });
  // Consider exiting if BQ is critical
  // process.exit(1);
}
// --- End BigQuery Init ---

console.log('Middleware applied.');

// --- Define Table Variables (ensure these match your dataset) ---
const metricsTable = `${PROJECT_ID}.${DATASET}.daily_builder_metrics`;
const taskAnalysisTable = `${PROJECT_ID}.${DATASET}.task_analysis_results`;
const tasksTable = `${PROJECT_ID}.${DATASET}.tasks`;
const curriculumDaysTable = `${PROJECT_ID}.${DATASET}.curriculum_days`;
const timeBlocksTable = `${PROJECT_ID}.${DATASET}.time_blocks`;
const userTaskProgressTable = `${PROJECT_ID}.${DATASET}.user_task_progress`;
const taskSubmissionsTable = `${PROJECT_ID}.${DATASET}.task_submissions`;
const peerFeedbackTable = `${PROJECT_ID}.${DATASET}.peer_feedback`;
const sentimentTable = `${PROJECT_ID}.${DATASET}.feedback_sentiment_analysis`;
const usersTable = `${PROJECT_ID}.${DATASET}.users`;
const messagesTable = `${PROJECT_ID}.${DATASET}.conversation_messages`;
const resultsTable = `${PROJECT_ID}.${DATASET}.sentiment_results`;
const outliersTable = `${PROJECT_ID}.${DATASET}.sentiment_sentence_outliers`;
const taskResponsesTable = `${PROJECT_ID}.${DATASET}.task_responses`;

// --- API Endpoints (Using OLD Query Logic) ---

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Handling request for /api/test');
  res.json({ message: 'Test route working!' });
});

// Builders endpoint (Re-applying New Task Completion % Logic)
app.get('/api/builders', async (req, res) => {
  console.log(`Handling request for /api/builders. BigQuery Client Ready: ${!!bigquery}`);
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';

  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // QUERY with updated Task Completion %
  const query = `
    WITH BaseMetrics AS (
        -- Removed task completion fields, kept others
        SELECT
            user_id,
            name,
            SUM(prompts_sent_today) as total_prompts_sent,
            SAFE_DIVIDE(SUM(sum_daily_sentiment_score_today), SUM(count_daily_sentiment_score_today)) as avg_daily_sentiment,
            SAFE_DIVIDE(SUM(sum_peer_feedback_score_today), SUM(count_peer_feedback_score_today)) as avg_peer_feedback_sentiment
        FROM \`${metricsTable}\`
        WHERE metric_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        GROUP BY user_id, name
    ),
    -- CTEs for WP/Comp Scores (Keep from previous working version)
    TaskAnalysis AS (
        SELECT user_id, learning_type,
               SAFE_CAST(JSON_EXTRACT_SCALAR(analysis, '$.completion_score') AS FLOAT64) as completion_score,
               JSON_EXTRACT_ARRAY(analysis, '$.criteria_met') as criteria_met
        FROM \`${taskAnalysisTable}\`
        WHERE curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND learning_type IN ('Work product', 'Key concept')
    ),
    FilteredTaskAnalysis AS ( 
        SELECT user_id, learning_type, completion_score
        FROM TaskAnalysis
        WHERE completion_score IS NOT NULL AND completion_score != 0
          AND NOT ( criteria_met IS NOT NULL AND ARRAY_LENGTH(criteria_met) = 1 AND JSON_VALUE(criteria_met[OFFSET(0)]) = 'Submission received' )
    ),
    WorkProductAvg AS (
        SELECT user_id, AVG(completion_score) as avg_wp_score 
        FROM FilteredTaskAnalysis WHERE learning_type = 'Work product' GROUP BY user_id
    ),
    ComprehensionAvg AS (
        SELECT user_id, AVG(completion_score) as avg_comp_score 
        FROM FilteredTaskAnalysis WHERE learning_type = 'Key concept' GROUP BY user_id
    ),
    -- NEW CTEs for Task Completion Percentage --
    EligibleTasksInRange AS (
        SELECT t.id as task_id, t.deliverable_type
        FROM \`${tasksTable}\` t
        LEFT JOIN \`${timeBlocksTable}\` tb ON t.block_id = tb.id
        LEFT JOIN \`${curriculumDaysTable}\` cd ON tb.day_id = cd.id
        WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND t.deliverable_type IN ('text', 'link')
    ),
    TotalEligibleTaskCount AS (
        SELECT COUNT(DISTINCT task_id) as total_tasks
        FROM EligibleTasksInRange
    ),
    CompletedTasksByUser AS (
        SELECT et.task_id, utp.user_id
        FROM EligibleTasksInRange et
        JOIN \`${userTaskProgressTable}\` utp ON et.task_id = utp.task_id
        WHERE et.deliverable_type = 'text' AND utp.status = 'completed'
        UNION ALL
        SELECT et.task_id, ts.user_id
        FROM EligibleTasksInRange et
        JOIN \`${taskSubmissionsTable}\` ts ON et.task_id = ts.task_id
        WHERE et.deliverable_type = 'link'
    ),
    UserCompletionCounts AS (
        SELECT user_id, COUNT(DISTINCT task_id) as completed_count
        FROM CompletedTasksByUser
        GROUP BY user_id
    )
    -- Final SELECT joining all CTEs --
    SELECT 
      bm.user_id,
      bm.name,
      -- Calculate New Task Completion Percentage (Rounded to 0) --
      ROUND((COALESCE(ucc.completed_count, 0) / NULLIF(tetc.total_tasks, 0)) * 100, 0) as tasks_completed_percentage,
      bm.total_prompts_sent as prompts_sent,
      -- Other fields (Sentiment, WP/Comp Scores) from previous working query
      CASE 
        WHEN bm.avg_daily_sentiment IS NULL THEN NULL
        WHEN bm.avg_daily_sentiment >= 0.6 THEN 'Very Positive'
        WHEN bm.avg_daily_sentiment >= 0.2 THEN 'Positive'
        WHEN bm.avg_daily_sentiment >= -0.2 THEN 'Neutral'
        WHEN bm.avg_daily_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as daily_sentiment,
      CASE 
        WHEN bm.avg_peer_feedback_sentiment IS NULL THEN NULL
        WHEN bm.avg_peer_feedback_sentiment >= 0.6 THEN 'Very Positive'
        WHEN bm.avg_peer_feedback_sentiment >= 0.2 THEN 'Positive'
        WHEN bm.avg_peer_feedback_sentiment >= -0.2 THEN 'Neutral'
        WHEN bm.avg_peer_feedback_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as peer_feedback_sentiment,
      ROUND(wp.avg_wp_score, 2) as work_product_score,
      ROUND(comp.avg_comp_score, 2) as comprehension_score
    FROM BaseMetrics bm
    LEFT JOIN WorkProductAvg wp ON bm.user_id = wp.user_id
    LEFT JOIN ComprehensionAvg comp ON bm.user_id = comp.user_id
    LEFT JOIN UserCompletionCounts ucc ON bm.user_id = ucc.user_id
    CROSS JOIN TotalEligibleTaskCount tetc -- Need total count for calculation
  `;

  const options = { query, location: BIGQUERY_LOCATION, params: { startDate, endDate } };

  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error executing BigQuery query for ${req.path}`, { error: error.message, stack: error.stack, query: options.query }); 
    res.status(500).json({ error: 'Failed to fetch builder data' });
  }
});

// Builder Details endpoint (Old Query Logic)
app.get('/api/builders/:userId/details', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { userId } = req.params;
  const { type, startDate, endDate } = req.query;

  if (!userId || !type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  let query = '';
  // OLD baseQuery logic - kept for reference in if/else, but defined within

  if (type === 'workProduct') {
    // OLD logic for workProduct - No validity filtering
    query = `
      SELECT 
        tar.task_id, t.task_title, tar.analysis, tar.curriculum_date as date,
        tar.analyzed_content -- Added analyzed_content
      FROM \`${taskAnalysisTable}\` tar
      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      WHERE tar.user_id = CAST(@userId AS INT64)
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.learning_type = 'Work product'
      ORDER BY tar.curriculum_date DESC
    `;
  } else if (type === 'comprehension') {
    // OLD logic for comprehension
    query = `
      SELECT 
        tar.task_id, t.task_title, tar.analysis, tar.curriculum_date as date,
        tar.analyzed_content -- Added analyzed_content
      FROM \`${taskAnalysisTable}\` tar
      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      WHERE tar.user_id = CAST(@userId AS INT64)
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.learning_type = 'Key concept'
      ORDER BY tar.curriculum_date DESC
    `;
  } else if (type === 'peer_feedback') {
    // OLD logic for peer_feedback
    query = `
      WITH feedback_data AS (
        SELECT 
          pf.id as feedback_id, pf.feedback_text as feedback, pf.created_at as timestamp, pf.from_user_id,
          fsa.sentiment_score, fsa.sentiment_category, fsa.summary, fsa.created_at as analysis_date
        FROM \`${peerFeedbackTable}\` pf 
        LEFT JOIN \`${sentimentTable}\` fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
        WHERE pf.to_user_id = CAST(@userId AS INT64)
          AND DATE(fsa.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate) 
      )
      SELECT 
        fd.feedback_id, fd.feedback, fd.sentiment_score, fd.sentiment_category as sentiment_label,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name, fd.summary, fd.from_user_id, fd.timestamp
      FROM feedback_data fd
      LEFT JOIN \`${usersTable}\` u ON fd.from_user_id = u.user_id
      ORDER BY fd.timestamp DESC
    `;
  } else if (type === 'prompts') {
      // OLD logic for prompts
      query = `
        SELECT DATE(created_at) as date, COUNT(message_id) as prompt_count
        FROM \`${messagesTable}\`
        WHERE user_id = CAST(@userId AS INT64)
          AND message_role = 'user'
          AND created_at BETWEEN TIMESTAMP(@startDate) AND TIMESTAMP(@endDate) -- Adjusted to TIMESTAMP if created_at is TIMESTAMP
        GROUP BY 1 ORDER BY 1 ASC
      `;
  } else if (type === 'sentiment') {
      // OLD logic for sentiment
      query = `
        WITH DailyOutliers AS (
          SELECT user_id, date, STRING_AGG(sentence_text, '; ') AS daily_sentiment_reasons
          FROM \`${outliersTable}\`
          WHERE user_id = CAST(@userId AS INT64) AND date BETWEEN DATE(@startDate) AND DATE(@endDate)
          GROUP BY user_id, date
        )
        SELECT 
          sr.date, sr.sentiment_score, sr.sentiment_category, sr.message_count, 
          do.daily_sentiment_reasons AS sentiment_reason
        FROM \`${resultsTable}\` sr
        LEFT JOIN DailyOutliers do ON sr.user_id = do.user_id AND sr.date = do.date
        WHERE sr.user_id = CAST(@userId AS INT64)
          AND sr.date BETWEEN DATE(@startDate) AND DATE(@endDate)
        ORDER BY sr.date ASC
      `;
  } else {
    return res.status(400).json({ error: 'Invalid type specified' });
  }

  const options = { query, location: BIGQUERY_LOCATION, params: { userId, startDate, endDate } };

  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error executing BigQuery details query (type: ${type})`, { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch builder details' });
  }
});

// Trends endpoints (Old Query Logic)
app.get('/api/trends/prompts', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // OLD QUERY logic
  const query = `
    SELECT DATE(cm.created_at) as date, COUNT(cm.message_id) as prompt_count
    FROM \`${messagesTable}\` cm
    INNER JOIN \`${curriculumDaysTable}\` cd ON DATE(cm.created_at) = cd.day_date
    WHERE cm.message_role = 'user'
      AND DATE(cm.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
    GROUP BY 1 ORDER BY 1 ASC
  `;
  const options = { query, location: BIGQUERY_LOCATION, params: { startDate, endDate } };
  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error executing BigQuery prompt trends query`, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch prompt trends' });
  }
});

app.get('/api/trends/sentiment', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // OLD QUERY logic
  const query = `
    SELECT DATE(date) as date, sentiment_category, COUNT(*) as count
    FROM \`${resultsTable}\`
    WHERE DATE(date) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND sentiment_category IS NOT NULL
    GROUP BY date, sentiment_category ORDER BY date ASC, sentiment_category ASC
  `;
  const options = { query, location: BIGQUERY_LOCATION, params: { startDate, endDate } };
  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error fetching sentiment trends`, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch sentiment trends' });
  }
});

app.get('/api/trends/peer-feedback', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // OLD QUERY logic
  const query = `
    SELECT DATE(created_at) as date, sentiment_category, COUNT(*) as count
    FROM \`${sentimentTable}\`
    WHERE DATE(created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND sentiment_category IS NOT NULL
    GROUP BY date, sentiment_category ORDER BY date ASC, sentiment_category ASC
  `;
  const options = { query, location: BIGQUERY_LOCATION, params: { startDate, endDate } };
  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error fetching peer feedback sentiment trends`, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch peer feedback sentiment trends' });
  }
});

// Restore old Grades/Feedback/Sentiment Details endpoints
app.get('/api/feedback/details', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { date, category } = req.query;
  if (!date || !category || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  const validCategories = ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'];
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category parameter' });

  // OLD QUERY logic
  const query = `
    SELECT pf.id as feedback_id, pf.feedback_text, pf.created_at, fsa.sentiment_category,
      CONCAT(u_from.first_name, ' ', u_from.last_name) as reviewer_name,
      CONCAT(u_to.first_name, ' ', u_to.last_name) as recipient_name
    FROM \`${peerFeedbackTable}\` pf
    JOIN \`${sentimentTable}\` fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
    LEFT JOIN \`${usersTable}\` u_from ON pf.from_user_id = u_from.user_id
    LEFT JOIN \`${usersTable}\` u_to ON pf.to_user_id = u_to.user_id
    WHERE DATE(pf.created_at) = DATE(@date)
      AND fsa.sentiment_category = @category
    ORDER BY pf.created_at DESC
  `;
  const options = { query, location: BIGQUERY_LOCATION, params: { date, category } };
  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching feedback details', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch feedback details' });
  }
});

app.get('/api/sentiment/details', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { date, category } = req.query;
  if (!date || !category || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  const validCategories = ['Positive', 'Neutral', 'Negative']; 
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category parameter' });

  // OLD QUERY logic
  const query = `
    SELECT sr.user_id, sr.sentiment_score, sr.sentiment_category, sr.message_count, sr.date,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${resultsTable}\` sr
    LEFT JOIN \`${usersTable}\` u ON sr.user_id = u.user_id
    WHERE DATE(sr.date) = DATE(@date)
      AND sr.sentiment_category = @category
    ORDER BY sr.user_id
  `;
  const options = { query, location: BIGQUERY_LOCATION, params: { date, category } };
  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching daily sentiment details', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch daily sentiment details' });
  }
});

// Restore /api/overview/grade-distribution endpoint (filters by type, groups by grade)
app.get('/api/overview/grade-distribution', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, learningType } = req.query; // Add learningType back

  // Add back validation for all params
  if (!startDate || !endDate || !learningType || !bigquery) {
      return res.status(400).json({ error: 'Missing required parameters or BQ client issue' });
  }
  if (!['Work product', 'Key concept'].includes(learningType)) {
      return res.status(400).json({ error: 'Invalid learningType' });
  }

  const query = `
    WITH ValidTasks AS (
        SELECT
            tar.task_id,
            SAFE_CAST(JSON_EXTRACT_SCALAR(analysis, '$.completion_score') AS FLOAT64) as completion_score
        FROM \`${taskAnalysisTable}\` tar
        WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND tar.learning_type = @learningType -- Filter by learning type
          -- Filter out invalid tasks --
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(analysis, '$.completion_score') AS FLOAT64) != 0
          AND NOT (
              JSON_EXTRACT_ARRAY(analysis, '$.criteria_met') IS NOT NULL AND 
              ARRAY_LENGTH(JSON_EXTRACT_ARRAY(analysis, '$.criteria_met')) = 1 AND 
              JSON_VALUE(JSON_EXTRACT_ARRAY(analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
          )
    ),
    GradedTasks AS (
        -- Assign letter grades based on 0-100 score
        SELECT
            vt.task_id,
            CASE 
                WHEN completion_score >= 93 THEN 'A+'
                WHEN completion_score >= 85 THEN 'A'
                WHEN completion_score >= 80 THEN 'A-'
                WHEN completion_score >= 70 THEN 'B+'
                WHEN completion_score >= 60 THEN 'B'
                WHEN completion_score >= 50 THEN 'B-'
                WHEN completion_score >= 40 THEN 'C+'
                ELSE 'C'
            END as grade
        FROM ValidTasks vt
    )
    -- Final count aggregation by task and grade --
    SELECT 
        t.task_title, 
        gt.grade,
        COUNT(*) as count
    FROM GradedTasks gt
    JOIN \`${tasksTable}\` t ON gt.task_id = t.id -- Join to get task title
    GROUP BY t.task_title, gt.grade -- Group by both
    -- ORDER BY t.task_title -- Optional ordering if needed
  `;

  const options = { query, location: BIGQUERY_LOCATION, params: { startDate, endDate, learningType } }; // Pass learningType

  try {
    console.log(`Executing BigQuery query for ${req.path} (Type: ${learningType})...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} (Type: ${learningType}) finished. Row count: ${rows.length}`);
    res.json(rows); // Returns array like [{ grade: 'A', count: 25 }, ...]
  } catch (error) {
    console.error(`Error in ${req.path} (Type: ${learningType}):`, error);
    logger.error('Error executing BigQuery grade distribution query', { error: error.message, stack: error.stack, learningType: learningType });
    res.status(500).json({ error: 'Failed to fetch grade distribution data' });
  }
});

// --- NEW Endpoint: Cohort Task Details --- 
app.get('/api/tasks/:taskId/cohort-details', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { taskId } = req.params;

  if (!taskId) {
      return res.status(400).json({ error: 'Missing required parameter: taskId' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // NEW QUERY: Fetch individual submissions for the given task ID
  const query = `
    SELECT 
      tar.id as analysis_id, -- Unique ID for each analysis record
      tar.task_id,
      t.task_title,
      tar.user_id,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      tar.curriculum_date AS date, -- Alias curriculum_date to 'date'
      tar.analysis -- Select the full analysis JSON string
      -- tar.grading_timestamp -- Can add if needed
    FROM \`${taskAnalysisTable}\` tar
    LEFT JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
    LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
    WHERE tar.task_id = CAST(@taskId AS INT64)
      -- Optionally keep filters for invalid/incomplete tasks if desired
      AND JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') IS NOT NULL
      AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
      AND (
           JSON_QUERY_ARRAY(tar.analysis, '$.criteria_met') IS NULL OR
           NOT (
              ARRAY_LENGTH(JSON_QUERY_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND
              JSON_VALUE(JSON_QUERY_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
           )
      )
    ORDER BY tar.curriculum_date DESC, user_name ASC -- Example ordering
  `;

  const options = { query, location: BIGQUERY_LOCATION, params: { taskId } }; 

  try {
    console.log(`Executing BigQuery query for ${req.path} (Task ID: ${taskId})...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    
    // Simply return the array of individual submission rows
    res.json(rows); 

  } catch (error) {
    console.error(`Error in ${req.path} (Task ID: ${taskId}):`, error);
    logger.error(`Error executing BigQuery cohort task details query (Task ID: ${taskId})`, { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch cohort task details' });
  }
});

// --- NEW Endpoint: List Tasks with Analyses ---
app.get('/api/tasks/list', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // Query to get distinct tasks that have at least one record in task_analysis_results
  const query = `
    SELECT DISTINCT
      t.id as task_id,
      t.task_title
    FROM \`${tasksTable}\` t
    INNER JOIN \`${taskAnalysisTable}\` tar ON t.id = tar.task_id
    -- Optional: Add filters if needed, e.g., only certain learning_types or date ranges
    -- WHERE tar.learning_type IN ('Work product', 'Key concept') 
    ORDER BY t.task_title ASC
  `;

  const options = { query, location: BIGQUERY_LOCATION };

  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows); // Returns array like [{ task_id: 1, task_title: 'Task A' }, ...]
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching task list', { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch task list' });
  }
});

// --- NEW Endpoint: Paginated Individual Task Submissions/Analyses ---
app.get('/api/tasks/:taskId/submissions', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { taskId } = req.params;
  const { page = 1, pageSize = 10 } = req.query; // Remove startDate, endDate

  // Remove date param validation
  // if (!taskId || !startDate || !endDate) {\n  //   return res.status(400).json({ error: 'Missing required parameters (taskId, startDate, endDate)' });\n  // }\n  if (!taskId) {\n    return res.status(400).json({ error: 'Missing required parameter: taskId' });\n  }\n  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });\n

  const pageNum = parseInt(page, 10) || 1;
  const sizeNum = parseInt(pageSize, 10) || 10;
  const offset = (pageNum - 1) * sizeNum;

  // Define task_threads table name (assuming it's in the same dataset)
  const taskThreadsTable = `${PROJECT_ID}.${DATASET}.task_threads`;

  // Revised query using CTEs to fetch content from different sources
  const query = `\n    WITH AnalysisBase AS (\n      SELECT\n        tar.user_id,\n        tar.task_id,\n        CONCAT(u.first_name, \' \', u.last_name) as builder_name,\n        tar.curriculum_date as date,\n        tar.analysis,\n        t.deliverable_type\n      FROM \`${taskAnalysisTable}\` tar\n      LEFT JOIN \`${usersTable}\` u ON tar.user_id = u.user_id\n      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id\n      WHERE tar.task_id = CAST(@taskId AS INT64)\n        -- Apply validity filters --\n        AND JSON_EXTRACT_SCALAR(tar.analysis, \'$.completion_score\') IS NOT NULL\n        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, \'$.completion_score\') AS FLOAT64) != 0\n        AND (\n            JSON_QUERY_ARRAY(tar.analysis, \'$.criteria_met\') IS NULL OR\n            NOT (\n                ARRAY_LENGTH(JSON_QUERY_ARRAY(tar.analysis, \'$.criteria_met\')) = 1 AND \n                JSON_VALUE(JSON_QUERY_ARRAY(tar.analysis, \'$.criteria_met\')[OFFSET(0)]) = \'Submission received\'\n            )\n        )      \n    ),\n    SubmissionContent AS (\n      SELECT task_id, user_id, content as submission_content\n      FROM \`${taskSubmissionsTable}\`\n      WHERE task_id = CAST(@taskId AS INT64)\n    ),\n    ResponseContent AS (\n      SELECT task_id, user_id, STRING_AGG(response_content ORDER BY date ASC) as response_aggregate\n      FROM \`${taskResponsesTable}\`\n      WHERE task_id = CAST(@taskId AS INT64)\n      GROUP BY task_id, user_id\n    ),\n    ConversationContent AS (\n      SELECT \n        tt.task_id, \n        tt.user_id, \n        STRING_AGG(cm.content ORDER BY cm.created_at ASC) as conversation_aggregate\n      FROM \`${taskThreadsTable}\` tt\n      JOIN \`${messagesTable}\` cm ON tt.thread_id = cm.thread_id \n      WHERE tt.task_id = CAST(@taskId AS INT64)\n        AND cm.message_role = \'user\'\n      GROUP BY tt.task_id, tt.user_id\n    ),\n    FilteredCount AS (\n      SELECT COUNT(*) as total_items\n      FROM AnalysisBase\n    )\n    -- Final selection joining all data sources\n    SELECT \n      ab.user_id,\n      ab.builder_name,\n      ab.date,\n      ab.analysis,\n      ab.deliverable_type,\n      CASE \n        WHEN ab.deliverable_type = \'link\' THEN sc.submission_content \n        WHEN ab.deliverable_type = \'text\' THEN cc.conversation_aggregate \n        ELSE rc.response_aggregate \n      END as analyzed_content,\n      fc.total_items as total_count\n    FROM AnalysisBase ab\n    LEFT JOIN SubmissionContent sc ON ab.task_id = sc.task_id AND ab.user_id = sc.user_id\n    LEFT JOIN ResponseContent rc ON ab.task_id = rc.task_id AND ab.user_id = rc.user_id\n    LEFT JOIN ConversationContent cc ON ab.task_id = cc.task_id AND ab.user_id = cc.user_id\n    CROSS JOIN FilteredCount fc \n    ORDER BY ab.date DESC, ab.builder_name ASC\n    LIMIT @limit OFFSET @offset\n  `;

  // Remove date params
  const options = { 
    query, 
    location: BIGQUERY_LOCATION, 
    params: { taskId, limit: sizeNum, offset }
  };

  try {
    console.log(`Executing BigQuery query for ${req.path} (Task ID: ${taskId}, Page: ${pageNum}, Size: ${sizeNum})...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    
    const totalCount = rows.length > 0 ? rows[0].total_count : 0;

    // Remove total_count from individual rows before sending
    const results = rows.map(({ total_count, ...rest }) => rest);

    res.json({
      submissions: results, // Array of submission objects
      pagination: {
        currentPage: pageNum,
        pageSize: sizeNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / sizeNum)
      }
    }); 

  } catch (error) {
    console.error(`Error in ${req.path} (Task ID: ${taskId}):`, error);
    logger.error('Error fetching task submissions', { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch task submissions' });
  }
});

// --- NEW Endpoint: Fetch All Task Analysis Results ---
app.get('/api/tasks/all-analysis', async (req, res) => {
  console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // TODO: Add pagination, filtering, sorting later if needed
  const query = `
    SELECT 
      tar.id as analysis_id,
      tar.task_id,
      t.task_title,
      tar.user_id,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      tar.curriculum_date AS date,
      tar.analysis, -- Select the full analysis JSON string
      tar.learning_type,
      tar.grading_timestamp
    FROM \`${taskAnalysisTable}\` tar
    LEFT JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
    LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
    -- WHERE clauses for filtering can be added here based on query params
    ORDER BY tar.grading_timestamp DESC -- Default sort: newest first
    -- LIMIT/OFFSET for pagination can be added here
  `;

  const options = { query, location: BIGQUERY_LOCATION, params: {} }; // Params can be added for filtering

  try {
    console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    console.log(`Query for ${req.path} finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error executing BigQuery all task analysis query', { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch all task analysis results' });
  }
});

// Restore static serving and fallback
const frontendDistPath = path.resolve(__dirname, '../dist');
app.use(express.static(frontendDistPath));
console.log(`Attempting to serve static files from: ${frontendDistPath}`);
app.get('*', (req, res) => {
  res.sendFile(path.resolve(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      logger.error('Error sending index.html:', { error: err.message, path: req.path });
      res.status(500).send('Internal server error loading application.');
    }
  });
});

// Only start the server if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    // logger.info(`Server started and running on port ${port}`, {
    //   port,
    //   environment: process.env.NODE_ENV || 'development'
    // });
  });
}

// Export the app for testing
module.exports = app;