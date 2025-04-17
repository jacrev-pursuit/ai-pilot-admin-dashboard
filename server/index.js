require('dotenv').config();
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
  projectId: process.env.VITE_PROJECT_ID,
  credentials: {
    client_email: process.env.VITE_CLIENT_EMAIL,
    private_key: process.env.VITE_PRIVATE_KEY,
    private_key_id: process.env.VITE_PRIVATE_KEY_ID,
  },
});

// Dataset name
const DATASET = 'pilot_agent_public';

// API endpoint to fetch builder data
app.get('/api/builders', async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Missing startDate or endDate parameters' });
  }

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
      FROM \`${DATASET}.users\` u
      LEFT JOIN \`${DATASET}.task_responses\` tr ON u.user_id = tr.user_id
      LEFT JOIN \`${DATASET}.conversation_messages\` cm ON u.user_id = cm.user_id
      LEFT JOIN \`${DATASET}.sentiment_results\` sr ON u.user_id = sr.user_id
      LEFT JOIN \`${DATASET}.feedback_sentiment_analysis\` fsa ON u.user_id = CAST(fsa.to_user_id AS INT64)
      LEFT JOIN \`${DATASET}.question_evaluation_results\` qer ON u.user_id = qer.user_id
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
  };

  try {
    logger.info('Executing BigQuery query', { endpoint: '/api/builders' });
    const [rows] = await bigquery.query(options);
    logger.info('Successfully retrieved builder data', { rowCount: rows.length });
    res.json(rows);
  } catch (error) {
    logger.error('Error executing BigQuery query', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Provide a more user-friendly error message for permission issues
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
  const { type, startDate, endDate } = req.query;
  
  if (!userId || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters' });
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
        tr.grading_timestamp
      FROM \`${DATASET}.task_responses\` tr
      JOIN \`${DATASET}.tasks\` t ON CAST(tr.task_id AS STRING) = CAST(t.id AS STRING)
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
        qer.grading_timestamp
      FROM \`${DATASET}.question_evaluation_results\` qer
      JOIN \`${DATASET}.tasks\` t ON qer.task_id = t.id
      WHERE qer.user_id = @userId
      AND qer.grading_timestamp BETWEEN @startDate AND @endDate
      ORDER BY qer.grading_timestamp DESC
    `;
  } else if (type === 'peerFeedback') {
    query = `
      WITH feedback_data AS (
        SELECT 
          pf.id,
          pf.feedback_text,
          pf.created_at,
          pf.from_user_id,
          pf.to_user_id,
          fsa.sentiment_category,
          fsa.summary
        FROM \`${DATASET}.peer_feedback\` pf
        LEFT JOIN \`${DATASET}.feedback_sentiment_analysis\` fsa 
          ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
        WHERE CAST(pf.to_user_id AS INT64) = CAST(@userId AS INT64)
          AND DATE(pf.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
      )
      SELECT 
        fd.id,
        fd.feedback_text,
        fd.sentiment_category as sentiment,
        fd.summary,
        fd.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name
      FROM feedback_data fd
      LEFT JOIN \`${DATASET}.users\` u 
        ON CAST(fd.from_user_id AS INT64) = u.user_id
      ORDER BY fd.created_at DESC
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
  };

  try {
    logger.info('Executing BigQuery details query', { 
      endpoint: `/api/builders/${userId}/details`,
      type: type,
      params: options.params
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