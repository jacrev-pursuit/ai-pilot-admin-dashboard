const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const logger = require('./logger');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for the frontend
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files
const frontendDistPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(frontendDistPath));
logger.info(`Serving static files from: ${frontendDistPath}`);

// Create a BigQuery client
console.log('--- Initializing BigQuery client WITH explicit credentials from .env (for local testing) ---');
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  // Re-adding explicit credentials for local testing
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // Ensure newline characters in the key are handled correctly
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }
});

// Dataset name
const DATASET = 'pilot_agent_public';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;

// API endpoint to fetch builder data
app.get('/api/builders', async (req, res) => {
  console.log('--- ENTERING /api/builders ---');
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';
  
  const metricsTable = `${PROJECT_ID}.${DATASET}.daily_builder_metrics`;
  const tasksTable = `${PROJECT_ID}.${DATASET}.tasks`;
  const curriculumDaysTable = `${PROJECT_ID}.${DATASET}.curriculum_days`;
  const timeBlocksTable = `${PROJECT_ID}.${DATASET}.time_blocks`;
  const userTaskProgressTable = `${PROJECT_ID}.${DATASET}.user_task_progress`;
  const taskSubmissionsTable = `${PROJECT_ID}.${DATASET}.task_submissions`;
  const taskAnalysisTable = `${PROJECT_ID}.${DATASET}.task_analysis_results`; // Needed for WP/Comp

  // New Query with revised Task Completion % logic
  const query = `
    WITH BaseMetrics AS (
        -- Calculates basic metrics and averages EXCEPT task completion %
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
    TaskAnalysis AS ( -- Keep for WP/Comp scores
        SELECT
            user_id,
            learning_type,
            SAFE_CAST(JSON_EXTRACT_SCALAR(analysis, '$.completion_score') AS FLOAT64) as completion_score,
            JSON_EXTRACT_ARRAY(analysis, '$.criteria_met') as criteria_met
        FROM \`${taskAnalysisTable}\`
        WHERE curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND learning_type IN ('Work product', 'Key concept')
    ),
    FilteredTaskAnalysis AS ( -- Keep for WP/Comp scores
        SELECT user_id, learning_type, completion_score
        FROM TaskAnalysis
        WHERE completion_score IS NOT NULL AND completion_score != 0
          AND NOT (criteria_met IS NOT NULL AND ARRAY_LENGTH(criteria_met) = 1 AND JSON_VALUE(criteria_met[OFFSET(0)]) = 'Submission received')
    ),
    WorkProductAvg AS ( -- Keep for WP/Comp scores
        SELECT user_id, AVG(completion_score) as avg_wp_score 
        FROM FilteredTaskAnalysis WHERE learning_type = 'Work product' GROUP BY user_id
    ),
    ComprehensionAvg AS ( -- Keep for WP/Comp scores
        SELECT user_id, AVG(completion_score) as avg_comp_score 
        FROM FilteredTaskAnalysis WHERE learning_type = 'Key concept' GROUP BY user_id
    ),
    -- NEW CTEs for Task Completion Percentage --
    EligibleTasksInRange AS (
        -- Find all tasks within the selected date range, EXCLUDING type 'none'
        SELECT t.id as task_id, t.deliverable_type
        FROM \`${tasksTable}\` t
        LEFT JOIN \`${timeBlocksTable}\` tb ON t.block_id = tb.id
        LEFT JOIN \`${curriculumDaysTable}\` cd ON tb.day_id = cd.id
        WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND t.deliverable_type IN ('text', 'link') -- Exclude 'none' type
    ),
    TotalEligibleTaskCount AS (
        -- Count total distinct eligible tasks in the range
        SELECT COUNT(DISTINCT task_id) as total_tasks
        FROM EligibleTasksInRange
    ),
    CompletedTasksByUser AS (
        -- Find tasks completed by each user within the range
        SELECT et.task_id, utp.user_id
        FROM EligibleTasksInRange et
        JOIN \`${userTaskProgressTable}\` utp ON et.task_id = utp.task_id
        WHERE et.deliverable_type = 'text' AND utp.status = 'completed'
        UNION ALL
        SELECT et.task_id, ts.user_id
        FROM EligibleTasksInRange et
        JOIN \`${taskSubmissionsTable}\` ts ON et.task_id = ts.task_id
        WHERE et.deliverable_type = 'link'
        -- Note: This assumes any submission counts as complete for link tasks
    ),
    UserCompletionCounts AS (
        -- Count distinct completed tasks per user
        SELECT 
            user_id, 
            COUNT(DISTINCT task_id) as completed_count
        FROM CompletedTasksByUser
        GROUP BY user_id
    )
    -- Final SELECT joining all CTEs --
    SELECT 
      bm.user_id,
      bm.name,
      -- Calculate New Task Completion Percentage --
      ROUND((COALESCE(ucc.completed_count, 0) / NULLIF(tetc.total_tasks, 0)) * 100, 0) as tasks_completed_percentage,
      bm.total_prompts_sent as prompts_sent,
      -- Daily Sentiment (from BaseMetrics)
      CASE 
        WHEN bm.avg_daily_sentiment IS NULL THEN NULL
        WHEN bm.avg_daily_sentiment >= 0.6 THEN 'Very Positive'
        WHEN bm.avg_daily_sentiment >= 0.2 THEN 'Positive'
        WHEN bm.avg_daily_sentiment >= -0.2 THEN 'Neutral'
        WHEN bm.avg_daily_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as daily_sentiment,
      -- Peer Feedback Sentiment (from BaseMetrics)
      CASE 
        WHEN bm.avg_peer_feedback_sentiment IS NULL THEN NULL
        WHEN bm.avg_peer_feedback_sentiment >= 0.6 THEN 'Very Positive'
        WHEN bm.avg_peer_feedback_sentiment >= 0.2 THEN 'Positive'
        WHEN bm.avg_peer_feedback_sentiment >= -0.2 THEN 'Neutral'
        WHEN bm.avg_peer_feedback_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as peer_feedback_sentiment,
      -- Work Product & Comprehension Scores (from existing CTEs, scaled to 0-100)
      ROUND(wp.avg_wp_score * 100, 0) as work_product_score, -- Multiply by 100 and round
      ROUND(comp.avg_comp_score * 100, 0) as comprehension_score -- Multiply by 100 and round
    FROM BaseMetrics bm
    LEFT JOIN WorkProductAvg wp ON bm.user_id = wp.user_id
    LEFT JOIN ComprehensionAvg comp ON bm.user_id = comp.user_id
    LEFT JOIN UserCompletionCounts ucc ON bm.user_id = ucc.user_id
    CROSS JOIN TotalEligibleTaskCount tetc -- Get the total count for calculation
  `;

  const options = {
    query: query,
    params: {
      startDate: startDate,
      endDate: endDate,
    },
    location: 'us-central1',
  };

  try {
    logger.info('Executing BigQuery query for /api/builders', { query: options.query, params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully retrieved builder data', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    console.log('--- ERROR in /api/builders ---', error);
    logger.error('Error executing BigQuery query', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    if (error.code === 403) {
      return res.status(403).json({ 
        error: 'Permission denied. The service account does not have sufficient permissions to access BigQuery.',
        details: error.message
      });
    }
    
    const errorResponse = {
      message: error.message,
      code: error.code,
      errors: error.errors,
      details: error.details || 'No additional details available'
    };
    res.status(500).json({ error: errorResponse });
  }
});

// API endpoint to fetch builder details
app.get('/api/builders/:userId/details', async (req, res) => {
  const { userId } = req.params;
  const type = req.query.type;
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';
  
  if (!userId || !type) {
    return res.status(400).json({ error: 'Missing required parameters: userId and type' });
  }

  let query = '';
  const taskAnalysisTable = `${PROJECT_ID}.${DATASET}.task_analysis_results`;
  const tasksTable = `${PROJECT_ID}.${DATASET}.tasks`;
  
  // Common structure for fetching from task_analysis_results
  const baseQuery = `
    SELECT 
      tar.task_id,
      t.task_title, 
      tar.analysis, -- Select the JSON string
      tar.curriculum_date as date -- Use curriculum_date
    FROM \`${taskAnalysisTable}\` tar
    LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
    WHERE tar.user_id = CAST(@userId AS INT64)
      AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
  `;

  if (type === 'workProduct') {
    // Temporarily REMOVE filtering to debug - Fetch all WP tasks for user/date
    query = `
      WITH RelevantTasks AS (
        ${baseQuery} AND tar.learning_type = 'Work product'
      )
      SELECT * 
      FROM RelevantTasks
      ORDER BY date DESC -- Keep original ordering
    `;
  } else if (type === 'comprehension') {
    // Add similar filtering for comprehension if needed, or keep as is
    query = baseQuery + `
      AND tar.learning_type = 'Key concept'
      -- Optional: Add filtering for comprehension here if desired
      ORDER BY tar.curriculum_date DESC 
    `;
  } else if (type === 'peer_feedback') {
    // Keep existing peer_feedback logic
    const peerFeedbackTable = `${PROJECT_ID}.${DATASET}.peer_feedback`;
    const sentimentTable = `${PROJECT_ID}.${DATASET}.feedback_sentiment_analysis`;
    const usersTable = `${PROJECT_ID}.${DATASET}.users`;

    query = `
      WITH feedback_data AS (
        SELECT 
          pf.id as feedback_id,
          pf.feedback_text as feedback,
          pf.created_at as timestamp, 
          pf.from_user_id,
          fsa.sentiment_score,
          fsa.sentiment_category,
          fsa.summary,
          fsa.created_at as analysis_date -- Use sentiment analysis date if available
        FROM \`${peerFeedbackTable}\` pf 
        LEFT JOIN \`${sentimentTable}\` fsa 
          ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
        WHERE pf.to_user_id = CAST(@userId AS INT64)
          -- Filter by analysis_date OR pf.created_at if analysis not present?
          -- Using fsa.created_at (which comes from curriculum_date in the script) for consistency
          AND DATE(fsa.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate) 
      )
      SELECT 
        fd.feedback_id,
        fd.feedback,
        fd.sentiment_score,
        fd.sentiment_category as sentiment_label,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name,
        fd.summary,
        fd.from_user_id,
        fd.timestamp
      FROM feedback_data fd
      LEFT JOIN \`${usersTable}\` u 
        ON fd.from_user_id = u.user_id
      ORDER BY fd.timestamp DESC
    `;
  } else if (type === 'prompts') {
      // Query for prompts - Aggregated daily count
      const messagesTable = `${PROJECT_ID}.${DATASET}.conversation_messages`;
      query = `
        SELECT
          DATE(created_at) as date,
          COUNT(message_id) as prompt_count
        FROM \`${messagesTable}\`
        WHERE user_id = CAST(@userId AS INT64)
          AND message_role = 'user'
          AND created_at BETWEEN @startDate AND @endDate
        GROUP BY 1
        ORDER BY 1 ASC
      `;
  } else if (type === 'sentiment') {
      // Correct Query: Use sentiment_results and outliers, aggregate reasons
      const resultsTable = `${PROJECT_ID}.${DATASET}.sentiment_results`;
      const outliersTable = `${PROJECT_ID}.${DATASET}.sentiment_sentence_outliers`;
      query = `
        WITH DailyOutliers AS (
          SELECT
            user_id,
            date,
            STRING_AGG(sentence_text, '; ') AS daily_sentiment_reasons -- Aggregate sentences
          FROM \`${outliersTable}\`
          WHERE user_id = CAST(@userId AS INT64)
            AND date BETWEEN DATE(@startDate) AND DATE(@endDate)
          GROUP BY user_id, date
        )
        SELECT 
          sr.date, -- Use sr.date as date
          sr.sentiment_score, -- Use sr.sentiment_score as sentiment_score
          sr.sentiment_category, 
          sr.message_count,
          do.daily_sentiment_reasons AS sentiment_reason -- Alias aggregated reasons
        FROM \`${resultsTable}\` sr
        LEFT JOIN DailyOutliers do
          ON sr.user_id = do.user_id
          AND sr.date = do.date
        WHERE sr.user_id = CAST(@userId AS INT64)
          AND sr.date BETWEEN DATE(@startDate) AND DATE(@endDate)
          -- AND sr.sentiment_score IS NOT NULL -- Keep this filter if needed
        ORDER BY sr.date ASC -- Order by date ascending for chart
      `;
  } else {
    return res.status(400).json({ error: 'Invalid detail type specified' });
  }

  const options = {
    query: query,
    params: {
      userId: userId,
      startDate: startDate,
      endDate: endDate,
    },
    location: 'us-central1', // Specify location if needed
  };

  try {
    logger.info('Executing BigQuery details query', { endpoint: req.originalUrl, type, userId, params: options.params, query });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully retrieved builder details', { type, userId, rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    logger.error('Error executing BigQuery details query', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      type: type,
      userId: userId,
      query: query
    });
    const errorResponse = {
      message: error.message,
      code: error.code,
      errors: error.errors,
      details: error.details || 'No additional details available',
      type: type
    };
    res.status(500).json({ error: errorResponse });
  }
});

// API endpoint for daily prompt trends
app.get('/api/trends/prompts', async (req, res) => {
  console.log('--- ENTERING /api/trends/prompts ---');
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';

  const query = `
    SELECT
      DATE(cm.created_at) as date,
      COUNT(cm.message_id) as prompt_count
    FROM \`${PROJECT_ID}.${DATASET}.conversation_messages\` cm
    INNER JOIN \`${PROJECT_ID}.${DATASET}.curriculum_days\` cd
      ON DATE(cm.created_at) = cd.day_date
    WHERE
      cm.message_role = 'user'
      AND DATE(cm.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const options = {
    query: query,
    params: { startDate, endDate },
    location: 'us-central1',
  };

  try {
    logger.info('Executing BigQuery query for /api/trends/prompts', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully retrieved prompt trends', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    console.log('--- ERROR in /api/trends/prompts ---', error);
    logger.error('Error executing BigQuery prompt trends query', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to fetch prompt trends' });
  }
});

// API endpoint for daily sentiment trends
app.get('/api/trends/sentiment', async (req, res) => {
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';

  const query = `
    SELECT
      DATE(date) as date,
      sentiment_category,
      COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.sentiment_results\`
    WHERE DATE(date) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND sentiment_category IS NOT NULL
    GROUP BY date, sentiment_category
    ORDER BY date ASC, sentiment_category ASC
  `;

  const options = {
    query: query,
    params: { startDate: startDate, endDate: endDate },
    location: 'us-central1',
  };

  try {
    logger.info('Fetching sentiment trends', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully fetched sentiment trends', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    logger.error('Error fetching sentiment trends', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch sentiment trends' });
  }
});

// API endpoint for peer feedback sentiment trends
app.get('/api/trends/peer-feedback', async (req, res) => {
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';

  const query = `
    SELECT
      DATE(created_at) as date,
      sentiment_category,
      COUNT(*) as count
    FROM \`${PROJECT_ID}.${DATASET}.feedback_sentiment_analysis\`
    WHERE DATE(created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND sentiment_category IS NOT NULL
    GROUP BY date, sentiment_category
    ORDER BY date ASC, sentiment_category ASC
  `;

  const options = {
    query: query,
    params: { startDate: startDate, endDate: endDate },
    location: 'us-central1',
  };

  try {
    logger.info('Fetching peer feedback sentiment trends', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully fetched peer feedback sentiment trends', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    logger.error('Error fetching peer feedback sentiment trends', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch peer feedback sentiment trends' });
  }
});

// --- API Endpoint for Specific Feedback Details by Date and Category ---
app.get('/api/feedback/details', async (req, res) => {
  const { date, category } = req.query;

  if (!date || !category) {
    return res.status(400).json({ error: 'Missing required query parameters: date and category' });
  }

  // Validate category if needed (e.g., ensure it's one of the expected values)
  const validCategories = ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category parameter' });
  }

  const query = `
    SELECT
      pf.id as feedback_id,
      pf.feedback_text,
      pf.created_at,
      fsa.sentiment_category,
      CONCAT(u_from.first_name, ' ', u_from.last_name) as reviewer_name,
      CONCAT(u_to.first_name, ' ', u_to.last_name) as recipient_name
    FROM \`${PROJECT_ID}.${DATASET}.peer_feedback\` pf
    JOIN \`${PROJECT_ID}.${DATASET}.feedback_sentiment_analysis\` fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.users\` u_from ON pf.from_user_id = u_from.user_id
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.users\` u_to ON pf.to_user_id = u_to.user_id
    WHERE DATE(pf.created_at) = DATE(@date)
      AND fsa.sentiment_category = @category
    ORDER BY pf.created_at DESC
  `;

  const options = {
    query: query,
    params: { date: date, category: category },
    location: 'us-central1',
  };

  try {
    logger.info('Fetching feedback details', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully fetched feedback details', { rowCount: rows.length, date, category });
    res.json(rows);
  } catch (error) {
    logger.error('Error fetching feedback details', { error: error.message, stack: error.stack, date, category });
    res.status(500).json({ error: 'Failed to fetch feedback details' });
  }
});

// --- API Endpoint for Specific Daily Sentiment Details by Date and Category ---
app.get('/api/sentiment/details', async (req, res) => {
  const { date, category } = req.query;

  if (!date || !category) {
    return res.status(400).json({ error: 'Missing required query parameters: date and category' });
  }

  // Optional: Validate category
  const validCategories = ['Positive', 'Neutral', 'Negative']; // Categories used in this chart's processing
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category parameter for daily sentiment' });
  }

  const query = `
    SELECT
      sr.user_id,
      sr.sentiment_score,
      sr.sentiment_category,
      sr.message_count,
      sr.date,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${PROJECT_ID}.${DATASET}.sentiment_results\` sr
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.users\` u ON sr.user_id = u.user_id
    WHERE DATE(sr.date) = DATE(@date)
      AND sr.sentiment_category = @category
    ORDER BY sr.user_id
  `;

  const options = {
    query: query,
    params: { date: date, category: category },
    location: 'us-central1',
  };

  try {
    logger.info('Fetching daily sentiment details', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully fetched daily sentiment details', { rowCount: rows.length, date, category });
    res.json(rows);
  } catch (error) {
    logger.error('Error fetching daily sentiment details', { error: error.message, stack: error.stack, date, category });
    res.status(500).json({ error: 'Failed to fetch daily sentiment details' });
  }
});

// --- API Endpoint for Grade Distribution per Task ---
app.get('/api/grades/distribution', async (req, res) => {
  console.log('--- ENTERING /api/grades/distribution ---');
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';

  const query = `
    SELECT
      t.id as task_id,
      t.task_title,
      CAST(tr.scores AS FLOAT64) as score,
      cd.day_date as task_date
    FROM \`${PROJECT_ID}.${DATASET}.task_responses\` tr
    JOIN \`${PROJECT_ID}.${DATASET}.tasks\` t ON CAST(tr.task_id AS STRING) = CAST(t.id AS STRING)
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.time_blocks\` tb ON t.block_id = tb.id
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.curriculum_days\` cd ON tb.day_id = cd.id
    WHERE tr.grading_timestamp BETWEEN TIMESTAMP(@startDate) AND TIMESTAMP(@endDate)
      AND tr.scores IS NOT NULL
    -- ORDER BY cd.day_date, t.task_title -- Optional ordering by date then title
  `;

  const options = {
    query: query,
    params: { startDate: startDate, endDate: endDate },
    location: 'us-central1',
  };

  try {
    logger.info('[Grades Dist] Attempting BigQuery query...', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('[Grades Dist] Query successful. Rows received: ' + rows.length);
    logger.info('Successfully fetched grade distribution data', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    console.log('--- ERROR in /api/grades/distribution --- ', error);
    logger.error('[Grades Dist] Error executing BigQuery query', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        fullError: error
    });
    res.status(500).json({ error: 'Failed to fetch grade distribution data' });
  }
});

// --- API Endpoint for Specific Grade Submissions by Task, Date, and Grade ---
app.get('/api/grades/submissions', async (req, res) => {
  const { task_title, task_date, grade } = req.query;

  if (!task_title || !task_date || !grade) {
    return res.status(400).json({ error: 'Missing required query parameters: task_title, task_date, and grade' });
  }

  // Map grades to score ranges (adjust ranges as per your getLetterGrade logic)
  const gradeScoreRanges = {
    'A+': { min: 0.9, max: 1.0 },
    'A': { min: 0.8, max: 0.9 },
    'A-': { min: 0.75, max: 0.8 },
    'B+': { min: 0.7, max: 0.75 },
    'B': { min: 0.6, max: 0.7 },
    'B-': { min: 0.55, max: 0.6 },
    'C+': { min: 0.5, max: 0.55 },
    'C': { min: 0.0, max: 0.5 }, // Assuming C is the minimum passing, adjust lower bound if needed
    'F': { min: -1.0, max: 0.0 } // Assuming F is below C's lower bound
  };

  const range = gradeScoreRanges[grade];
  if (!range) {
    return res.status(400).json({ error: 'Invalid grade parameter' });
  }

  const query = `
    WITH TaskInfo AS (
      -- Find the task_id based on title and date
      SELECT
        t.id
      FROM \`${PROJECT_ID}.${DATASET}.tasks\` t
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE t.task_title = @task_title AND DATE(cd.day_date) = DATE(@task_date)
      LIMIT 1 -- Assume title + date is unique enough for this context
    )
    SELECT
      tr.user_id,
      tr.scores,
      tr.feedback,
      tr.response_content, -- Include submission content if needed
      tr.grading_timestamp,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${PROJECT_ID}.${DATASET}.task_responses\` tr
    JOIN TaskInfo ON CAST(tr.task_id AS STRING) = CAST(TaskInfo.id AS STRING)
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.users\` u ON tr.user_id = u.user_id
    WHERE tr.scores IS NOT NULL
      -- Filter based on score range for the given grade
      -- Note: Ranges are inclusive of min, exclusive of max (except for A+ and F)
      AND CAST(tr.scores AS FLOAT64) >= @min_score
      AND CAST(tr.scores AS FLOAT64) < @max_score
      ${grade === 'A+' ? 'OR CAST(tr.scores AS FLOAT64) = 1.0' : ''} -- Include exact 1.0 for A+
      ${grade === 'F' ? '' : ''} -- F includes scores exactly at min bound (e.g. 0)
    ORDER BY tr.user_id
  `;

  const options = {
    query: query,
    params: {
      task_title: task_title,
      task_date: task_date,
      grade: grade, // Pass grade for logging/debug if needed
      min_score: range.min,
      max_score: range.max
    },
    location: 'us-central1',
  };

  try {
    logger.info('Fetching grade submission details', { params: options.params });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully fetched grade submission details', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    logger.error('Error fetching grade submission details', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch grade submission details' });
  }
});

// --- Fallback for Client-Side Routing --- //
// Serve index.html for any route not handled by API or static files
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
    logger.info(`Server started and running on port ${port}`, {
      port,
      environment: process.env.NODE_ENV || 'development'
    });
  });
}

// Export the app for testing
module.exports = app;