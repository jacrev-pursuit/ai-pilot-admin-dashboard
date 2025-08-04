const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function analyzeCohortTasks() {
  try {
    console.log('🔍 Analyzing task distribution by cohort...\n');

    const startDate = '2025-03-01';
    const endDate = '2025-08-31';

    // First, let's see the breakdown of tasks by cohort
    const cohortBreakdownQuery = `
      SELECT 
          CASE 
            WHEN cd.cohort IS NULL THEN 'NULL'
            WHEN cd.cohort = '' THEN 'EMPTY'
            ELSE cd.cohort
          END as cohort_category,
          cd.cohort as raw_cohort,
          COUNT(DISTINCT t.id) as task_count
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
      GROUP BY cd.cohort
      ORDER BY task_count DESC
    `;

    console.log('📊 Task distribution by cohort:');
    const [cohortRows] = await bigquery.query({ 
      query: cohortBreakdownQuery, 
      params: { startDate, endDate } 
    });

    cohortRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.cohort_category}: ${row.task_count} tasks`);
    });

    // Now let's test the specific logic for June 2025 vs March 2025
    const testLogicQuery = `
      WITH TestCohorts AS (
        SELECT 'March 2025' as test_cohort
        UNION ALL
        SELECT 'June 2025' as test_cohort
      )
      SELECT 
          tc.test_cohort,
          -- Old logic (what was happening before)
          COUNT(DISTINCT CASE 
            WHEN (cd.cohort IS NOT NULL AND cd.cohort != '' AND tc.test_cohort = cd.cohort) OR
                 (cd.cohort IS NULL OR cd.cohort = '' OR cd.cohort = 'March 2025')
            THEN t.id 
          END) as old_logic_count,
          -- New logic (what should happen now)
          COUNT(DISTINCT CASE 
            WHEN (tc.test_cohort = 'March 2025' AND (cd.cohort = 'March 2025' OR cd.cohort IS NULL OR cd.cohort = '')) OR
                 (tc.test_cohort != 'March 2025' AND cd.cohort IS NOT NULL AND cd.cohort != '' AND tc.test_cohort = cd.cohort)
            THEN t.id 
          END) as new_logic_count
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      CROSS JOIN TestCohorts tc
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
      GROUP BY tc.test_cohort
      ORDER BY tc.test_cohort
    `;

    console.log('\n🧪 Comparing old vs new logic:');
    const [testRows] = await bigquery.query({ 
      query: testLogicQuery, 
      params: { startDate, endDate } 
    });

    testRows.forEach(row => {
      console.log(`   ${row.test_cohort}:`);
      console.log(`      • Old Logic: ${row.old_logic_count} tasks`);
      console.log(`      • New Logic: ${row.new_logic_count} tasks`);
      console.log(`      • Difference: ${row.old_logic_count - row.new_logic_count} tasks`);
    });

    // Check specifically for June 2025 tasks
    const juneTasksQuery = `
      SELECT 
          COUNT(DISTINCT t.id) as explicitly_june_tasks
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
        AND cd.cohort = 'June 2025'
    `;

    console.log('\n🎯 June 2025 specific analysis:');
    const [juneRows] = await bigquery.query({ 
      query: juneTasksQuery, 
      params: { startDate, endDate } 
    });

    console.log(`   • Tasks explicitly assigned to June 2025: ${juneRows[0].explicitly_june_tasks}`);

    // Let's see if James's graded tasks are actually from June 2025 cohort
    const jamesTasksQuery = `
      SELECT 
          tar.task_id,
          t.task_title,
          cd.cohort as task_cohort,
          CASE 
            WHEN cd.cohort IS NULL THEN 'NULL'
            WHEN cd.cohort = '' THEN 'EMPTY'
            ELSE cd.cohort
          END as cohort_category
      FROM \`pursuit-ops.pilot_agent_public.task_analysis_results\` tar
      LEFT JOIN \`pursuit-ops.pilot_agent_public.tasks\` t ON tar.task_id = t.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE tar.user_id = 201
        AND tar.curriculum_date BETWEEN DATE(@startDate) AND DATE(@endDate)
    `;

    console.log('\n👤 James Turzio\'s graded tasks analysis:');
    const [jamesRows] = await bigquery.query({ 
      query: jamesTasksQuery, 
      params: { startDate, endDate } 
    });

    jamesRows.forEach((task, index) => {
      console.log(`   ${index + 1}. Task ${task.task_id}: "${task.task_title}"`);
      console.log(`      • Task Cohort: ${task.cohort_category}`);
    });

  } catch (error) {
    console.error('❌ Error analyzing cohort tasks:', error);
  }
}

// Run the analysis
analyzeCohortTasks(); 