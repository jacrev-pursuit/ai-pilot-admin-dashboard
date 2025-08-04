const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function testBuildersFix() {
  try {
    console.log('🧪 Testing builders query fix for se alias conflicts...\n');

    const startDate = '2025-03-01';
    const endDate = '2025-08-31';
    const level = 'June 2025 - L1';
    
    // Parse level just like in the main code
    let levelFilterCondition = '';
    let cohortFilter = null;
    let levelOnlyFilter = null;
    
    if (level) {
      const match = level.match(/^(.+) - (.+)$/);
      if (match) {
        cohortFilter = match[1];
        levelOnlyFilter = match[2];
        levelFilterCondition = 'AND se.cohort = @cohort AND se.level = @levelOnly';
      } else {
        levelOnlyFilter = level;
        levelFilterCondition = 'AND se.level = @levelOnly';
      }
    }

    // Test a simplified version of the builders query structure
    const testQuery = `
      WITH UniqueEnrollments AS (
          SELECT 
              builder_email, 
              cohort, 
              level,
              ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
          FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      ),
      SingleEnrollmentPerUser AS (
          SELECT builder_email, cohort, level
          FROM UniqueEnrollments
          WHERE rn = 1
      ),
             BaseMetrics AS (
           SELECT
               COUNT(*) as user_count,
               'test' as name,
               CONCAT(se.cohort, ' - ', se.level) as level
           FROM \`pursuit-ops.pilot_agent_public.users\` u
           INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
           WHERE u.role = 'builder'
             ${levelFilterCondition}
           GROUP BY se.cohort, se.level
           LIMIT 1
       ),
      PeerFeedbackDistribution AS (
          SELECT
              COUNT(*) as feedback_count
          FROM \`pursuit-ops.pilot_agent_public.peer_feedback\` pf
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u_to ON pf.to_user_id = u_to.user_id
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u_from ON pf.from_user_id = u_from.user_id
          INNER JOIN SingleEnrollmentPerUser se_pfd ON LOWER(u_to.email) = LOWER(se_pfd.builder_email)
          WHERE DATE(pf.created_at) BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u_to.role = 'builder'
            AND u_from.role = 'builder'
            ${levelFilterCondition.replace(/se\./g, 'se_pfd.')}
          LIMIT 1
      ),
      TaskAnalysis AS (
          SELECT COUNT(*) as analysis_count
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_ta ON LOWER(u.email) = LOWER(se_ta.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            ${levelFilterCondition.replace(/se\./g, 'se_ta.')}
          LIMIT 1
      ),
      GradedTasksPerCohort AS (
          SELECT 
              se_gtpc.cohort as user_cohort,
              COUNT(DISTINCT tar.task_id) as total_graded_tasks_for_cohort
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se_gtpc ON LOWER(u.email) = LOWER(se_gtpc.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            ${levelFilterCondition.replace(/se\./g, 'se_gtpc.')}
          GROUP BY se_gtpc.cohort
          LIMIT 1
      )
      SELECT 
          bm.user_count,
          bm.name,
          bm.level,
          pfd.feedback_count,
          ta.analysis_count,
          gtpc.total_graded_tasks_for_cohort
      FROM BaseMetrics bm
      CROSS JOIN PeerFeedbackDistribution pfd
      CROSS JOIN TaskAnalysis ta  
      CROSS JOIN GradedTasksPerCohort gtpc
    `;

    const params = { startDate, endDate };
    if (cohortFilter) {
      params.cohort = cohortFilter;
      params.levelOnly = levelOnlyFilter;
    } else if (levelOnlyFilter) {
      params.levelOnly = levelOnlyFilter;
    }

    console.log('🔍 Testing with parameters:', params);
    const [rows] = await bigquery.query({ query: testQuery, params });
    
    console.log('✅ Query executed successfully!');
    console.log('Result:', rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testBuildersFix(); 