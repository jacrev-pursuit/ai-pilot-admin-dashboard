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

// Create a BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  },
});

// Dataset name
const DATASET = 'pilot_agent_public';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;

// API endpoint to fetch builder data
app.get('/api/builders', async (req, res) => {
  // Use query parameters or default if not provided
  const startDate = req.query.startDate || '2000-01-01';
  const endDate = req.query.endDate || '2100-12-31';
  
  const query = `
    WITH builder_metrics AS (
      SELECT 
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        COUNT(DISTINCT CASE WHEN DATE(tr.date) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN tr.task_id END) as total_tasks,
        COUNT(DISTINCT CASE WHEN tr.grading_timestamp IS NOT NULL AND DATE(tr.date) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN tr.task_id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN DATE(cm.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN cm.message_id END) as prompts_sent,
        AVG(CASE WHEN DATE(sr.date) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN sr.sentiment_score END) as avg_daily_sentiment,
        AVG(CASE WHEN DATE(fsa.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN fsa.sentiment_score END) as avg_peer_feedback_sentiment,
        AVG(CASE WHEN DATE(tr.date) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN CAST(tr.scores AS FLOAT64) END) as work_product_score,
        AVG(CASE WHEN DATE(qer.grading_timestamp) BETWEEN DATE(@startDate) AND DATE(@endDate) THEN qer.score END) as comprehension_score
      FROM \`${PROJECT_ID}.${DATASET}.users\` u
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.task_responses\` tr ON u.user_id = tr.user_id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.conversation_messages\` cm ON u.user_id = cm.user_id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.sentiment_results\` sr ON u.user_id = sr.user_id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.feedback_sentiment_analysis\` fsa ON CAST(u.user_id AS STRING) = fsa.to_user_id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.question_evaluation_results\` qer ON u.user_id = qer.user_id
      GROUP BY u.user_id, u.first_name, u.last_name
    )
    SELECT 
      user_id,
      name,
      ROUND((completed_tasks / NULLIF(total_tasks, 0)) * 100, 2) as tasks_completed_percentage,
      prompts_sent,
      CASE 
        WHEN avg_daily_sentiment >= 0.6 THEN 'Very Positive'
        WHEN avg_daily_sentiment >= 0.2 THEN 'Positive'
        WHEN avg_daily_sentiment >= -0.2 THEN 'Neutral'
        WHEN avg_daily_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as daily_sentiment,
      CASE 
        WHEN avg_peer_feedback_sentiment IS NULL THEN 'No Peer Feedback'
        WHEN avg_peer_feedback_sentiment >= 0.6 THEN 'Very Positive'
        WHEN avg_peer_feedback_sentiment >= 0.2 THEN 'Positive'
        WHEN avg_peer_feedback_sentiment >= -0.2 THEN 'Neutral'
        WHEN avg_peer_feedback_sentiment >= -0.6 THEN 'Negative'
        ELSE 'Very Negative'
      END as peer_feedback_sentiment,
      ROUND(work_product_score, 2) as work_product_score,
      ROUND(comprehension_score, 2) as comprehension_score
    FROM builder_metrics
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
  
  if (type === 'workProduct') {
    query = `
      SELECT 
        tr.task_id,
        t.task_title,
        tr.response_content,
        tr.feedback,
        tr.scores,
        cd.day_date as task_date,
        tr.grading_timestamp
      FROM \`${PROJECT_ID}.${DATASET}.task_responses\` tr
      JOIN \`${PROJECT_ID}.${DATASET}.tasks\` t ON CAST(tr.task_id AS STRING) = CAST(t.id AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE CAST(tr.user_id AS INT64) = CAST(@userId AS INT64)
      AND DATE(tr.date) BETWEEN DATE(@startDate) AND DATE(@endDate)
      ORDER BY tr.grading_timestamp DESC
    `;
  } else if (type === 'comprehension') {
    query = `
      SELECT 
        qer.task_id,
        t.task_title,
        qer.score,
        cd.day_date as task_date,
        qer.grading_timestamp
      FROM \`${PROJECT_ID}.${DATASET}.question_evaluation_results\` qer
      JOIN \`${PROJECT_ID}.${DATASET}.tasks\` t ON qer.task_id = t.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE qer.user_id = CAST(@userId AS INT64)
      AND qer.grading_timestamp BETWEEN @startDate AND @endDate
      ORDER BY qer.grading_timestamp DESC
    `;
  } else if (type === 'peer_feedback') {
    // Explicitly construct table names (without backticks)
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
          fsa.sentiment_category
        FROM \`${peerFeedbackTable}\` pf 
        LEFT JOIN \`${sentimentTable}\` fsa 
          ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
        WHERE pf.to_user_id = CAST(@userId AS INT64)
          AND pf.created_at BETWEEN @startDate AND @endDate
      )
      SELECT 
        fd.feedback_id,
        fd.feedback,
        fd.sentiment_score,
        fd.sentiment_category as sentiment_label,
        fd.timestamp,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
      FROM feedback_data fd
      LEFT JOIN \`${usersTable}\` u 
        ON fd.from_user_id = u.user_id
      ORDER BY fd.timestamp DESC
    `;
  } else if (type === 'prompts') {
    query = `
      SELECT
        message_id,
        content,
        created_at
      FROM \`${PROJECT_ID}.${DATASET}.conversation_messages\`
      WHERE user_id = CAST(@userId AS INT64)
        AND message_role = 'user'
        AND created_at BETWEEN @startDate AND @endDate
      ORDER BY created_at DESC
    `;
  } else if (type === 'sentiment') {
    query = `
      SELECT 
        date,
        sentiment_score, 
        sentiment_category, 
        sentiment_reason, 
        message_count
      FROM \`${PROJECT_ID}.${DATASET}.sentiment_results\`
      WHERE user_id = CAST(@userId AS INT64)
        AND date BETWEEN DATE(@startDate) AND DATE(@endDate)
      ORDER BY date DESC
    `;
  } else {
    return res.status(400).json({ error: 'Invalid type parameter' });
  }

  const options = {
    query: query,
    params: {
      userId: userId,
      startDate: startDate,
      endDate: endDate,
    },
    location: 'us-central1',
  };

  try {
    logger.info('Executing BigQuery details query', { 
      endpoint: `/api/builders/${userId}/details`,
      type: type,
      params: options.params,
      query: query
    });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully retrieved builder details', { 
      rowCount: rows.length,
      type: type,
      userId: userId
    });
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