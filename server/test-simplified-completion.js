const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function testSimplifiedCompletion() {
  try {
    console.log('🧪 Testing Simplified Completion Percentage Logic...\n');

    const startDate = '2025-03-01';
    const endDate = '2025-08-31';

    // Test the logic for James Turzio specifically
    const testQuery = `
      WITH SingleEnrollmentPerUser AS (
          SELECT 
              builder_email, 
              cohort, 
              level,
              ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
          FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      ),
      UserInfo AS (
          SELECT DISTINCT
              u.user_id,
              CONCAT(u.first_name, ' ', u.last_name) as name,
              se.cohort,
              se.level
          FROM \`pursuit-ops.pilot_agent_public.users\` u
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email) AND se.rn = 1
          WHERE u.role = 'builder'
            AND LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE '%james%'
            AND LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE '%turzio%'
          LIMIT 1
      ),
             GradedTasksPerCohort AS (
           -- Count unique tasks that were actually graded for each cohort (denominator)
           SELECT 
               se.cohort as user_cohort,
               COUNT(DISTINCT tar.task_id) as total_graded_tasks_for_cohort
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            -- Only include valid graded tasks
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
          GROUP BY se.cohort
      ),
             GradedTasksPerUser AS (
           -- Count unique tasks that were actually graded for each user
           SELECT 
               tar.user_id,
               COUNT(DISTINCT tar.task_id) as graded_count
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            -- Only include valid graded tasks (same filters as above)
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
          GROUP BY tar.user_id
      )
      SELECT 
          ui.user_id,
          ui.name,
          ui.cohort,
          ui.level,
          gtpu.graded_count as tasks_graded_for_user,
          gtpc.total_graded_tasks_for_cohort as total_tasks_graded_for_cohort,
          ROUND((COALESCE(gtpu.graded_count, 0) / NULLIF(gtpc.total_graded_tasks_for_cohort, 0)) * 100, 0) as completion_percentage
      FROM UserInfo ui
      LEFT JOIN GradedTasksPerUser gtpu ON ui.user_id = gtpu.user_id
      LEFT JOIN GradedTasksPerCohort gtpc ON ui.cohort = gtpc.user_cohort
    `;

    console.log('🔍 Testing for James Turzio:');
    const [jamesRows] = await bigquery.query({ 
      query: testQuery, 
      params: { startDate, endDate } 
    });

    if (jamesRows.length === 0) {
      console.log('❌ James Turzio not found');
      return;
    }

    const james = jamesRows[0];
    console.log(`👤 ${james.name} (${james.cohort})`);
    console.log(`   • User ID: ${james.user_id}`);
    console.log(`   • Tasks graded for James: ${james.tasks_graded_for_user}`);
    console.log(`   • Total tasks graded for ${james.cohort}: ${james.total_tasks_graded_for_cohort}`);
    console.log(`   • Completion percentage: ${james.completion_percentage}%`);

    // Test a few more users from different cohorts
    console.log('\n🔍 Testing other users:');
    const otherUsersQuery = `
      WITH SingleEnrollmentPerUser AS (
          SELECT 
              builder_email, 
              cohort, 
              level,
              ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
          FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      ),
      UserInfo AS (
          SELECT DISTINCT
              u.user_id,
              CONCAT(u.first_name, ' ', u.last_name) as name,
              se.cohort,
              se.level
          FROM \`pursuit-ops.pilot_agent_public.users\` u
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email) AND se.rn = 1
          WHERE u.role = 'builder'
      ),
      GradedTasksPerCohort AS (
          SELECT 
              se.cohort as user_cohort,
              COUNT(DISTINCT tar.task_id) as total_graded_tasks_for_cohort
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
          GROUP BY se.cohort
      ),
      GradedTasksPerUser AS (
          SELECT 
              tar.user_id,
              COUNT(DISTINCT tar.task_id) as graded_count
          FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
          INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
          INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
          WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
            AND u.role = 'builder'
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
            AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
            AND NOT (
                JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
                ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
                JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
            )
          GROUP BY tar.user_id
      )
      SELECT 
          ui.user_id,
          ui.name,
          ui.cohort,
          ui.level,
          gtpu.graded_count as tasks_graded_for_user,
          gtpc.total_graded_tasks_for_cohort as total_tasks_graded_for_cohort,
          ROUND((COALESCE(gtpu.graded_count, 0) / NULLIF(gtpc.total_graded_tasks_for_cohort, 0)) * 100, 0) as completion_percentage
      FROM UserInfo ui
      LEFT JOIN GradedTasksPerUser gtpu ON ui.user_id = gtpu.user_id
      LEFT JOIN GradedTasksPerCohort gtpc ON ui.cohort = gtpc.user_cohort
      WHERE gtpu.graded_count > 0  -- Only show users with graded tasks
      ORDER BY ui.cohort, completion_percentage DESC
      LIMIT 10
    `;

    const [otherRows] = await bigquery.query({ 
      query: otherUsersQuery, 
      params: { startDate, endDate } 
    });

    otherRows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.cohort})`);
      console.log(`      • Tasks graded: ${user.tasks_graded_for_user} / ${user.total_tasks_graded_for_cohort} = ${user.completion_percentage}%`);
    });

    // Show cohort totals
    console.log('\n📊 Cohort Summary:');
    const cohortSummaryQuery = `
      WITH SingleEnrollmentPerUser AS (
          SELECT 
              builder_email, 
              cohort, 
              level,
              ROW_NUMBER() OVER (PARTITION BY LOWER(builder_email) ORDER BY cohort DESC, level DESC) as rn
          FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      )
      SELECT 
          se.cohort,
          COUNT(DISTINCT tar.task_id) as total_graded_tasks_for_cohort
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
      WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND u.role = 'builder'
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
        AND NOT (
            JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
            ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
            JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
        )
      GROUP BY se.cohort
      ORDER BY total_graded_tasks_for_cohort DESC
    `;

    const [cohortRows] = await bigquery.query({ 
      query: cohortSummaryQuery, 
      params: { startDate, endDate } 
    });

    cohortRows.forEach((cohort, index) => {
      console.log(`   ${index + 1}. ${cohort.cohort}: ${cohort.total_graded_tasks_for_cohort} graded tasks`);
    });

  } catch (error) {
    console.error('❌ Error testing simplified completion logic:', error);
  }
}

// Run the test
testSimplifiedCompletion(); 