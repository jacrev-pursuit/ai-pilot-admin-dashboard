const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function debugJamerCase() {
  try {
    console.log('🔍 Debugging James Turzio case...\n');

    const startDate = '2025-03-01';
    const endDate = '2025-08-31';

    // First, find Jamer's details
    const userQuery = `
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
      )
      SELECT 
        u.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        se.cohort,
        se.level
      FROM \`pursuit-ops.pilot_agent_public.users\` u
      INNER JOIN SingleEnrollmentPerUser se ON LOWER(u.email) = LOWER(se.builder_email)
      WHERE u.role = 'builder'
        AND LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE '%james%'
        AND LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE '%turzio%'
      LIMIT 1
    `;

    console.log('👤 Finding James Turzio...');
    const [userRows] = await bigquery.query({ query: userQuery });
    
    if (userRows.length === 0) {
      console.log('❌ Could not find James Turzio');
      return;
    }

    const jamer = userRows[0];
    console.log(`✅ Found: ${jamer.name} (ID: ${jamer.user_id})`);
    console.log(`   • Email: ${jamer.email}`);
    console.log(`   • Cohort: ${jamer.cohort}`);
    console.log(`   • Level: ${jamer.level}\n`);

    // Count gradeable tasks for his cohort
    const cohortTasksQuery = `
      SELECT 
          COUNT(DISTINCT t.id) as total_gradeable_tasks
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
        AND (
            (cd.cohort IS NOT NULL AND cd.cohort != '' AND cd.cohort = @userCohort) OR
            (cd.cohort IS NULL OR cd.cohort = '' OR cd.cohort = 'March 2025')
        )
    `;

    console.log(`📊 Counting gradeable tasks for ${jamer.cohort} cohort...`);
    const [cohortRows] = await bigquery.query({ 
      query: cohortTasksQuery, 
      params: { startDate, endDate, userCohort: jamer.cohort } 
    });

    const totalGradeableTasks = cohortRows[0].total_gradeable_tasks;
    console.log(`✅ Found ${totalGradeableTasks} gradeable tasks for ${jamer.cohort} cohort\n`);

    // Count his graded tasks
    const gradedTasksQuery = `
      SELECT 
          COUNT(*) as graded_count
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.tasks\` t ON tar.task_id = t.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.user_id = @userId
        AND u.role = 'builder'
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
        AND NOT (
            JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
            ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
            JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
        )
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
        AND (
            (cd.cohort IS NOT NULL AND cd.cohort != '' AND cd.cohort = @userCohort) OR
            (cd.cohort IS NULL OR cd.cohort = '' OR cd.cohort = 'March 2025')
        )
    `;

    console.log(`📝 Counting James's graded tasks...`);
    const [gradedRows] = await bigquery.query({ 
      query: gradedTasksQuery, 
      params: { startDate, endDate, userId: jamer.user_id, userCohort: jamer.cohort } 
    });

    const gradedCount = gradedRows[0].graded_count;
    console.log(`✅ Found ${gradedCount} graded tasks for James\n`);

    // Calculate exact percentage
    const exactPercentage = (gradedCount / totalGradeableTasks) * 100;
    const roundedPercentage = Math.round(exactPercentage);

    console.log(`🧮 Calculation:`);
    console.log(`   • Graded Tasks: ${gradedCount}`);
    console.log(`   • Total Gradeable Tasks: ${totalGradeableTasks}`);
    console.log(`   • Exact Percentage: ${exactPercentage.toFixed(4)}%`);
    console.log(`   • Rounded Percentage: ${roundedPercentage}%\n`);

    if (roundedPercentage === 0 && gradedCount > 0) {
      console.log(`💡 EXPLANATION: This is a rounding issue!`);
      console.log(`   James has completed ${gradedCount} tasks out of ${totalGradeableTasks} total.`);
      console.log(`   The exact percentage is ${exactPercentage.toFixed(4)}%, which rounds to 0%.`);
      console.log(`   This is mathematically correct but visually misleading.`);
    } else {
      console.log(`❓ This case needs further investigation.`);
    }

    // Show some of his actual graded tasks
    const sampleTasksQuery = `
      SELECT 
          tar.task_id,
          t.task_title,
          tar.curriculum_date,
          cd.cohort as task_cohort,
          SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) as score
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.tasks\` t ON tar.task_id = t.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND tar.user_id = @userId
        AND u.role = 'builder'
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) IS NOT NULL
        AND SAFE_CAST(JSON_EXTRACT_SCALAR(tar.analysis, '$.completion_score') AS FLOAT64) != 0
        AND NOT (
            JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met') IS NOT NULL AND 
            ARRAY_LENGTH(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')) = 1 AND 
            JSON_VALUE(JSON_EXTRACT_ARRAY(tar.analysis, '$.criteria_met')[OFFSET(0)]) = 'Submission received'
        )
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
      ORDER BY tar.curriculum_date DESC
      LIMIT 5
    `;

    console.log(`\n📋 Sample of James's graded tasks:`);
    const [sampleRows] = await bigquery.query({ 
      query: sampleTasksQuery, 
      params: { startDate, endDate, userId: jamer.user_id } 
    });

    sampleRows.forEach((task, index) => {
      console.log(`   ${index + 1}. Task ${task.task_id}: "${task.task_title}" (Score: ${task.score})`);
      console.log(`      • Date: ${task.curriculum_date}`);
      console.log(`      • Task Cohort: ${task.task_cohort || 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error debugging Jamer case:', error);
  }
}

// Run the debug
debugJamerCase(); 