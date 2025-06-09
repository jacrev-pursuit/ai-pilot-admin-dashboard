const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function debugTaskAnalysis() {
  try {
    console.log('🔍 Debugging Task Analysis Data for Solution Storytelling and Presentation Prep (4/17)...\n');

    // First, let's find the task ID for "Solution Storytelling and Presentation Prep"
    const taskQuery = `
      SELECT 
        t.id as task_id,
        t.task_title,
        cd.day_date
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE LOWER(t.task_title) LIKE '%solution storytelling%'
        AND LOWER(t.task_title) LIKE '%presentation prep%'
        AND cd.day_date = '2025-04-17'
    `;

    console.log('1️⃣ Finding task ID...');
    const [taskRows] = await bigquery.query({ query: taskQuery });
    
    if (taskRows.length === 0) {
      console.log('❌ No task found matching "Solution Storytelling and Presentation Prep" on 4/17');
      return;
    }

    const task = taskRows[0];
    console.log(`✅ Found task: ${task.task_title} (ID: ${task.task_id}) on ${task.day_date}\n`);

    // Now let's check how many analysis records exist for this task
    const analysisCountQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT tar.user_id) as unique_users,
        COUNT(DISTINCT tar.auto_id) as unique_analysis_records
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      WHERE tar.task_id = ${task.task_id}
        AND u.role = 'builder'
    `;

    console.log('2️⃣ Checking analysis record counts...');
    const [countRows] = await bigquery.query({ query: analysisCountQuery });
    const counts = countRows[0];
    
    console.log(`📊 Analysis Records for Task ${task.task_id}:`);
    console.log(`   • Total records: ${counts.total_records}`);
    console.log(`   • Unique users: ${counts.unique_users}`);
    console.log(`   • Unique analysis records: ${counts.unique_analysis_records}\n`);

    // Let's see the breakdown by user to understand duplicates
    const userBreakdownQuery = `
      SELECT 
        tar.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        COUNT(*) as record_count,
        STRING_AGG(DISTINCT tar.auto_id ORDER BY tar.auto_id) as auto_ids,
        STRING_AGG(DISTINCT DATE(tar.curriculum_date) ORDER BY DATE(tar.curriculum_date)) as curriculum_dates
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      WHERE tar.task_id = ${task.task_id}
        AND u.role = 'builder'
      GROUP BY tar.user_id, u.first_name, u.last_name
      ORDER BY record_count DESC
      LIMIT 10
    `;

    console.log('3️⃣ Checking user breakdown (top 10 users with most records)...');
    const [userRows] = await bigquery.query({ query: userBreakdownQuery });
    
    console.log('👥 User Record Breakdown:');
    userRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.user_name} (ID: ${row.user_id}): ${row.record_count} records`);
      console.log(`      Auto IDs: ${row.auto_ids}`);
      console.log(`      Curriculum Dates: ${row.curriculum_dates}`);
    });

    // Check level distribution to see if we're counting across levels
    const levelBreakdownQuery = `
      SELECT 
        e.level,
        COUNT(DISTINCT tar.user_id) as unique_users,
        COUNT(*) as total_records
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      INNER JOIN \`pursuit-ops.pilot_agent_public.enrollments_native\` e ON LOWER(u.email) = LOWER(e.builder_email)
      WHERE tar.task_id = ${task.task_id}
        AND u.role = 'builder'
      GROUP BY e.level
      ORDER BY e.level
    `;

    console.log('\n4️⃣ Checking level breakdown...');
    const [levelRows] = await bigquery.query({ query: levelBreakdownQuery });
    
    console.log('🎯 Level Breakdown:');
    levelRows.forEach(row => {
      console.log(`   • ${row.level}: ${row.unique_users} users, ${row.total_records} records`);
    });

    // Check for March 2025 - L2 specifically
    const l2CountQuery = `
      SELECT 
        COUNT(DISTINCT tar.user_id) as l2_unique_users
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON tar.user_id = u.user_id
      INNER JOIN \`pursuit-ops.pilot_agent_public.enrollments_native\` e ON LOWER(u.email) = LOWER(e.builder_email)
      WHERE tar.task_id = ${task.task_id}
        AND u.role = 'builder'
        AND e.level = 'L2'
        AND e.cohort = 'March 2025'
    `;

    console.log('\n5️⃣ Checking March 2025 - L2 count specifically...');
    const [l2Rows] = await bigquery.query({ query: l2CountQuery });
    
    console.log(`🎯 March 2025 - L2 unique users: ${l2Rows[0].l2_unique_users}`);

  } catch (error) {
    console.error('❌ Error debugging task analysis:', error);
  }
}

// Run the debug function
debugTaskAnalysis(); 