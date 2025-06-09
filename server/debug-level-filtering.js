const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function debugLevelFiltering() {
  try {
    console.log('🔍 Debugging Level Filtering for March 2025 - L2...\n');

    // Test the level filtering logic
    const level = 'March 2025 - L2';
    const levelParts = level.split(' - ');
    const cohort = levelParts[0]; // "March 2025"
    const levelOnly = levelParts[1]; // "L2"
    
    console.log(`📊 Level parameter: "${level}"`);
    console.log(`📊 Parsed cohort: "${cohort}"`);
    console.log(`📊 Parsed level: "${levelOnly}"\n`);

    // Check how many total builders are in March 2025 - L2
    const totalBuildersQuery = `
      SELECT COUNT(DISTINCT LOWER(builder_email)) as total_l2_builders
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      WHERE level = 'L2' AND cohort = 'March 2025'
    `;

    console.log('1️⃣ Checking total L2 builders...');
    const [totalRows] = await bigquery.query({ query: totalBuildersQuery });
    console.log(`Total March 2025 - L2 builders: ${totalRows[0].total_l2_builders}\n`);

    // Check how many L2 builders have analysis records for task 175
    const l2AnalysisQuery = `
      SELECT 
        COUNT(DISTINCT tar.user_id) as l2_users_with_analysis,
        COUNT(*) as total_l2_analysis_records
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      INNER JOIN \`pursuit-ops.pilot_agent_public.enrollments_native\` e ON LOWER(u.email) = LOWER(e.builder_email)
      WHERE tar.task_id = 175
        AND u.role = 'builder'
        AND e.level = 'L2'
        AND e.cohort = 'March 2025'
    `;

    console.log('2️⃣ Checking L2 analysis records for task 175...');
    const [l2Rows] = await bigquery.query({ query: l2AnalysisQuery });
    console.log(`L2 users with analysis: ${l2Rows[0].l2_users_with_analysis}`);
    console.log(`Total L2 analysis records: ${l2Rows[0].total_l2_analysis_records}\n`);

    // Check what the current weekly summary query logic would return for task 175
    const weeklyTasksQuery = `
      WITH WeeklyTasks AS (
        SELECT DISTINCT
          t.id as task_id,
          t.task_title,
          t.learning_type,
          cd.day_date as assigned_date
        FROM \`pursuit-ops.pilot_agent_public.tasks\` t
        LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
        LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
        INNER JOIN \`pursuit-ops.pilot_agent_public.task_analysis_results\` ta_exists ON t.id = ta_exists.task_id
        WHERE cd.day_date >= '2025-04-16'
          AND cd.day_date <= '2025-04-22'
          AND t.id = 175
      ),
      TaskAnalyses AS (
        SELECT 
          ta.task_id,
          ta.user_id,
          ta.analysis,
          ta.curriculum_date,
          ta.auto_id
        FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` ta
        INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON ta.user_id = u.user_id
        WHERE u.role = 'builder'
      )
      SELECT 
        wt.task_id,
        wt.task_title,
        COUNT(DISTINCT ta.user_id) as total_analysis_users,
        COUNT(DISTINCT CASE 
          WHEN e.level = 'L2' AND e.cohort = 'March 2025' THEN ta.user_id 
          ELSE NULL 
        END) as l2_analysis_users,
        COUNT(*) as total_analysis_records
      FROM WeeklyTasks wt
      LEFT JOIN TaskAnalyses ta ON wt.task_id = ta.task_id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.users\` u ON ta.user_id = u.user_id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.enrollments_native\` e ON LOWER(u.email) = LOWER(e.builder_email)
      GROUP BY wt.task_id, wt.task_title
    `;

    console.log('3️⃣ Testing current weekly summary logic...');
    const [weeklyRows] = await bigquery.query({ query: weeklyTasksQuery });
    
    if (weeklyRows.length > 0) {
      const result = weeklyRows[0];
      console.log(`Task 175 (${result.task_title}):`);
      console.log(`  • Total analysis users: ${result.total_analysis_users}`);
      console.log(`  • L2 analysis users: ${result.l2_analysis_users}`);
      console.log(`  • Total analysis records: ${result.total_analysis_records}`);
    }

  } catch (error) {
    console.error('❌ Error debugging level filtering:', error);
  }
}

// Run the debug function
debugLevelFiltering(); 