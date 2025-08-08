console.log('Server script starting...');

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const dayjs = require('dayjs'); // Add dayjs import
const logger = require('./logger');
const { processFeedbackSentiment } = require('./analyze-feedback-sentiment');

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

console.log('BigQuery Configuration:');
console.log(`  PROJECT_ID: ${PROJECT_ID || 'MISSING'}`);
console.log(`  DATASET: ${DATASET || 'MISSING'}`);
console.log(`  BIGQUERY_LOCATION: ${BIGQUERY_LOCATION}`);
console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Not Set'}`);

let bigquery;
try {
  console.log('Initializing BigQuery client...');
  
  // For Cloud Run, we need to use the service account key file
  // For local development, also use the service account key file if available
  const bigqueryConfig = {
    projectId: PROJECT_ID,
    location: BIGQUERY_LOCATION,
  };

  // Try to use service account key file if it exists
  const keyPath = path.join(__dirname, 'service-account-key.json');
  try {
    // Check if the key file exists
    if (require('fs').existsSync(keyPath)) {
      console.log('Using service account key file for BigQuery authentication');
      bigqueryConfig.keyFilename = keyPath;
    } else {
      console.log('Service account key file not found, using default authentication');
    }
  } catch (fsError) {
    console.log('Could not check for service account key file, using default authentication');
  }

  bigquery = new BigQuery(bigqueryConfig);
  
  // Validate that all required configuration is present
  if (!PROJECT_ID) {
    console.warn('WARNING: PROJECT_ID is not set, BigQuery queries may fail');
    logger.warn('PROJECT_ID environment variable is not set', { bigquery_config: { project: PROJECT_ID, dataset: DATASET, location: BIGQUERY_LOCATION }});
  }
  
  if (!DATASET) {
    console.warn('WARNING: BIGQUERY_DATASET is not set, using default:', DATASET);
    logger.warn('BIGQUERY_DATASET environment variable is not set, using default', { dataset: DATASET });
  }
  
  console.log('BigQuery client initialized successfully with:');
  console.log(`  Project: ${PROJECT_ID}`);
  console.log(`  Dataset: ${DATASET}`);
  console.log(`  Location: ${BIGQUERY_LOCATION}`);
} catch (error) {
  console.error('FATAL ERROR during BigQuery client initialization:\n', error);
  logger.error('FATAL ERROR during BigQuery client initialization:', { 
    error: error.message, 
    stack: error.stack,
    config: { project: PROJECT_ID, dataset: DATASET, location: BIGQUERY_LOCATION }
  });
  // Don't exit for Cloud Run - let the service start and handle errors gracefully
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
const enrollmentsTable = `${PROJECT_ID}.${DATASET}.enrollments_native`; // Changed to native table
const attAttendanceTable = `${PROJECT_ID}.${DATASET}.att_attendance`;
const attStudentsTable = `${PROJECT_ID}.${DATASET}.att_students`;
const humanReviewTable = `${PROJECT_ID}.${DATASET}.human_review`;

// Helper function to check if error is related to Google Drive permissions
function isGoogleDrivePermissionError(error) {
  return error.message && error.message.includes('Permission denied while getting Drive credentials');
}

// Helper function to execute query with fallback for enrollments table issues
async function executeQueryWithEnrollmentsFallback(queryWithEnrollments, queryWithoutEnrollments, params, endpointName) {
  try {
    // console.log(`Executing BigQuery query for ${endpointName} with enrollments...`);
    const [rows] = await bigquery.query({ query: queryWithEnrollments, params });
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    return rows;
  } catch (error) {
    if (isGoogleDrivePermissionError(error)) {
      console.log(`Google Drive permission error for ${endpointName}, falling back to query without enrollments...`);
      logger.warn(`Google Drive permission error for ${endpointName}, using fallback query`, { 
        error: error.message, 
        endpoint: endpointName 
      });
      
      // Remove level from params for fallback query if it exists
      const fallbackParams = { ...params };
      if (fallbackParams.level) {
        delete fallbackParams.level;
      }
      
      const [fallbackRows] = await bigquery.query({ query: queryWithoutEnrollments, params: fallbackParams });
      console.log(`Fallback query for ${endpointName} finished. Row count: ${fallbackRows.length}`);
      return fallbackRows;
    } else {
      // Re-throw non-Drive permission errors
      throw error;
    }
  }
}

// --- API Endpoints (Using OLD Query Logic) ---

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Handling request for /api/test');
  res.json({ message: 'Test route working!' });
});

// Builders endpoint (Re-applying New Task Completion % Logic)
app.get('/api/builders', async (req, res) => {
  // console.log(`Handling request for /api/builders. BigQuery Client Ready: ${!!bigquery}`);
  
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  try {
    const { startDate, endDate, level } = req.query; // Add level parameter

    if (!level) {
      return res.status(400).json({ error: 'Level is required' });
    }

    // Parse cohort-level combination filter
    let levelFilterCondition = '';
    let cohortFilter = null;
    let levelOnlyFilter = null;
    
    if (level) {
      // Check if it's a combined filter like "March 2025 - L1"
      const match = level.match(/^(.+) - (.+)$/);
      if (match) {
        cohortFilter = match[1]; // "March 2025"
        levelOnlyFilter = match[2]; // "L1"
        levelFilterCondition = 'AND se.cohort = @cohort AND se.level = @levelOnly';
      } else {
        // Fallback: treat as level-only filter
        levelOnlyFilter = level;
        levelFilterCondition = 'AND se.level = @levelOnly';
      }
    }

    // Query using native enrollments table with proper deduplication to ensure one row per user
    const query = `
      WITH SingleEnrollmentPerUser AS (
          -- Get enrollment records matching the requested level filter
          SELECT DISTINCT
              builder_email, 
              cohort, 
              level
          FROM \`${enrollmentsTable}\`
          WHERE 1=1 ${levelFilterCondition.replace(/se\./g, '')}
      ),
      BaseMetrics AS (
          -- Aggregate metrics per user with detailed peer feedback distribution
          SELECT
              bm.user_id,
              bm.name,
              u.email,
              CONCAT(se.cohort, ' - ', se.level) as level,
              SUM(bm.prompts_sent_today) as total_prompts_sent,
              SAFE_DIVIDE(SUM(bm.sum_daily_sentiment_score_today), SUM(bm.count_daily_sentiment_score_today)) as avg_daily_sentiment
          FROM \`${metricsTable}\` bm
          INNER JOIN \`${usersTable}\` u ON bm.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
          WHERE bm.metric_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            ${levelFilterCondition}
          GROUP BY bm.user_id, bm.name, u.email, se.cohort, se.level
      ),
      -- NEW: Calculate actual individual peer feedback distribution
      PeerFeedbackDistribution AS (
          SELECT
              pf.to_user_id as user_id,
              COUNT(DISTINCT pf.id) as total_peer_feedback_count,
              -- Count individual feedback records by sentiment score
              SUM(CASE 
                  WHEN fsa.sentiment_score > 0.2 THEN 1 
                  ELSE 0 
              END) as positive_feedback_count,
              SUM(CASE 
                  WHEN fsa.sentiment_score BETWEEN -0.2 AND 0.2 THEN 1 
                  ELSE 0 
              END) as neutral_feedback_count,
              SUM(CASE 
                  WHEN fsa.sentiment_score < -0.2 THEN 1 
                  ELSE 0 
              END) as negative_feedback_count
          FROM \`${peerFeedbackTable}\` pf
          LEFT JOIN \`${sentimentTable}\` fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
          INNER JOIN \`${usersTable}\` u_to ON pf.to_user_id = u_to.user_id
          INNER JOIN \`${usersTable}\` u_from ON pf.from_user_id = u_from.user_id
          INNER JOIN SingleEnrollmentPerUser se_pfd ON LOWER(u_to.email) = LOWER(se_pfd.builder_email)
          WHERE DATE(pf.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u_to.role = 'builder'
            AND u_from.role = 'builder'
            AND fsa.sentiment_score IS NOT NULL
            ${levelFilterCondition.replace(/se\./g, 'se_pfd.')} -- Apply same level filter
          GROUP BY pf.to_user_id
      ),
      -- CTEs for WP/Comp Scores with role and cohort-level filtering
      TaskAnalysis AS (
          SELECT tar.user_id, tar.learning_type,
                 SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) as completion_score,
                 JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') as criteria_met
          FROM \`${taskAnalysisTable}\` tar
          INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_ta ON LOWER(u.email) = LOWER(se_ta.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            ${levelFilterCondition.replace(/se\./g, 'se_ta.')}
      ),
      FilteredTaskAnalysis AS ( 
          SELECT user_id, learning_type, completion_score
          FROM TaskAnalysis
          WHERE completion_score IS NOT NULL AND completion_score != 0
            AND NOT ( criteria_met IS NOT NULL AND ARRAY_LENGTH(criteria_met) = 1 AND JSON_VALUE(criteria_met[OFFSET(0)]) = 'Submission received' )
      ),
      GradeDistribution AS (
          SELECT 
              user_id,
              COUNTIF(completion_score >= 93) as grade_aplus_count,
              COUNTIF(completion_score >= 90 AND completion_score < 93) as grade_a_count,
              COUNTIF(completion_score >= 87 AND completion_score < 90) as grade_aminus_count,
              COUNTIF(completion_score >= 83 AND completion_score < 87) as grade_bplus_count,
              COUNTIF(completion_score >= 80 AND completion_score < 83) as grade_b_count,
              COUNTIF(completion_score >= 77 AND completion_score < 80) as grade_bminus_count,
              COUNTIF(completion_score >= 73 AND completion_score < 77) as grade_cplus_count,
              COUNTIF(completion_score >= 70 AND completion_score < 73) as grade_c_count,
              COUNT(*) as total_graded_tasks
          FROM FilteredTaskAnalysis 
          GROUP BY user_id
      ),
      VideoTasksInRange AS (
          -- Find ALL submissions containing loom.com links, regardless of deliverable type or analysis status
          SELECT DISTINCT 
              COALESCE(tar.task_id, ts.task_id) as task_id,
              COALESCE(tar.user_id, ts.user_id) as user_id
          FROM \`${usersTable}\` u
          INNER JOIN SingleEnrollmentPerUser se_vtr ON LOWER(u.email) = LOWER(se_vtr.builder_email)
          LEFT JOIN \`${taskAnalysisTable}\` tar ON tar.user_id = u.user_id
              AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
              AND LOWER(tar.analyzed_content) LIKE '%loom.com%'
          LEFT JOIN \`${taskSubmissionsTable}\` ts ON ts.user_id = u.user_id  
              AND DATE(ts.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
              AND LOWER(ts.content) LIKE '%loom.com%'
          WHERE u.role = 'builder'
            AND (tar.task_id IS NOT NULL OR ts.task_id IS NOT NULL)
            ${levelFilterCondition.replace(/se\./g, 'se_vtr.')}
      ),
      VideoTaskMetrics AS (
          SELECT 
              ts.user_id,
              COUNT(DISTINCT ts.id) as video_tasks_completed,
              AVG((va.technical_score + va.business_score + va.professional_skills_score) / 3.0 * 20) as avg_video_score
          FROM \`${taskSubmissionsTable}\` ts
          INNER JOIN \`${usersTable}\` u ON ts.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_vtm ON LOWER(u.email) = LOWER(se_vtm.builder_email)
          LEFT JOIN \`${PROJECT_ID}.${DATASET}.video_analyses\` va ON CAST(ts.id AS STRING) = va.submission_id AND CAST(ts.user_id AS STRING) = va.user_id
          WHERE DATE(ts.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND LOWER(ts.content) LIKE '%loom.com%'
            AND u.role = 'builder'
            ${levelFilterCondition.replace(/se\./g, 'se_vtm.')}
          GROUP BY ts.user_id
      ),
      -- NEW: Get Final Demo Recording submissions (Task ID 863) for each builder
      FinalDemoSubmissions AS (
          SELECT 
              ts.user_id,
              COALESCE(va.loom_url, ts.content) as latest_loom_url,
              ts.task_id as latest_task_id,
              ts.id as latest_submission_id,
              ROW_NUMBER() OVER (PARTITION BY ts.user_id ORDER BY ts.created_at DESC) as rn
          FROM \`${taskSubmissionsTable}\` ts
          INNER JOIN \`${usersTable}\` u ON ts.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_fds ON LOWER(u.email) = LOWER(se_fds.builder_email)
          LEFT JOIN \`${PROJECT_ID}.${DATASET}.video_analyses\` va ON CAST(ts.id AS STRING) = va.submission_id AND CAST(ts.user_id AS STRING) = va.user_id
          WHERE ts.task_id = 863  -- Final Demo Recording and Submission task
            AND u.role = 'builder'
            AND (LOWER(ts.content) LIKE '%loom.com%' OR (va.loom_url IS NOT NULL AND va.loom_url != ''))
            ${levelFilterCondition.replace(/se\./g, 'se_fds.')}
      ),
      -- Task Completion Percentage CTEs (SIMPLIFIED) --
      GradedTasksPerCohort AS (
          -- Count unique tasks that were actually graded for each cohort (denominator)
          SELECT 
              se_gtpc.cohort as user_cohort,
              COUNT(DISTINCT tar.task_id) as total_graded_tasks_for_cohort
          FROM \`${taskAnalysisTable}\` tar
          INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_gtpc ON LOWER(u.email) = LOWER(se_gtpc.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            -- Only include valid graded tasks (same filters as GradeDistribution)
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
            ${levelFilterCondition.replace(/se\./g, 'se_gtpc.')}
          GROUP BY se_gtpc.cohort
      ),
      GradedTasksPerUser AS (
          -- Count unique tasks that were actually graded for each user
          SELECT 
              tar.user_id,
              COUNT(DISTINCT tar.task_id) as graded_count
          FROM \`${taskAnalysisTable}\` tar
          INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_gtpu ON LOWER(u.email) = LOWER(se_gtpu.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            -- Only include valid graded tasks (same filters as GradeDistribution)
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
            ${levelFilterCondition.replace(/se\./g, 'se_gtpu.')}
          GROUP BY tar.user_id
      ),
      -- Curriculum Days for filtering --
      CurriculumDaysInRange AS (
          SELECT cohort, day_date
          FROM \`${curriculumDaysTable}\`
          WHERE day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
      ),
      -- Attendance Calculation CTE --
      AttendanceMetrics AS (
          SELECT 
              u.user_id,
              se_att.cohort,
              -- Count days attended for this user (only for curriculum days)
              COUNT(CASE WHEN att.status = 'present' THEN 1 END) as days_attended,
              -- Get total curriculum days for their cohort within date range
              (
                  SELECT COUNT(DISTINCT cdr.day_date)
                  FROM CurriculumDaysInRange cdr
                  WHERE cdr.cohort = se_att.cohort
              ) as total_curriculum_days,
              -- Calculate attendance percentage
              ROUND(
                  (COUNT(CASE WHEN att.status = 'present' THEN 1 END) / 
                   NULLIF((
                      SELECT COUNT(DISTINCT cdr.day_date)
                      FROM CurriculumDaysInRange cdr
                      WHERE cdr.cohort = se_att.cohort
                   ), 0)) * 100, 
                  0
              ) as attendance_percentage
          FROM \`${attStudentsTable}\` ats
          INNER JOIN \`${usersTable}\` u ON LOWER(ats.email) = LOWER(u.email)
          INNER JOIN SingleEnrollmentPerUser se_att ON LOWER(u.email) = LOWER(se_att.builder_email)
          LEFT JOIN \`${attAttendanceTable}\` att ON ats.id = att.student_id
          -- Join with curriculum days to only include attendance for valid curriculum days
          INNER JOIN CurriculumDaysInRange cdr ON DATE(att.date) = cdr.day_date 
              AND cdr.cohort = se_att.cohort
          WHERE u.role = 'builder'
            ${levelFilterCondition.replace(/se\./g, 'se_att.')}
          GROUP BY u.user_id, se_att.cohort
      )
      -- Final SELECT joining all CTEs - guaranteed one row per user
      SELECT 
        bm.user_id,
        bm.name,
        bm.email,
        bm.level,
        ROUND((COALESCE(gtpu.graded_count, 0) / NULLIF(gtpc.total_graded_tasks_for_cohort, 0)) * 100, 0) as tasks_completed_percentage,
        bm.total_prompts_sent as prompts_sent,
        CASE 
          WHEN bm.avg_daily_sentiment IS NULL THEN NULL
          WHEN bm.avg_daily_sentiment >= 0.6 THEN 'Very Positive'
          WHEN bm.avg_daily_sentiment >= 0.2 THEN 'Positive'
          WHEN bm.avg_daily_sentiment >= -0.2 THEN 'Neutral'
          WHEN bm.avg_daily_sentiment >= -0.6 THEN 'Negative'
          ELSE 'Very Negative'
        END as daily_sentiment,
        -- Use detailed peer feedback distribution from individual records
        COALESCE(pfd.total_peer_feedback_count, 0) as total_peer_feedback_count,
        COALESCE(pfd.positive_feedback_count, 0) as positive_feedback_count,
        COALESCE(pfd.neutral_feedback_count, 0) as neutral_feedback_count,
        COALESCE(pfd.negative_feedback_count, 0) as negative_feedback_count,
        -- Grade distribution data
        COALESCE(gd.grade_aplus_count, 0) as grade_aplus_count,
        COALESCE(gd.grade_a_count, 0) as grade_a_count,
        COALESCE(gd.grade_aminus_count, 0) as grade_aminus_count,
        COALESCE(gd.grade_bplus_count, 0) as grade_bplus_count,
        COALESCE(gd.grade_b_count, 0) as grade_b_count,
        COALESCE(gd.grade_bminus_count, 0) as grade_bminus_count,
        COALESCE(gd.grade_cplus_count, 0) as grade_cplus_count,
        COALESCE(gd.grade_c_count, 0) as grade_c_count,
        COALESCE(gd.total_graded_tasks, 0) as total_graded_tasks,
        -- Video task metrics
        COALESCE(vtm.video_tasks_completed, 0) as video_tasks_completed,
        ROUND(vtm.avg_video_score, 2) as avg_video_score,
        -- Attendance metrics
        COALESCE(am.attendance_percentage, 0) as attendance_percentage,
        COALESCE(am.days_attended, 0) as days_attended,
        COALESCE(am.total_curriculum_days, 0) as total_curriculum_days,
        -- NEW: Get Final Demo Recording submission URL and associated IDs for each builder
        COALESCE(fds.latest_loom_url, '') as latest_loom_url,
        fds.latest_task_id,
        fds.latest_submission_id
      FROM BaseMetrics bm
      LEFT JOIN PeerFeedbackDistribution pfd ON bm.user_id = pfd.user_id
      LEFT JOIN GradeDistribution gd ON bm.user_id = gd.user_id
      LEFT JOIN VideoTaskMetrics vtm ON bm.user_id = vtm.user_id
      LEFT JOIN AttendanceMetrics am ON bm.user_id = am.user_id
      LEFT JOIN GradedTasksPerUser gtpu ON bm.user_id = gtpu.user_id
      LEFT JOIN GradedTasksPerCohort gtpc ON SPLIT(bm.level, ' - ')[OFFSET(0)] = gtpc.user_cohort
      LEFT JOIN FinalDemoSubmissions fds ON bm.user_id = fds.user_id AND fds.rn = 1
    `;

    // Build params object conditionally
    const params = { startDate, endDate };
    if (cohortFilter) {
      params.cohort = cohortFilter;
      params.levelOnly = levelOnlyFilter;
    } else if (levelOnlyFilter) {
      params.levelOnly = levelOnlyFilter;
    }

    try {
      // console.log(`Executing BigQuery query for /api/builders with native enrollments table...`);
      // console.log(`Filter applied: ${level || 'none'} (cohort: ${cohortFilter}, level: ${levelOnlyFilter})`);
      const [rows] = await bigquery.query({ query, params });
      // console.log(`Query for.*finished. Row count: ${rows.length}`);
      res.json(rows);
    } catch (error) {
      console.error(`Error in ${req.path}:`, error);
      logger.error(`Error executing BigQuery query for ${req.path}`, { error: error.message, stack: error.stack }); 
      res.status(500).json({ error: 'Failed to fetch builder data' });
    }
  } catch (error) {
    console.error('Error in /api/builders:', error);
    res.status(500).json({ error: 'Failed to fetch builder data', details: error.message });
  }
});

// Get available levels endpoint
app.get('/api/levels', async (req, res) => {
  // console.log(`Handling request for /api/levels. BigQuery Client Ready: ${!!bigquery}`);
  console.log('LEVELS ENDPOINT: Starting execution...');
  
  if (!bigquery) {
    console.log('LEVELS ENDPOINT: BigQuery client not initialized');
    return res.status(500).json({ error: 'BigQuery client not initialized' });
  }

  // First try to get all cohort-level combinations (including future cohorts without users yet)
  const allCohorts = `
    SELECT DISTINCT e.cohort, e.level, CONCAT(e.cohort, ' - ', e.level) as combined_level
    FROM \`${enrollmentsTable}\` e
    WHERE e.level IS NOT NULL
      AND e.level != ''
      AND e.cohort IS NOT NULL
      AND e.cohort != ''
    ORDER BY cohort ASC, level ASC
  `;

  // Fallback query - only cohorts with matching users
  const cohortsWithUsers = `
    SELECT DISTINCT e.cohort, e.level, CONCAT(e.cohort, ' - ', e.level) as combined_level
    FROM \`${enrollmentsTable}\` e
    INNER JOIN \`${usersTable}\` u ON e.builder_email = u.email
    WHERE u.role = 'builder'
      AND e.level IS NOT NULL
      AND e.level != ''
      AND e.cohort IS NOT NULL
      AND e.cohort != ''
    ORDER BY cohort ASC, level ASC
  `;

  try {
    console.log('LEVELS ENDPOINT: Trying to get all cohort combinations first...');
    const [allRows] = await bigquery.query({ query: allCohorts });
    
    if (allRows.length > 0) {
      // Extract just the combined level values
      const levels = allRows.map(row => row.combined_level);
      console.log('LEVELS ENDPOINT: Returning all cohort-level combinations:', levels);
      res.json(levels);
      return;
    }
    
    // Fallback to cohorts with users only
    console.log('LEVELS ENDPOINT: No cohorts found, trying cohorts with users only...');
    const [userRows] = await bigquery.query({ query: cohortsWithUsers });
    const levels = userRows.map(row => row.combined_level);
    console.log('LEVELS ENDPOINT: Returning cohort-level combinations with users:', levels);
    res.json(levels);
    
  } catch (error) {
    console.error(`LEVELS ENDPOINT: Error occurred:`, error);
    logger.error('Error fetching cohort-level combinations', { error: error.message, stack: error.stack });
    
    // Fallback to mock levels if native table fails
    console.log('LEVELS ENDPOINT: Using fallback to mock cohort-level combinations...');
    const mockLevels = ['March 2025 - L1', 'March 2025 - L2', 'June 2025 - L1'];
    console.log('LEVELS ENDPOINT: Sending mock levels:', mockLevels);
    res.json(mockLevels);
  }
});

// Builder Details endpoint (Old Query Logic)
app.get('/api/builders/:userId/details', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { userId } = req.params;
  const { type, startDate, endDate, level } = req.query;

  if (!userId || !type || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // Parse cohort-level combination filter (same logic as other endpoints)
  let levelFilterCondition = '';
  let cohortFilter = null;
  let levelOnlyFilter = null;
  
  if (level) {
    // Check if it's a combined filter like "March 2025 - L1"
    const match = level.match(/^(.+) - (.+)$/);
    if (match) {
      cohortFilter = match[1]; // "March 2025"
      levelOnlyFilter = match[2]; // "L1"
      levelFilterCondition = 'AND se.cohort = @cohort AND se.level = @levelOnly';
    } else {
      // Fallback: treat as level-only filter
      levelOnlyFilter = level;
      levelFilterCondition = 'AND se.level = @levelOnly';
    }
  }

  let query = '';
  // OLD baseQuery logic - kept for reference in if/else, but defined within

  if (type === 'workProduct') {
    // OLD logic for workProduct with role filtering for builders only
    query = `
      SELECT 
        tar.task_id, t.task_title, tar.analysis, tar.curriculum_date as date,
        tar.analyzed_content, -- Added analyzed_content
        tar.auto_id -- Added auto_id
      FROM \`${taskAnalysisTable}\` tar
      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
      WHERE tar.user_id = CAST(@userId AS INT64)
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.learning_type = 'Work product'
        AND u.role = 'builder'
      ORDER BY tar.curriculum_date DESC
    `;
  } else if (type === 'comprehension') {
    // OLD logic for comprehension with role filtering for builders only
    query = `
      SELECT 
        tar.task_id, t.task_title, tar.analysis, tar.curriculum_date as date,
        tar.analyzed_content, -- Added analyzed_content
        tar.auto_id -- Added auto_id
      FROM \`${taskAnalysisTable}\` tar
      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
      WHERE tar.user_id = CAST(@userId AS INT64)
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.learning_type = 'Key concept'
        AND u.role = 'builder'
      ORDER BY tar.curriculum_date DESC
    `;
  } else if (type === 'allTasks') {
    // NEW logic for all tasks regardless of learning type
    query = `
      SELECT 
        tar.task_id, t.task_title, tar.analysis, tar.curriculum_date as date,
        tar.analyzed_content, -- Added analyzed_content
        tar.auto_id, -- Added auto_id
        tar.learning_type -- Added learning_type to show what type each task was
      FROM \`${taskAnalysisTable}\` tar
      LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
      WHERE tar.user_id = CAST(@userId AS INT64)
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND u.role = 'builder'
        -- Filter out invalid tasks --
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
        AND NOT (
            JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
            ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
            JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
        )
      ORDER BY tar.curriculum_date DESC
    `;
  } else if (type === 'videoTasks') {
    // Find ALL video submissions containing loom.com with their video analysis scores
    query = `
      WITH SingleEnrollmentPerUser AS (
        -- Get enrollment records matching the requested level filter
        SELECT DISTINCT
            builder_email, 
            cohort, 
            level
        FROM \`${enrollmentsTable}\`
        WHERE 1=1 ${levelFilterCondition.replace(/se\./g, '')}
      )
      SELECT 
        ts.task_id,
        ts.id as submission_id,
        COALESCE(t.task_title, CONCAT('Task ', ts.task_id)) as task_title, 
        DATE(ts.created_at) as date,
        ts.content as analyzed_content,
        CAST(ts.id AS STRING) as auto_id,
        'Work product' as learning_type,
        t.deliverable_type,
        -- Video analysis scores and feedback
        va.technical_score,
        va.business_score,
        va.professional_skills_score,
        va.technical_score_rationale,
        va.business_score_rationale,
        va.professional_skills_score_rationale,
        va.loom_url,
        -- Create a simplified analysis object
        CASE 
          WHEN va.technical_score IS NOT NULL THEN
            JSON_OBJECT(
              'completion_score', (va.technical_score + va.business_score + va.professional_skills_score) / 3.0 * 20,
              'feedback', CONCAT('Technical: ', CAST(va.technical_score AS STRING), '/5\\nBusiness: ', CAST(va.business_score AS STRING), '/5\\nProfessional: ', CAST(va.professional_skills_score AS STRING), '/5'),
              'loom_url', va.loom_url,
              'criteria_met', ['Video Analysis Complete'],
              'areas_for_improvement', []
            )
          ELSE NULL
        END as analysis
      FROM \`${taskSubmissionsTable}\` ts
      INNER JOIN \`${usersTable}\` u ON ts.user_id = u.user_id
      INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
      LEFT JOIN \`${tasksTable}\` t ON ts.task_id = t.id
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.video_analyses\` va ON CAST(ts.id AS STRING) = va.submission_id AND CAST(ts.user_id AS STRING) = va.user_id
      WHERE ts.user_id = CAST(@userId AS INT64)
        AND DATE(ts.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND LOWER(ts.content) LIKE '%loom.com%'
        AND u.role = 'builder'
      ORDER BY ts.created_at DESC
    `;
  } else if (type === 'peer_feedback') {
    // OLD logic for peer_feedback with role filtering for builders only
    query = `
      WITH feedback_data AS (
        SELECT 
          pf.id as feedback_id, pf.feedback_text as feedback, pf.created_at as timestamp, pf.from_user_id,
          fsa.sentiment_score, fsa.sentiment_category, fsa.summary, fsa.created_at as analysis_date
        FROM \`${peerFeedbackTable}\` pf 
        LEFT JOIN \`${sentimentTable}\` fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
        INNER JOIN \`${usersTable}\` u_to ON pf.to_user_id = u_to.user_id
        INNER JOIN \`${usersTable}\` u_from ON pf.from_user_id = u_from.user_id
        WHERE pf.to_user_id = CAST(@userId AS INT64)
          AND DATE(fsa.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND u_to.role = 'builder'
          AND u_from.role = 'builder'
      )
      SELECT 
        fd.feedback_id, fd.feedback, fd.sentiment_score, fd.sentiment_category as sentiment_label,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name, fd.summary, fd.from_user_id, fd.timestamp
      FROM feedback_data fd
      LEFT JOIN \`${usersTable}\` u ON fd.from_user_id = u.user_id
      ORDER BY fd.timestamp DESC
    `;
  } else if (type === 'prompts') {
      // OLD logic for prompts with role filtering for builders only
      query = `
        SELECT DATE(cm.created_at) as date, COUNT(cm.message_id) as prompt_count
        FROM \`${messagesTable}\` cm
        INNER JOIN \`${usersTable}\` u ON cm.user_id = u.user_id
        WHERE cm.user_id = CAST(@userId AS INT64)
          AND cm.message_role = 'user'
          AND cm.created_at BETWEEN TIMESTAMP(@startDate) AND TIMESTAMP(@endDate) -- Adjusted to TIMESTAMP if created_at is TIMESTAMP
          AND u.role = 'builder'
        GROUP BY 1 ORDER BY 1 ASC
      `;
  } else if (type === 'sentiment') {
      // OLD logic for sentiment with role filtering for builders only
      query = `
        WITH DailyOutliers AS (
          SELECT so.user_id, so.date, STRING_AGG(so.sentence_text, '; ') AS daily_sentiment_reasons
          FROM \`${outliersTable}\` so
          INNER JOIN \`${usersTable}\` u ON so.user_id = u.user_id
          WHERE so.user_id = CAST(@userId AS INT64) 
            AND so.date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
          GROUP BY so.user_id, so.date
        )
        SELECT 
          sr.date, sr.sentiment_score, sr.sentiment_category, sr.message_count, 
          do.daily_sentiment_reasons AS sentiment_reason
        FROM \`${resultsTable}\` sr
        INNER JOIN \`${usersTable}\` u ON sr.user_id = u.user_id
        LEFT JOIN DailyOutliers do ON sr.user_id = do.user_id AND sr.date = do.date
        WHERE sr.user_id = CAST(@userId AS INT64)
          AND sr.date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND u.role = 'builder'
        ORDER BY sr.date ASC
      `;
  } else {
    return res.status(400).json({ error: 'Invalid type specified' });
  }

  // Build params object conditionally
  const params = { userId, startDate, endDate };
  if (cohortFilter) {
    params.cohort = cohortFilter;
    params.levelOnly = levelOnlyFilter;
  } else if (levelOnlyFilter) {
    params.levelOnly = levelOnlyFilter;
  }
  
  const options = { query, params };

  try {
    console.log(`Executing BigQuery details query (type: ${type}) for ${req.path}...`);
    // console.log(`Filter applied: ${level || 'none'} (cohort: ${cohortFilter}, level: ${levelOnlyFilter})`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error executing BigQuery details query (type: ${type})`, { error: error.message, query: options.query, stack: error.stack, timestamp: new Date().toISOString() });
    logger.error(`Error executing BigQuery details query (type: ${type})`, { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch builder details' });
  }
});

// Trends endpoints (Old Query Logic)
app.get('/api/trends/prompts', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, level } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e.level = @level' : '';

  // QUERY logic with role filtering for builders only (enrollments join removed)
  const query = `
    SELECT DATE(cm.created_at) as date, COUNT(cm.message_id) as prompt_count
    FROM \`${messagesTable}\` cm
    INNER JOIN \`${curriculumDaysTable}\` cd ON DATE(cm.created_at) = cd.day_date
    INNER JOIN \`${usersTable}\` u ON cm.user_id = u.user_id
    WHERE cm.message_role = 'user'
      AND DATE(cm.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND u.role = 'builder'
    GROUP BY 1 ORDER BY 1 ASC
  `;

  const params = { startDate, endDate };
  const options = { query, params };
  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error executing BigQuery prompt trends query`, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch prompt trends' });
  }
});

app.get('/api/trends/sentiment', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, level } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e.level = @level' : '';

  // QUERY logic with role filtering for builders only (enrollments join removed)
  const query = `
    SELECT DATE(sr.date) as date, sr.sentiment_category, COUNT(*) as count
    FROM \`${resultsTable}\` sr
    INNER JOIN \`${usersTable}\` u ON sr.user_id = u.user_id
    WHERE DATE(sr.date) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND sr.sentiment_category IS NOT NULL
      AND u.role = 'builder'
    GROUP BY date, sentiment_category ORDER BY date ASC, sentiment_category ASC
  `;

  const params = { startDate, endDate };
  const options = { query, params };
  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error fetching sentiment trends`, { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch sentiment trends' });
  }
});

app.get('/api/trends/peer-feedback', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, level } = req.query;
  if (!startDate || !endDate || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e_from.level = @level AND e_to.level = @level' : '';

  // QUERY logic with role filtering for builders only (enrollments join removed)
  const query = `
    SELECT DATE(fsa.created_at) as date, fsa.sentiment_category, COUNT(*) as count
    FROM \`${sentimentTable}\` fsa
    INNER JOIN \`${peerFeedbackTable}\` pf ON CAST(fsa.id AS STRING) = CAST(pf.id AS STRING)
    INNER JOIN \`${usersTable}\` u_from ON pf.from_user_id = u_from.user_id
    INNER JOIN \`${usersTable}\` u_to ON pf.to_user_id = u_to.user_id
    WHERE DATE(fsa.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
      AND fsa.sentiment_category IS NOT NULL
      AND u_from.role = 'builder'
      AND u_to.role = 'builder'
    GROUP BY date, sentiment_category ORDER BY date ASC, sentiment_category ASC
  `;

  const params = { startDate, endDate };
  const options = { query, params };
  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error(`Error executing BigQuery peer feedback trends query`, { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch peer feedback trends' });
  }
});

// Restore old Grades/Feedback/Sentiment Details endpoints
app.get('/api/feedback/details', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { date, category, level } = req.query;
  if (!date || !category || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  const validCategories = ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'];
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category parameter' });

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e_from.level = @level AND e_to.level = @level' : '';

  // QUERY logic with role filtering for builders only (enrollments join removed)
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
      AND u_from.role = 'builder'
      AND u_to.role = 'builder'
    ORDER BY pf.created_at DESC
  `;

  const params = { date, category };
  const options = { query, params };
  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching feedback details', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch feedback details' });
  }
});

app.get('/api/sentiment/details', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { date, category } = req.query;
  if (!date || !category || !bigquery) return res.status(400).json({ error: 'Missing parameters or BQ client issue' });

  const validCategories = ['Positive', 'Neutral', 'Negative']; 
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category parameter' });

  // OLD QUERY logic with role filtering for builders only
  const query = `
    SELECT sr.user_id, sr.sentiment_score, sr.sentiment_category, sr.message_count, sr.date,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${resultsTable}\` sr
    LEFT JOIN \`${usersTable}\` u ON sr.user_id = u.user_id
    WHERE DATE(sr.date) = DATE(@date)
      AND sr.sentiment_category = @category
      AND u.role = 'builder'
    ORDER BY sr.user_id
  `;
  const options = { query, params: { date, category } };
  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching daily sentiment details', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch daily sentiment details' });
  }
});

// Restore /api/overview/grade-distribution endpoint (filters by type, groups by grade)
app.get('/api/overview/grade-distribution', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, learningType, level } = req.query; // Add level parameter

  // Add back validation for all params
  if (!startDate || !endDate || !learningType || !bigquery) {
      return res.status(400).json({ error: 'Missing required parameters or BQ client issue' });
  }
  if (!['Work product', 'Key concept'].includes(learningType)) {
      return res.status(400).json({ error: 'Invalid learningType' });
  }

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e.level = @level' : '';

  const query = `
    WITH ValidTasks AS (
        SELECT
            tar.task_id,
            SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) as completion_score
        FROM \`${taskAnalysisTable}\` tar
        INNER JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
        WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
          AND tar.learning_type = @learningType -- Filter by learning type
          AND u.role = 'builder'
          -- Filter out invalid tasks --
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
          AND NOT (
              JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
              ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
              JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
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

  const params = { startDate, endDate, learningType };
  const options = { query, params };

  try {
    // console.log(`Executing BigQuery query for ${req.path} (Type: ${learningType})...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows); // Returns array like [{ grade: 'A', count: 25 }, ...]
  } catch (error) {
    console.error(`Error in ${req.path} (Type: ${learningType}):`, error);
    logger.error('Error executing BigQuery grade distribution query', { error: error.message, stack: error.stack, learningType: learningType });
    res.status(500).json({ error: 'Failed to fetch grade distribution data' });
  }
});

// --- NEW Endpoint: Cohort Task Details --- 
app.get('/api/tasks/:taskId/cohort-details', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
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

  const options = { query, params: { taskId } }; 

  try {
    // console.log(`Executing BigQuery query for ${req.path} (Task ID: ${taskId})...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    
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
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
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

  const options = { query };

  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows); // Returns array like [{ task_id: 1, task_title: 'Task A' }, ...]
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error fetching task list', { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch task list' });
  }
});

// --- NEW Endpoint: Paginated Individual Task Submissions/Analyses ---
app.get('/api/tasks/:taskId/submissions', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
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
    params: { taskId, limit: sizeNum, offset }
  };

  try {
    // console.log(`Executing BigQuery query for ${req.path} (Task ID: ${taskId}, Page: ${pageNum}, Size: ${sizeNum})...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    
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
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
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
      tar.learning_type
    FROM \`${taskAnalysisTable}\` tar
    LEFT JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
    LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
    -- WHERE clauses for filtering can be added here based on query params
    WHERE DATE(tar.curriculum_date) >= DATE(@startDate)
      AND DATE(tar.curriculum_date) <= DATE(@endDate)
      AND u.role = 'builder'
    ORDER BY tar.curriculum_date DESC, user_name ASC
    -- LIMIT/OFFSET for pagination can be added here
  `;

  const options = { query, params: { startDate, endDate } };

  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    res.json(rows);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error executing BigQuery all task analysis query', { error: error.message, stack: error.stack, query: options.query });
    res.status(500).json({ error: 'Failed to fetch all task analysis results' });
  }
});

// --- NEW Endpoint: Fetch Single Task Analysis Result by auto_id ---
app.get('/api/submission/:autoId', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { autoId } = req.params;

  if (!autoId) {
    return res.status(400).json({ error: 'Missing required parameter: autoId' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // Determine if this is a submission ID (numeric) or analysis auto_id (UUID)
  const isSubmissionId = /^\d+$/.test(autoId);
  
  // Define table names
  const videoAnalysesTable = `${PROJECT_ID}.${DATASET}.video_analyses`;
  const usersTable = `${PROJECT_ID}.${DATASET}.users`;
  
  let query, params;
  
  if (isSubmissionId) {
    // For numeric submission IDs, first check if there's video analysis data
    // If video analysis exists, return that rich data instead of basic submission data
    const videoAnalysisQuery = `
    SELECT 
        va.video_id,
        va.submission_id,
        va.user_id,
        va.technical_score,
        va.business_score,
        va.professional_skills_score,
        va.technical_score_rationale,
        va.business_score_rationale,
        va.professional_skills_score_rationale,
        va.loom_url,
        t.task_title,
        ts.created_at as submission_date,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM \`${videoAnalysesTable}\` va
      LEFT JOIN \`${tasksTable}\` t ON va.video_id = CAST(t.id AS STRING)
      LEFT JOIN \`${taskSubmissionsTable}\` ts ON va.submission_id = CAST(ts.id AS STRING)
      INNER JOIN \`${usersTable}\` u ON CAST(va.user_id AS INT64) = u.user_id
      WHERE va.submission_id = CAST(@autoId AS STRING)
        AND u.role = 'builder'
      LIMIT 1
    `;
    
    try {
      const [videoAnalysisRows] = await bigquery.query({
        query: videoAnalysisQuery,
        params: { autoId }
      });
      
      if (videoAnalysisRows.length > 0) {
        // Video analysis found - return rich analysis data
        const row = videoAnalysisRows[0];
        const technicalScore = row.technical_score || 0;
        const businessScore = row.business_score || 0;
        const professionalScore = row.professional_skills_score || 0;
        const averageScore = ((technicalScore + businessScore + professionalScore) / 3).toFixed(1);
        
        // Parse the rationale JSON strings to extract comprehensive feedback
        let technicalFeedback = '';
        let businessFeedback = '';
        let professionalFeedback = '';
        
        // Enhanced parsing function to extract full rationale details with clean formatting
        const parseRationale = (rationaleString, category, score) => {
          if (!rationaleString) return '';
          
          try {
            const data = JSON.parse(rationaleString);
            let feedback = '';
            
            // Overall explanation as bullet points
            if (data.overall_explanation) {
              feedback += `- ${data.overall_explanation}\n`;
            }
            if (data.overall_supporting_evidence) {
              feedback += `- ${data.overall_supporting_evidence}\n`;
            }
            feedback += `\n`;
            
            // Sub-criteria breakdown with indenting
            if (data.sub_criteria && typeof data.sub_criteria === 'object') {
              feedback += `Detailed Breakdown:\n\n`;
              
              Object.entries(data.sub_criteria).forEach(([criterion, details]) => {
                if (details && typeof details === 'object') {
                  const criterionScore = details.score || 'N/A';
                  feedback += `  ${criterion}: ${criterionScore}/5\n`;
                  
                  if (details.explanation) {
                    feedback += `  - ${details.explanation}\n`;
                  }
                  
                  if (details.supporting_evidence) {
                    feedback += `  - ${details.supporting_evidence}\n`;
                  }
                  feedback += `\n`;
                }
              });
            }
            
            return feedback;
          } catch (e) {
            // Fallback to raw string if JSON parsing fails
            return `${rationaleString}\n\n`;
          }
        };
        
        technicalFeedback = parseRationale(row.technical_score_rationale, 'Technical', technicalScore);
        businessFeedback = parseRationale(row.business_score_rationale, 'Business', businessScore);
        professionalFeedback = parseRationale(row.professional_skills_score_rationale, 'Professional Skills', professionalScore);
        
        // Create comprehensive analysis JSON for video analysis
        const videoAnalysisJson = {
          type: 'video_analysis',
          completion_score: parseFloat(averageScore),
          technical_score: technicalScore,
          business_score: businessScore,
          professional_skills_score: professionalScore,
          feedback: `Video Analysis Results:\n\nTechnical (${technicalScore}/5): ${technicalFeedback}\n\nBusiness (${businessScore}/5): ${businessFeedback}\n\nProfessional Skills (${professionalScore}/5): ${professionalFeedback}`,
          technical_feedback: technicalFeedback,
          business_feedback: businessFeedback,
          professional_feedback: professionalFeedback,
          criteria_met: [`Technical Score: ${technicalScore}`, `Business Score: ${businessScore}`, `Professional Score: ${professionalScore}`],
          areas_for_improvement: [],
          video_url: row.loom_url,
          submission_id: row.submission_id,
          video_id: row.video_id
        };
        
        const result = {
          auto_id: autoId,
          submission_id: row.submission_id,
          task_id: row.video_id,
          task_title: row.task_title || `Video Analysis ${row.video_id}`,
          user_id: row.user_id,
          user_name: row.user_name,
          date: row.submission_date || new Date().toISOString(),
          analyzed_content: row.loom_url,
          analysis: JSON.stringify(videoAnalysisJson),
          completion_score: parseFloat(averageScore),
          technical_score: technicalScore,
          business_score: businessScore,
          professional_skills_score: professionalScore
        };
        
        return res.json(result);
      }
    } catch (videoError) {
      console.error('Error checking for video analysis:', videoError);
      // Continue to submission fallback if video analysis query fails
    }
    
    // No video analysis found - query task_submissions table for basic submission data
    query = `
      SELECT 
        ts.id as submission_id,
        ts.task_id,
        t.task_title,
        ts.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        DATE(ts.created_at) AS date,
        ts.content as analyzed_content,
        -- Create a basic JSON analysis structure for submissions
        JSON_OBJECT(
          'type', 'task_submission',
          'completion_score', NULL,
          'feedback', CONCAT('Task submission content: ', ts.content),
          'criteria_met', [],
          'areas_for_improvement', [],
          'submission_url', ts.content
        ) as analysis
      FROM \`${taskSubmissionsTable}\` ts
      INNER JOIN \`${usersTable}\` u ON ts.user_id = u.user_id
      LEFT JOIN \`${tasksTable}\` t ON ts.task_id = t.id
      WHERE ts.id = CAST(@autoId AS INT64)
        AND u.role = 'builder'
      LIMIT 1
    `;
    params = { autoId };
  } else {
    // Query task_analysis_results table for UUID auto_ids (original logic)
    query = `
      SELECT 
        tar.auto_id,
      tar.task_id,
      t.task_title,
      tar.user_id,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      tar.curriculum_date AS date,
      tar.analysis,
      tar.analyzed_content,
      tar.learning_type
    FROM \`${taskAnalysisTable}\` tar
    LEFT JOIN \`${usersTable}\` u ON tar.user_id = u.user_id
    LEFT JOIN \`${tasksTable}\` t ON tar.task_id = t.id
      WHERE tar.auto_id = @autoId
      LIMIT 1
  `;
    params = { autoId };
  }

  try {
    // console.log(`Executing BigQuery query for ${req.path} (${isSubmissionId ? 'Submission ID' : 'Analysis Auto ID'}: ${autoId})...`);
    const [rows] = await bigquery.query({ query, params });
    // console.log(`Query for.*finished. Row count: ${rows.length}`);

    if (rows.length === 0) {
      return res.status(404).json({ 
        error: isSubmissionId ? 'Submission not found' : 'Submission details not found for this ID' 
      });
    }

    res.json(rows[0]); // Return the single submission object

  } catch (error) {
    console.error(`Error in ${req.path} (${isSubmissionId ? 'Submission ID' : 'Analysis Auto ID'}: ${autoId}):`, error);
    logger.error(`Error executing BigQuery submission query (${isSubmissionId ? 'Submission ID' : 'Analysis Auto ID'}: ${autoId})`, { 
      error: error.message, 
      stack: error.stack, 
      query: query 
    });
    res.status(500).json({ error: 'Failed to fetch submission details' });
  }
});

// Endpoint to get ALL peer feedback within a date range
app.get('/api/feedback/all', async (req, res) => {
  const { startDate, endDate, level } = req.query;
  const usersTable = '`pursuit-ops.pilot_agent_public.users`';
  const feedbackTable = '`pursuit-ops.pilot_agent_public.peer_feedback`';
  const analysisTable = '`pursuit-ops.pilot_agent_public.feedback_sentiment_analysis`';
  // const enrollmentsTable = '`pursuit-ops.pilot_agent_public.enrollments`'; // DISABLED

  // Basic validation for dates
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Both startDate and endDate are required.' });
  }

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e_reviewer.level = @level AND e_recipient.level = @level' : '';

  // TODO: Add more robust date validation if needed

  const query = `
    SELECT
      pf.id AS feedback_id,
      pf.created_at AS timestamp,
      CONCAT(reviewer.first_name, ' ', reviewer.last_name) AS reviewer_name,
      CONCAT(recipient.first_name, ' ', recipient.last_name) AS recipient_name,
      pf.feedback_text AS feedback,
      fsa.summary,
      fsa.sentiment_category AS sentiment_label,
      fsa.sentiment_score,
      pf.from_user_id,
      pf.to_user_id
    FROM ${feedbackTable} pf
    LEFT JOIN ${analysisTable} fsa ON CAST(pf.id AS STRING) = CAST(fsa.id AS STRING)
    LEFT JOIN ${usersTable} reviewer ON pf.from_user_id = reviewer.user_id
    LEFT JOIN ${usersTable} recipient ON pf.to_user_id = recipient.user_id
    WHERE DATE(pf.created_at) >= DATE(@startDate)
      AND DATE(pf.created_at) <= DATE(@endDate)
      AND reviewer.role = 'builder'
      AND recipient.role = 'builder'
    ORDER BY pf.created_at DESC;
  `;

  const params = { startDate, endDate };

  const options = {
    query: query,
    params: params,
  };

  try {
    const [rows] = await bigquery.query(options);
    res.json(rows);
  } catch (error) {
    console.error('BigQuery Error fetching all peer feedback:', error);
    res.status(500).json({ error: 'Failed to fetch peer feedback data', details: error.message });
  }
});

// Endpoint to get ALL task analysis results within a date range
app.get('/api/analysis/all', async (req, res) => {
  const { startDate, endDate, level } = req.query;
  const usersTable = '`pursuit-ops.pilot_agent_public.users`';
  const tasksTable = '`pursuit-ops.pilot_agent_public.tasks`';
  const analysisTable = '`pursuit-ops.pilot_agent_public.task_analysis_results`';
  // const enrollmentsTable = '`pursuit-ops.pilot_agent_public.enrollments`'; // DISABLED

  // Basic validation for dates
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Both startDate and endDate are required.' });
  }

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e.level = @level' : '';

  // TODO: Add more robust date validation if needed

  const query = `
    SELECT
      tar.auto_id,
      tar.curriculum_date AS date,
      CONCAT(u.first_name, ' ', u.last_name) AS user_name,
      t.task_title AS task_title,
      tar.learning_type,
      tar.analysis,
      tar.analyzed_content,
      tar.user_id,
      tar.task_id
    FROM ${analysisTable} tar
    LEFT JOIN ${usersTable} u ON tar.user_id = u.user_id
    LEFT JOIN ${tasksTable} t ON tar.task_id = t.id
    WHERE DATE(tar.curriculum_date) >= DATE(@startDate)
      AND DATE(tar.curriculum_date) <= DATE(@endDate)
      AND u.role = 'builder'
    ORDER BY tar.curriculum_date DESC, user_name ASC;
  `;

  const params = { startDate, endDate };

  const options = {
    query: query,
    params: params,
  };

  try {
    const [rows] = await bigquery.query(options);
    res.json(rows);
  } catch (error) {
    console.error('BigQuery Error fetching all task analysis:', error);
    res.status(500).json({ error: 'Failed to fetch task analysis data', details: error.message });
  }
});

// NEW Endpoint: Task Summary (Title, Counts, etc.)
app.get('/api/tasks/summary', async (req, res) => {
  const { startDate, endDate } = req.query;
  const tasksTable = '`pursuit-ops.pilot_agent_public.tasks`';
  const analysisTable = '`pursuit-ops.pilot_agent_public.task_analysis_results`';
  const timeBlocksTable = '`pursuit-ops.pilot_agent_public.time_blocks`';
  const curriculumDaysTable = '`pursuit-ops.pilot_agent_public.curriculum_days`'; 
  // Add submission/progress tables
  const submissionsTable = '`pursuit-ops.pilot_agent_public.task_submissions`';
  const progressTable = '`pursuit-ops.pilot_agent_public.user_task_progress`';

  // Basic validation for dates
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Both startDate and endDate are required.' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  const query = `
    WITH TaskBase AS (
      -- Get basic task info and date
      SELECT 
        t.id as task_id,
        t.task_title,
        t.learning_type,
        t.deliverable_type,
        cd.day_date
      FROM ${tasksTable} t
      LEFT JOIN ${timeBlocksTable} tb ON t.block_id = tb.id
      LEFT JOIN ${curriculumDaysTable} cd ON tb.day_id = cd.id
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate) -- Filter tasks by date range here
    ),
    LinkSubmissions AS (
      -- Count distinct users for link tasks with role filtering
      SELECT 
        ts.task_id,
        COUNT(DISTINCT ts.user_id) as link_submission_count
      FROM ${submissionsTable} ts
      INNER JOIN ${usersTable} u ON ts.user_id = u.user_id
      WHERE ts.task_id IN (SELECT task_id FROM TaskBase WHERE deliverable_type = 'link')
        AND u.role = 'builder'
      GROUP BY ts.task_id
    ),
    TextCompletions AS (
      -- Count distinct users for completed text tasks with role filtering
      SELECT 
        utp.task_id,
        COUNT(DISTINCT utp.user_id) as text_completion_count
      FROM ${progressTable} utp
      INNER JOIN ${usersTable} u ON utp.user_id = u.user_id
      WHERE utp.task_id IN (SELECT task_id FROM TaskBase WHERE deliverable_type = 'text')
        AND utp.status = 'completed'
        AND u.role = 'builder'
      GROUP BY utp.task_id
    ),
    AnalysisCounts AS (
      -- Count analysis records for tasks within the date range with role filtering
      -- Exclude access errors (scores of 0) and invalid analyses
      SELECT
        tar.task_id,
        COUNT(tar.auto_id) as analysis_count
      FROM ${analysisTable} tar
      INNER JOIN ${usersTable} u ON tar.user_id = u.user_id
      WHERE DATE(tar.curriculum_date) BETWEEN DATE(@startDate) AND DATE(@endDate)
       AND tar.task_id IN (SELECT task_id FROM TaskBase)
       AND u.role = 'builder'
       -- Filter out access errors and invalid analyses --
       AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
       AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
       AND NOT (
           JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
           ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
           JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
       )
      GROUP BY tar.task_id
    )
    -- Final Select joining all CTEs
    SELECT 
      tb.task_id,
      tb.task_title,
      tb.learning_type,
      tb.day_date,
      COALESCE(ac.analysis_count, 0) as analysis_count,
      -- Combine submission counts based on deliverable type
      CASE tb.deliverable_type
        WHEN 'link' THEN COALESCE(ls.link_submission_count, 0)
        WHEN 'text' THEN COALESCE(tc.text_completion_count, 0)
        ELSE 0 -- Or handle other types if necessary
      END as submission_count
    FROM TaskBase tb
    LEFT JOIN LinkSubmissions ls ON tb.task_id = ls.task_id
    LEFT JOIN TextCompletions tc ON tb.task_id = tc.task_id
    LEFT JOIN AnalysisCounts ac ON tb.task_id = ac.task_id
    -- Filter out tasks with zero submissions OR zero analyses --
    WHERE COALESCE(ac.analysis_count, 0) > 0 
      OR 
      CASE tb.deliverable_type
        WHEN 'link' THEN COALESCE(ls.link_submission_count, 0)
        WHEN 'text' THEN COALESCE(tc.text_completion_count, 0)
        ELSE 0 
      END > 0
    ORDER BY tb.day_date DESC, tb.task_title ASC;
  `;

  const options = {
    query: query,
    params: { startDate, endDate },
  };

  try {
    const [rows] = await bigquery.query(options);
    res.json(rows);
  } catch (error) {
    console.error('BigQuery Error fetching task summary:', error);
    res.status(500).json({ error: 'Failed to fetch task summary data', details: error.message });
  }
});

// NEW Endpoint: Grade Distribution for a Specific Task
app.get('/api/tasks/:taskId/grade-distribution', async (req, res) => {
  const { taskId } = req.params;
  const { startDate, endDate } = req.query; // Keep date optional for now
  const analysisTable = '`pursuit-ops.pilot_agent_public.task_analysis_results`';
  const tasksTable = '`pursuit-ops.pilot_agent_public.tasks`'; // Needed for task_title

  if (!taskId) {
    return res.status(400).json({ error: 'Missing required parameter: taskId' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  // Build the query, similar to the overview one but filtered by taskId
  const query = `
    WITH ValidAnalyses AS (
      SELECT
        SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) as completion_score
      FROM ${analysisTable} tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      WHERE tar.task_id = CAST(@taskId AS INT64)
        -- Optional date filtering --
        ${startDate && endDate ? `AND DATE(tar.curriculum_date) BETWEEN DATE(@startDate) AND DATE(@endDate)` : ''}
        -- Filter out invalid tasks --
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
        AND u.role = 'builder'
        AND NOT (
            JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
            ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
            JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
        )
    ),
    GradedAnalyses AS (
      -- Assign letter grades based on 0-100 score (ensure consistency with utils)
      SELECT
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
      FROM ValidAnalyses
    )
    -- Final count aggregation by grade --
    SELECT 
      grade,
      COUNT(*) as count
    FROM GradedAnalyses
    GROUP BY grade
    ORDER BY grade; -- Order ensures consistent chart rendering
  `;

  // Add date params only if they exist
  const params = { taskId };
  if (startDate && endDate) {
    params.startDate = startDate;
    params.endDate = endDate;
  }

  const options = {
    query: query,
    params: params,
  };

  try {
    const [rows] = await bigquery.query(options);
    // We also need the task title, let's fetch it separately (or join in main query if preferred)
    const taskTitleQuery = `SELECT task_title FROM ${tasksTable} WHERE id = CAST(@taskId AS INT64) LIMIT 1`;
    const [taskTitleRows] = await bigquery.query({ query: taskTitleQuery, params: { taskId } });
    const taskTitle = taskTitleRows.length > 0 ? taskTitleRows[0].task_title : 'Unknown Task';
    
    // Combine results
    res.json({ task_id: taskId, task_title: taskTitle, gradeDistribution: rows });
  } catch (error) {
    console.error(`BigQuery Error fetching grade distribution for task ${taskId}:`, error);
    res.status(500).json({ error: 'Failed to fetch grade distribution data', details: error.message });
  }
});

// --- NEW Endpoint: Get single video analysis details ---
app.get('/api/video-analysis/:videoId', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { videoId } = req.params;
  const datasetName = 'pilot_agent_public';
  const videoAnalysesTable = `${PROJECT_ID}.${datasetName}.video_analyses`;
  const tasksTable = `${PROJECT_ID}.${datasetName}.tasks`;
  const taskSubmissionsTable = `${PROJECT_ID}.${datasetName}.task_submissions`;
  const usersTable = `${PROJECT_ID}.${datasetName}.users`;
  
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  const query = `
    SELECT 
      va.*,
      t.task_title,
      ts.created_at as submission_date,
      ts.content as submission_content,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.email as user_email
    FROM \`${videoAnalysesTable}\` va
    LEFT JOIN \`${tasksTable}\` t ON va.video_id = CAST(t.id AS STRING)
    LEFT JOIN \`${taskSubmissionsTable}\` ts ON va.submission_id = CAST(ts.id AS STRING)
    LEFT JOIN \`${usersTable}\` u ON CAST(va.user_id AS INT64) = u.user_id
    WHERE va.video_id = @videoId
    LIMIT 1
  `;

  try {
    // console.log(`Executing BigQuery query for video analysis ${videoId}...`);
    const [rows] = await bigquery.query({ query, params: { videoId } });
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Video analysis not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching video analysis ${videoId}:`, error);
    res.status(500).json({ error: 'Failed to fetch video analysis details' });
  }
});

// --- NEW Endpoint: Fetch Video Analyses ---
app.get('/api/video-analyses', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { startDate, endDate, userId, level } = req.query;
  // Use the explicit dataset name 'pilot_agent_public' instead of relying on DATASET variable
  const datasetName = 'pilot_agent_public'; // Explicitly set to known working value
  const videoAnalysesTable = `${PROJECT_ID}.${datasetName}.video_analyses`;
  const tasksTable = `${PROJECT_ID}.${datasetName}.tasks`;
  const taskSubmissionsTable = `${PROJECT_ID}.${datasetName}.task_submissions`;
  const enrollmentsTable = `${PROJECT_ID}.${datasetName}.enrollments_native`;
  
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  console.log(`Using table reference: ${videoAnalysesTable}`);

  // Parse cohort-level combination filter (same logic as other endpoints)
  let levelFilterCondition = '';
  let cohortFilter = null;
  let levelOnlyFilter = null;
  
  if (level) {
    // Check if it's a combined filter like "June 2025 - L1"
    const match = level.match(/^(.+) - (.+)$/);
    if (match) {
      cohortFilter = match[1]; // "June 2025"
      levelOnlyFilter = match[2]; // "L1"
      levelFilterCondition = 'AND e.cohort = @cohort AND e.level = @levelOnly';
    } else {
      // Fallback: treat as level-only filter
      levelOnlyFilter = level;
      levelFilterCondition = 'AND e.level = @levelOnly';
    }
  }

  let query = `
    SELECT 
      va.video_id, 
      va.user_id, 
      va.submission_id,
      va.loom_url,
      va.technical_score,
      va.business_score,
      va.professional_skills_score,
      va.technical_score_rationale,
      va.business_score_rationale,
      va.professional_skills_score_rationale,
      t.task_title,
      ts.created_at as submission_date,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${videoAnalysesTable}\` va
    LEFT JOIN \`${tasksTable}\` t ON va.video_id = CAST(t.id AS STRING)
    LEFT JOIN \`${taskSubmissionsTable}\` ts ON va.submission_id = CAST(ts.id AS STRING)
    INNER JOIN \`${PROJECT_ID}.${datasetName}.users\` u ON CAST(va.user_id AS INT64) = u.user_id
    INNER JOIN \`${enrollmentsTable}\` e ON LOWER(u.email) = LOWER(e.builder_email)
    WHERE u.role = 'builder'
      ${levelFilterCondition}
  `;
  
  // Build params object conditionally
  const params = {};
  if (cohortFilter) {
    params.cohort = cohortFilter;
    params.levelOnly = levelOnlyFilter;
  } else if (levelOnlyFilter) {
    params.levelOnly = levelOnlyFilter;
  }
  
  if (userId) {
    query += ` AND va.user_id = @userId`;
    params.userId = userId;
  }
  
  // Add date filtering on submission_date if available
  if (startDate && endDate) {
    query += ` AND (ts.created_at IS NULL OR (ts.created_at >= TIMESTAMP(@startDate) AND ts.created_at <= TIMESTAMP(@endDate)))`;
    params.startDate = startDate;
    params.endDate = endDate;
  }
  
  query += ` ORDER BY ts.created_at DESC NULLS LAST, va.video_id DESC`; // Order by date (if available) then video_id
  
  const options = { 
    query,
    params
  };

  try {
    // console.log(`Executing BigQuery query for ${req.path}...`);
    // console.log(`Filter applied: ${level || 'none'} (cohort: ${cohortFilter}, level: ${levelOnlyFilter})`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    
    // Calculate average score for each video analysis
    const formattedData = rows.map(row => ({
      ...row,
      average_score: Math.round((row.technical_score + row.business_score + row.professional_skills_score) / 3)
    }));
    
    res.json(formattedData);
  } catch (error) {
    console.error(`Error in ${req.path}:`, error);
    logger.error('Error executing BigQuery video analyses query', { 
      error: error.message, 
      stack: error.stack, 
      query: options.query,
      params: options.params,
      table: videoAnalysesTable
    });
    // Include more detailed error information in the response
    res.status(500).json({ 
      error: 'Failed to fetch video analyses', 
      details: error.message,
      dataset: datasetName,
      table: videoAnalysesTable
    });
  }
});

// --- NEW Endpoint: Fetch Video Analysis by ID ---
app.get('/api/video-analyses/:videoId', async (req, res) => {
  // console.log(`Handling request for ${req.path}. BigQuery Client Ready: ${!!bigquery}`);
  const { videoId } = req.params;
  const { level } = req.query;
  // Use the explicit dataset name 'pilot_agent_public' instead of relying on DATASET variable
  const datasetName = 'pilot_agent_public'; // Explicitly set to known working value
  const videoAnalysesTable = `${PROJECT_ID}.${datasetName}.video_analyses`;
  const tasksTable = `${PROJECT_ID}.${datasetName}.tasks`;
  const taskSubmissionsTable = `${PROJECT_ID}.${datasetName}.task_submissions`;
  // const enrollmentsTable = `${PROJECT_ID}.${datasetName}.enrollments`; // DISABLED
  
  if (!videoId) {
    return res.status(400).json({ error: 'Missing required parameter: videoId' });
  }
  if (!bigquery) return res.status(500).json({ error: 'BigQuery client not initialized' });

  console.log(`Using table reference: ${videoAnalysesTable}`);

  // TEMPORARY: Disable level filtering until enrollments table access is fixed
  // const levelFilterCondition = level ? 'AND e.level = @level' : '';

  // First try to find by video_id, then by submission_id if not found
  let query = `
    SELECT 
      va.video_id, 
      va.user_id, 
      va.submission_id,
      va.loom_url,
      va.technical_score,
      va.business_score,
      va.professional_skills_score,
      va.technical_score_rationale,
      va.business_score_rationale,
      va.professional_skills_score_rationale,
      t.task_title,
      ts.created_at as submission_date,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM \`${videoAnalysesTable}\` va
    LEFT JOIN \`${tasksTable}\` t ON va.video_id = CAST(t.id AS STRING)
    LEFT JOIN \`${taskSubmissionsTable}\` ts ON va.submission_id = CAST(ts.id AS STRING)
    INNER JOIN \`${PROJECT_ID}.${datasetName}.users\` u ON CAST(va.user_id AS INT64) = u.user_id
    WHERE (va.video_id = CAST(@videoId AS STRING) OR va.submission_id = CAST(@videoId AS STRING))
      AND u.role = 'builder'
    ORDER BY va.video_id DESC
    LIMIT 1
  `;
  
  const params = { videoId };
  
  const options = { 
    query, 
    params
  };

  try {
    // console.log(`Executing BigQuery query for ${req.path} (Video/Submission ID: ${videoId})...`);
    const [rows] = await bigquery.query(options);
    // console.log(`Query for.*finished. Row count: ${rows.length}`);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Video analysis not found' });
    }
    
    // Calculate average score
    const videoAnalysis = rows[0];
    videoAnalysis.average_score = Math.round(
      (videoAnalysis.technical_score + videoAnalysis.business_score + videoAnalysis.professional_skills_score) / 3
    );
    
    res.json(videoAnalysis);
  } catch (error) {
    console.error(`Error in ${req.path} (Video/Submission ID: ${videoId}):`, error);
    logger.error(`Error executing BigQuery video analysis query (Video/Submission ID: ${videoId})`, { 
      error: error.message, 
      stack: error.stack, 
      query: options.query,
      params: options.params,
      table: videoAnalysesTable
    });
    res.status(500).json({ 
      error: 'Failed to fetch video analysis', 
      details: error.message,
      dataset: datasetName,
      table: videoAnalysesTable
    });
  }
});

// Feedback sentiment analysis endpoint for Cloud Scheduler
app.post('/api/analyze-feedback', async (req, res) => {
  try {
    // Verify the request is from Cloud Scheduler (optional but recommended)
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && (!authHeader || !authHeader.startsWith('Bearer '))) {
      logger.warn('Unauthorized feedback analysis request', { headers: req.headers });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Starting scheduled feedback sentiment analysis via HTTP endpoint');
    
    console.log('Processing only unprocessed feedback to avoid duplicates');
    
    // Run the analysis for all unprocessed feedback (safer approach)
    // This prevents duplicates and only processes new feedback
    await processFeedbackSentiment(null, null, null, true); // true = processAllUnprocessed
    
    logger.info('Scheduled feedback sentiment analysis completed successfully');
    
    res.status(200).json({
      success: true,
      message: 'Feedback sentiment analysis completed successfully (unprocessed only)',
      mode: 'unprocessed-only',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error in scheduled feedback sentiment analysis:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Human review endpoints for demo rating feedback

// Save human review feedback
app.post('/api/human-review', async (req, res) => {
  try {
    console.log('Handling request for POST /api/human-review');
    
    const {
      builder_id,
      task_id,
      submission_id,
      score,
      technical_feedback,
      business_feedback,
      professional_feedback,
      overall_notes,
      selection_status
    } = req.body;

    // Validate required fields
    if (!builder_id || score === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: builder_id and score are required' 
      });
    }

    // Use MERGE to upsert (insert or update) the review in BigQuery
    const upsertQuery = `
      MERGE \`${humanReviewTable}\` AS target
      USING (
        SELECT 
          CAST(@builder_id AS STRING) AS builder_id,
          CAST(@task_id AS STRING) AS task_id,
          CAST(@submission_id AS STRING) AS submission_id,
          @score AS score,
          @technical_feedback AS technical_feedback,
          @business_feedback AS business_feedback,
          @professional_feedback AS professional_feedback,
          @overall_notes AS overall_notes,
          @selection_status AS selection_status
      ) AS source
      ON target.builder_id = source.builder_id
      WHEN MATCHED THEN
        UPDATE SET 
          task_id = COALESCE(source.task_id, target.task_id),
          submission_id = COALESCE(source.submission_id, target.submission_id),
          score = source.score,
          technical_feedback = CASE 
            WHEN source.technical_feedback IS NOT NULL AND source.technical_feedback != '' 
            THEN source.technical_feedback 
            ELSE target.technical_feedback 
          END,
          business_feedback = CASE 
            WHEN source.business_feedback IS NOT NULL AND source.business_feedback != '' 
            THEN source.business_feedback 
            ELSE target.business_feedback 
          END,
          professional_feedback = CASE 
            WHEN source.professional_feedback IS NOT NULL AND source.professional_feedback != '' 
            THEN source.professional_feedback 
            ELSE target.professional_feedback 
          END,
          overall_notes = CASE 
            WHEN source.overall_notes IS NOT NULL AND source.overall_notes != '' 
            THEN source.overall_notes 
            ELSE target.overall_notes 
          END,
          selection_status = source.selection_status,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          builder_id,
          task_id,
          submission_id,
          score,
          technical_feedback,
          business_feedback,
          professional_feedback,
          overall_notes,
          selection_status,
          created_at,
          updated_at
        ) VALUES (
          source.builder_id,
          source.task_id,
          source.submission_id,
          source.score,
          source.technical_feedback,
          source.business_feedback,
          source.professional_feedback,
          source.overall_notes,
          source.selection_status,
          CURRENT_TIMESTAMP(),
          CURRENT_TIMESTAMP()
        )
    `;

    const params = {
      builder_id: String(builder_id), // Explicitly convert to string
      task_id: task_id ? String(task_id) : null,
      submission_id: submission_id ? String(submission_id) : null,
      score: score,
      technical_feedback: technical_feedback || '',
      business_feedback: business_feedback || '',
      professional_feedback: professional_feedback || '',
      overall_notes: overall_notes || '',
      selection_status: selection_status || 'pending'
    };

    await bigquery.query({ 
      query: upsertQuery, 
      params,
      types: {
        builder_id: 'STRING',
        task_id: 'STRING',
        submission_id: 'STRING', 
        score: 'INTEGER',
        technical_feedback: 'STRING',
        business_feedback: 'STRING',
        professional_feedback: 'STRING',
        overall_notes: 'STRING',
        selection_status: 'STRING'
      }
    });

    // console.log(`Human review saved for builder ${builder_id} with score ${score}, task_id: ${task_id}, submission_id: ${submission_id}`);
    logger.info('Human review feedback saved', { 
      builder_id, 
      task_id, 
      submission_id, 
      score,
      selection_status
    });

    res.status(201).json({
      success: true,
      message: 'Human review feedback saved successfully',
      data: {
        builder_id,
        task_id,
        submission_id,
        score
      }
    });

  } catch (error) {
    console.error('Error saving human review:', error);
    logger.error('Error saving human review:', { 
      error: error.message, 
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      error: 'Failed to save human review feedback',
      message: error.message
    });
  }
});

// Get human review feedback for a builder
app.get('/api/human-review/:builderId', async (req, res) => {
  try {
    // console.log('Handling request for GET /api/human-review/:builderId');
    
    const { builderId } = req.params;

    if (!builderId) {
      return res.status(400).json({ error: 'Builder ID is required' });
    }

    const query = `
      SELECT 
        builder_id,
        task_id,
        submission_id,
        score,
        technical_feedback,
        business_feedback,
        professional_feedback,
        overall_notes,
        selection_status,
        created_at,
        updated_at
      FROM \`${humanReviewTable}\`
      WHERE builder_id = @builderId
      ORDER BY updated_at DESC
    `;

    const params = { builderId };
    const [rows] = await bigquery.query({ 
      query, 
      params,
      types: {
        builderId: 'STRING'
      }
    });

    // console.log(`Found ${rows.length} human reviews for builder ${builderId}`);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Error fetching human reviews:', error);
    logger.error('Error fetching human reviews:', { 
      error: error.message, 
      stack: error.stack,
      builderId: req.params.builderId
    });
    res.status(500).json({ 
      error: 'Failed to fetch human review feedback',
      message: error.message
    });
  }
});

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'ai-pilot-feedback-analysis'
  });
});

// Weekly Summary Analysis endpoint
app.get('/api/weekly-summary', async (req, res) => {
  console.log('Handling request for /api/weekly-summary. BigQuery Client Ready:', !!bigquery);
  
  try {
    const { weekStartDate, weekEndDate, level } = req.query; // Add level parameter
    
    if (!weekStartDate) {
      return res.status(400).json({ error: 'weekStartDate parameter is required (YYYY-MM-DD format)' });
    }
    
    // Use provided endDate or calculate week end date (Sunday to Saturday week) for backward compatibility
    const startDate = weekStartDate;
    const endDate = weekEndDate || dayjs(weekStartDate).add(6, 'days').format('YYYY-MM-DD');
    
    console.log(`Generating summary for ${startDate} to ${endDate}${level ? ` (Level: ${level})` : ''}`);
    
    // Parse cohort-level combination filter (same logic as builders endpoint)
    let levelFilterCondition = '';
    let cohortFilter = null;
    let levelOnlyFilter = null;
    
    if (level) {
      // Check if it's a combined filter like "March 2025 - L2"
      const match = level.match(/^(.+) - (.+)$/);
      if (match) {
        cohortFilter = match[1]; // "March 2025"
        levelOnlyFilter = match[2]; // "L2"
        levelFilterCondition = 'AND se.cohort = @cohort AND se.level = @levelOnly';
      } else {
        // Fallback: treat as level-only filter
        levelOnlyFilter = level;
        levelFilterCondition = 'AND se.level = @levelOnly';
      }
    }
    
    const query = `
      WITH UniqueEnrollments AS (
        -- Get the most recent enrollment record per user to ensure one row per user
        SELECT 
          builder_email, 
          cohort, 
          level,
          ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
        FROM \`${enrollmentsTable}\`
      ),
      SingleEnrollmentPerUser AS (
        -- Take only the most recent enrollment per user
        SELECT builder_email, cohort, level
        FROM UniqueEnrollments
        WHERE rn = 1
      ),
      WeeklyTasks AS (
        SELECT DISTINCT
          t.id as task_id,
          t.task_title,
          t.learning_type,
          cd.day_date as assigned_date
        FROM \`${tasksTable}\` t
        LEFT JOIN \`${timeBlocksTable}\` tb ON t.block_id = tb.id
        LEFT JOIN \`${curriculumDaysTable}\` cd ON tb.day_id = cd.id
        INNER JOIN \`${taskAnalysisTable}\` ta_exists ON t.id = ta_exists.task_id
        WHERE cd.day_date >= @startDate
          AND cd.day_date <= @endDate
          -- Filter tasks by cohort - use selected cohort or fallback to March 2025
          AND (
            (@cohort IS NOT NULL AND cd.cohort = @cohort) OR
            (@cohort IS NULL AND (cd.cohort = 'March 2025' OR cd.cohort IS NULL OR cd.cohort = ''))
          )
      ),
      TaskAnalyses AS (
        SELECT 
          ta.task_id,
          ta.user_id,
          ta.analysis,
          ta.curriculum_date,
          ta.auto_id
        FROM \`${taskAnalysisTable}\` ta
        INNER JOIN \`${usersTable}\` u ON ta.user_id = u.user_id
        INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
        WHERE u.role = 'builder'
          ${levelFilterCondition}
      ),
      PeerFeedbackThisWeek AS (
        SELECT 
          pf.feedback_text,
          sa.sentiment_score,
          sa.sentiment_category,
          CONCAT(u_from.first_name, ' ', u_from.last_name) as reviewer_name,
          CONCAT(u_to.first_name, ' ', u_to.last_name) as recipient_name,
          pf.created_at
        FROM \`${peerFeedbackTable}\` pf
        LEFT JOIN \`${sentimentTable}\` sa ON CAST(pf.id AS STRING) = CAST(sa.id AS STRING)
        LEFT JOIN \`${usersTable}\` u_from ON pf.from_user_id = u_from.user_id
        LEFT JOIN \`${usersTable}\` u_to ON pf.to_user_id = u_to.user_id
        INNER JOIN SingleEnrollmentPerUser se_from ON LOWER(u_from.email) = LOWER(se_from.builder_email)
        INNER JOIN SingleEnrollmentPerUser se_to ON LOWER(u_to.email) = LOWER(se_to.builder_email)
        WHERE DATE(pf.created_at) >= @startDate
          AND DATE(pf.created_at) <= @endDate
          AND u_from.role = 'builder'
          AND u_to.role = 'builder'
          ${levelFilterCondition.replace(/se\./g, 'se_from.')}
          ${levelFilterCondition.replace(/se\./g, 'se_to.')}
      ),
      TaskAnalysis AS (
        SELECT 
          wt.task_id,
          wt.task_title,
          wt.learning_type,
          wt.assigned_date,
          
          -- Task analysis results count (numerator) - with level filtering applied
          COUNT(DISTINCT ta.user_id) as analysis_results_count,
          
          -- Dynamic total builders based on task date and level filter
          CASE 
            WHEN @cohort IS NULL AND @levelOnly IS NULL THEN
              CASE 
                WHEN wt.assigned_date < '2025-05-17' THEN (
                  SELECT COUNT(DISTINCT LOWER(builder_email))
                  FROM \`${enrollmentsTable}\`
                  WHERE level = 'L1' AND cohort = 'March 2025'
                )
                ELSE (
                  SELECT COUNT(DISTINCT LOWER(builder_email))
                  FROM \`${enrollmentsTable}\`
                  WHERE level = 'L2' AND cohort = 'March 2025'
                )
              END
            WHEN @cohort IS NOT NULL AND @levelOnly IS NOT NULL THEN (
              SELECT COUNT(DISTINCT LOWER(builder_email))
              FROM \`${enrollmentsTable}\`
              WHERE level = @levelOnly AND cohort = @cohort
            )
            ELSE (
              SELECT COUNT(DISTINCT LOWER(builder_email))
              FROM \`${enrollmentsTable}\`
              WHERE level = @levelOnly
            )
          END as total_builders,
          
          -- Correct submission rate calculation with level filtering
          ROUND(
            COUNT(DISTINCT ta.user_id) * 100.0 / 
            CASE 
              WHEN @cohort IS NULL AND @levelOnly IS NULL THEN
                CASE 
                  WHEN wt.assigned_date < '2025-05-17' THEN (
                    SELECT COUNT(DISTINCT LOWER(builder_email))
                    FROM \`${enrollmentsTable}\`
                    WHERE level = 'L1' AND cohort = 'March 2025'
                  )
                  ELSE (
                    SELECT COUNT(DISTINCT LOWER(builder_email))
                    FROM \`${enrollmentsTable}\`
                    WHERE level = 'L2' AND cohort = 'March 2025'
                  )
                END
              WHEN @cohort IS NOT NULL AND @levelOnly IS NOT NULL THEN (
                SELECT COUNT(DISTINCT LOWER(builder_email))
                FROM \`${enrollmentsTable}\`
                WHERE level = @levelOnly AND cohort = @cohort
              )
              ELSE (
                SELECT COUNT(DISTINCT LOWER(builder_email))
                FROM \`${enrollmentsTable}\`
                WHERE level = @levelOnly
              )
            END, 0
          ) as submission_rate,
          
          -- Grade distribution from analyses (count distinct auto_id to avoid duplicates)
          -- Exclude scores of 0 which are "Document Access Error"
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 93 THEN ta.auto_id END) as grade_aplus_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 85 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 93 THEN ta.auto_id END) as grade_a_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 80 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 85 THEN ta.auto_id END) as grade_aminus_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 70 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 80 THEN ta.auto_id END) as grade_bplus_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 60 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 70 THEN ta.auto_id END) as grade_b_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 50 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 60 THEN ta.auto_id END) as grade_bminus_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) >= 40 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 50 THEN ta.auto_id END) as grade_cplus_count,
          COUNT(DISTINCT CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                     AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) < 40 THEN ta.auto_id END) as grade_c_count,
          
          -- Average score (excluding scores of 0 which are "Document Access Error")
          ROUND(AVG(CASE WHEN JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') IS NOT NULL 
                         AND CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0
                         THEN CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) END), 1) as avg_score,
          
          -- Feedback analysis
          STRING_AGG(JSON_EXTRACT_SCALAR(ta.analysis, '$.feedback'), ' | ') as all_feedback
          
        FROM WeeklyTasks wt
        LEFT JOIN TaskAnalyses ta ON wt.task_id = ta.task_id
        GROUP BY wt.task_id, wt.task_title, wt.learning_type, wt.assigned_date
      )
      
      SELECT 
        -- Overall summary
        (SELECT COUNT(*) FROM WeeklyTasks) as total_tasks_assigned,
        (SELECT COUNT(DISTINCT user_id) FROM TaskAnalyses) as active_builders,
        (SELECT COUNT(*) FROM PeerFeedbackThisWeek WHERE sentiment_category IN ('Negative', 'Very Negative')) as negative_feedback_count,
        (SELECT COUNT(*) FROM PeerFeedbackThisWeek) as total_feedback_count,
        
        -- Task details as JSON array
        ARRAY(
          SELECT AS STRUCT
            task_id,
            task_title,
            learning_type,
            assigned_date,
            analysis_results_count,
            total_builders,
            submission_rate,
            grade_aplus_count,
            grade_a_count, 
            grade_aminus_count,
            grade_bplus_count,
            grade_b_count,
            grade_bminus_count,
            grade_cplus_count,
            grade_c_count,
            avg_score,
            all_feedback
          FROM TaskAnalysis
          ORDER BY assigned_date DESC
        ) as task_details,
        
        -- Negative feedback details as JSON array
        ARRAY(
          SELECT AS STRUCT
            feedback_text,
            sentiment_category,
            sentiment_score,
            reviewer_name,
            recipient_name,
            created_at
          FROM PeerFeedbackThisWeek
          WHERE sentiment_category IN ('Negative', 'Very Negative')
          ORDER BY created_at DESC
        ) as negative_feedback_details,
        
        -- All feedback details as JSON array (not just negative)
        ARRAY(
          SELECT AS STRUCT
            feedback_text,
            sentiment_category,
            sentiment_score,
            reviewer_name,
            recipient_name,
            created_at
          FROM PeerFeedbackThisWeek
          ORDER BY created_at DESC
        ) as all_feedback_details
    `;
    
    // Build params object conditionally (same as builders endpoint)
    const params = { 
      startDate,
      endDate,
      cohort: cohortFilter,
      levelOnly: levelOnlyFilter
    };
    
    const options = {
      query,
      params
    };
    
    console.log('Executing BigQuery query for weekly summary...', { 
      startDate, 
      endDate,
      level,
      cohortFilter,
      levelOnlyFilter
    });
    
    const [rows] = await bigquery.query(options);
    console.log(`Weekly summary query finished. Row count: ${rows.length}`);
    
    if (rows.length === 0) {
      return res.json({
        weekStart: startDate,
        weekEnd: endDate,
        summary: {
          totalTasksAssigned: 0,
          activeBuilders: 0,
          negativeFeedbackCount: 0,
          totalFeedbackCount: 0
        },
        taskDetails: [],
        negativeFeedbackDetails: [],
        allFeedbackDetails: []
      });
    }
    
    const result = rows[0];
    
    res.json({
      weekStart: startDate,
      weekEnd: endDate,
      summary: {
        totalTasksAssigned: result.total_tasks_assigned || 0,
        activeBuilders: result.active_builders || 0,
        negativeFeedbackCount: result.negative_feedback_count || 0,
        totalFeedbackCount: result.total_feedback_count || 0
      },
      taskDetails: result.task_details || [],
      negativeFeedbackDetails: result.negative_feedback_details || [],
      allFeedbackDetails: result.all_feedback_details || []
    });
    
  } catch (error) {
    console.error('Error in weekly summary endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weekly summary data',
      details: error.message 
    });
  }
});

// Task details endpoint for modal
app.get('/api/task-details/:taskId', async (req, res) => {
  try {
    // console.log(`Handling request for /api/task-details/${req.params.taskId}. BigQuery Client Ready: ${!!bigquery}`);
    
    if (!bigquery) {
      return res.status(503).json({ error: 'BigQuery client not ready' });
    }

    const { taskId } = req.params;
    const { startDate, endDate, level } = req.query; // Add level parameter

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Parse cohort-level combination filter (same logic as other endpoints)
    let levelFilterCondition = '';
    let cohortFilter = null;
    let levelOnlyFilter = null;
    
    if (level) {
      // Check if it's a combined filter like "March 2025 - L2"
      const match = level.match(/^(.+) - (.+)$/);
      if (match) {
        cohortFilter = match[1]; // "March 2025"
        levelOnlyFilter = match[2]; // "L2"
        levelFilterCondition = 'AND se.cohort = @cohort AND se.level = @levelOnly';
      } else {
        // Fallback: treat as level-only filter
        levelOnlyFilter = level;
        levelFilterCondition = 'AND se.level = @levelOnly';
      }
    }

    // console.log(`Executing BigQuery query for task details ${taskId}...`);

    const query = `
      WITH UniqueEnrollments AS (
        -- Get the most recent enrollment record per user to ensure one row per user
        SELECT 
          builder_email, 
          cohort, 
          level,
          ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
        FROM \`${enrollmentsTable}\`
      ),
      SingleEnrollmentPerUser AS (
        -- Take only the most recent enrollment per user
        SELECT builder_email, cohort, level
        FROM UniqueEnrollments
        WHERE rn = 1
      ),
      TaskInfo AS (
        SELECT 
          t.id as task_id,
          t.task_title,
          t.task_description,
          cd.day_date as assigned_date,
          cd.cohort as task_cohort
        FROM \`${tasksTable}\` t
        LEFT JOIN \`${timeBlocksTable}\` tb ON t.block_id = tb.id
        LEFT JOIN \`${curriculumDaysTable}\` cd ON tb.day_id = cd.id
        WHERE t.id = @taskId
          -- Filter task by cohort - use selected cohort or fallback to March 2025
          AND (
            (@cohort IS NOT NULL AND cd.cohort = @cohort) OR
            (@cohort IS NULL AND (cd.cohort = 'March 2025' OR cd.cohort IS NULL OR cd.cohort = ''))
          )
      ),
      BuilderResponses AS (
        SELECT 
          ta.task_id,
          ta.user_id as builder_id,
          CONCAT(u.first_name, ' ', u.last_name) as builder_name,
          SAFE_CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) as score,
          ta.auto_id,
          ta.auto_id as submission_id,
          ta.curriculum_date as submission_date,
          ta.analyzed_content as response,
          ta.analysis
        FROM \`${taskAnalysisTable}\` ta
        INNER JOIN \`${usersTable}\` u ON ta.user_id = u.user_id
        INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
        WHERE ta.task_id = @taskId
          AND u.role = 'builder'
          ${levelFilterCondition}
          ${startDate && endDate ? 'AND ta.curriculum_date >= DATE(@startDate) AND ta.curriculum_date <= DATE(@endDate)' : ''}
          -- Filter out access errors and invalid analyses --
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
          AND SAFE_CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) != 0
          AND NOT (
              JSON_EXTRACT_ARRAY(ta.analysis, '$.criteria_met') IS NOT NULL AND 
              ARRAY_LENGTH(JSON_EXTRACT_ARRAY(ta.analysis, '$.criteria_met')) = 1 AND 
              JSON_VALUE(JSON_EXTRACT_ARRAY(ta.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
          )
        ORDER BY ta.curriculum_date DESC
      ),
      TaskStats AS (
        SELECT 
          COUNT(*) as total_submissions,
          AVG(CASE WHEN SAFE_CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) > 0 
                   THEN SAFE_CAST(JSON_EXTRACT_SCALAR(ta.analysis, '$.completion_score') AS FLOAT64) END) as avg_score,
          COUNT(DISTINCT ta.user_id) as unique_builders
        FROM \`${taskAnalysisTable}\` ta
        INNER JOIN \`${usersTable}\` u ON ta.user_id = u.user_id
        INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
        WHERE ta.task_id = @taskId
          AND u.role = 'builder'
          ${levelFilterCondition}
          ${startDate && endDate ? 'AND ta.curriculum_date >= DATE(@startDate) AND ta.curriculum_date <= DATE(@endDate)' : ''}
      ),
      ActiveBuildersCount AS (
        SELECT 
          CASE 
            WHEN @cohort IS NOT NULL AND @levelOnly IS NOT NULL THEN (
              SELECT COUNT(DISTINCT LOWER(builder_email))
              FROM \`${enrollmentsTable}\`
              WHERE level = @levelOnly AND cohort = @cohort
            )
            WHEN @levelOnly IS NOT NULL THEN (
              SELECT COUNT(DISTINCT LOWER(builder_email))
              FROM \`${enrollmentsTable}\`
              WHERE level = @levelOnly
            )
            ELSE (
              -- Fallback to March 2025 cohort logic
              CASE 
                WHEN ti.assigned_date < '2025-05-17' THEN (
                  SELECT COUNT(DISTINCT LOWER(builder_email))
                  FROM \`${enrollmentsTable}\`
                  WHERE level = 'L1' AND cohort = 'March 2025'
                )
                ELSE (
                  SELECT COUNT(DISTINCT LOWER(builder_email))
                  FROM \`${enrollmentsTable}\`
                  WHERE level = 'L2' AND cohort = 'March 2025'
                )
              END
            )
          END as total_active_builders
        FROM TaskInfo ti
      )
      SELECT 
        ti.task_id,
        ti.task_title,
        ti.task_description,
        ti.assigned_date,
        ts.total_submissions,
        ts.avg_score,
        ts.unique_builders,
        abc.total_active_builders,
        ROUND((ts.unique_builders / abc.total_active_builders) * 100, 0) as submission_rate,
        ARRAY_AGG(
          STRUCT(
            br.builder_id,
            br.builder_name,
            br.score,
            br.auto_id,
            br.submission_id,
            br.submission_date,
            br.response,
            br.analysis
          )
        ) as responses
      FROM TaskInfo ti
      CROSS JOIN TaskStats ts
      CROSS JOIN ActiveBuildersCount abc
      LEFT JOIN BuilderResponses br ON ti.task_id = br.task_id
      GROUP BY ti.task_id, ti.task_title, ti.task_description, ti.assigned_date, 
               ts.total_submissions, ts.avg_score, ts.unique_builders, abc.total_active_builders
    `;

    // Build params object conditionally
    const params = {
      taskId: parseInt(taskId, 10), // Convert string to integer
      cohort: cohortFilter,
      levelOnly: levelOnlyFilter,
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    };

    const options = {
      query: query,
      params: params,
      location: BIGQUERY_LOCATION,
    };

    console.log('Task details query params:', options.params);

    const [rows] = await bigquery.query(options);
    console.log(`Task details query finished. Row count: ${rows.length}`);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskDetails = rows[0];
    
    // Clean up the responses array
    const responses = taskDetails.responses || [];
    const cleanedResponses = responses
      .filter(r => r.builder_id) // Remove null entries
      .map(r => ({
        builder_id: r.builder_id,
        builder_name: r.builder_name,
        score: r.score,
        auto_id: r.auto_id,
        submission_id: r.submission_id,
        submission_date: r.submission_date,
        response: r.response,
        analysis: r.analysis
      }));

    const result = {
      task_id: taskDetails.task_id,
      task_title: taskDetails.task_title,
      task_description: taskDetails.task_description,
      assigned_date: taskDetails.assigned_date,
      total_submissions: taskDetails.total_submissions || 0,
      avg_score: taskDetails.avg_score || 0,
      unique_builders: taskDetails.unique_builders || 0,
      total_active_builders: taskDetails.total_active_builders || 0,
      submission_rate: taskDetails.submission_rate || 0,
      responses: cleanedResponses
    };

    res.json(result);

  } catch (error) {
    console.error('Error in /api/task-details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch task details',
      details: error.message 
    });
  }
});

// Root route removed - let React handle the homepage

// API-only mode for Cloud Run - no static file serving needed
console.log('Running in Cloud Run mode - serving React frontend and API');

// Serve static files from React build (after API routes)
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or health check
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Only start the server if this file is run directly
if (require.main === module) {
  const startupPort = port;
  console.log(`Starting server on port ${startupPort} (PORT env var: ${process.env.PORT})`);
  
  app.listen(startupPort, '0.0.0.0', () => {
    console.log(`✅ Server successfully started and listening on port ${startupPort}`);
    console.log(`✅ Server bound to 0.0.0.0:${startupPort}`);
    console.log(`✅ Health check available at: http://0.0.0.0:${startupPort}/health`);
    console.log(`✅ API available at: http://0.0.0.0:${startupPort}/api/test`);
    logger.info(`Server started and running on port ${startupPort}`, {
      port: startupPort,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });
}

// Export the app for testing
module.exports = app;

// Cloud Functions entry point
const functions = require('@google-cloud/functions-framework');

// Register an HTTP function with the Functions Framework
functions.http('analyzeFeedbackHandler', async (req, res) => {
  try {
    console.log('Cloud Function triggered for feedback analysis');
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    // Health check endpoint
    if (req.method === 'GET' && (req.path === '/health' || req.path === '/' || req.path === '')) {
      console.log('Health check requested');
      res.status(200).json({
        status: 'healthy',
        service: 'feedback-sentiment-analysis',
        timestamp: new Date().toISOString(),
        type: 'cloud-function'
      });
      return;
    }
    
    // Feedback analysis endpoint
    if (req.method === 'POST') {
      console.log('Feedback analysis requested via Cloud Function');
      
      console.log('Processing only unprocessed feedback to avoid duplicates');
      
      // Run the analysis for all unprocessed feedback (safer approach)
      // This prevents duplicates and only processes new feedback
      await processFeedbackSentiment(null, null, null, true); // true = processAllUnprocessed
      
      console.log('Feedback sentiment analysis completed successfully');
      
      res.status(200).json({
        success: true,
        message: 'Feedback sentiment analysis completed successfully (unprocessed only)',
        mode: 'unprocessed-only',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Default response for unsupported methods
    res.status(405).json({
      error: 'Method not allowed',
      supportedMethods: ['GET (health check)', 'POST (analyze feedback)']
    });
    
  } catch (error) {
    console.error('Error in Cloud Function:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Add this new endpoint after other API routes, around line 1400