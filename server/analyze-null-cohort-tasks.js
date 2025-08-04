const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function analyzeNullCohortTasks() {
  try {
    console.log('🔍 Analyzing NULL cohort tasks...\n');

    const startDate = '2025-03-01';
    const endDate = '2025-08-31';

    // First, let's look at the NULL cohort tasks in detail
    const nullTasksQuery = `
      SELECT 
          t.id as task_id,
          t.task_title,
          t.deliverable_type,
          tb.id as time_block_id,
          cd.id as curriculum_day_id,
          cd.day_date,
          cd.cohort,
          CASE 
            WHEN cd.cohort IS NULL THEN 'NULL'
            WHEN cd.cohort = '' THEN 'EMPTY'
            ELSE cd.cohort
          END as cohort_category
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
        AND t.deliverable_type IN ('text', 'link', 'document', 'video')
        AND cd.cohort IS NULL
      ORDER BY cd.day_date, t.id
      LIMIT 20
    `;

    console.log('📋 Sample of NULL cohort tasks:');
    const [nullRows] = await bigquery.query({ 
      query: nullTasksQuery, 
      params: { startDate, endDate } 
    });

    if (nullRows.length === 0) {
      console.log('   ✅ No NULL cohort tasks found!');
    } else {
      nullRows.forEach((task, index) => {
        console.log(`   ${index + 1}. Task ${task.task_id}: "${task.task_title}" (${task.deliverable_type})`);
        console.log(`      • Date: ${task.day_date}`);
        console.log(`      • Curriculum Day ID: ${task.curriculum_day_id}`);
        console.log(`      • Time Block ID: ${task.time_block_id}`);
        console.log(`      • Cohort: ${task.cohort_category}`);
        console.log('');
      });
    }

    // Let's check if there are tasks that don't have proper joins
    const orphanTasksQuery = `
      SELECT 
          t.id as task_id,
          t.task_title,
          t.deliverable_type,
          t.block_id,
          tb.id as time_block_id,
          tb.day_id,
          cd.id as curriculum_day_id,
          cd.day_date,
          cd.cohort,
          CASE 
            WHEN tb.id IS NULL THEN 'Missing time_block'
            WHEN cd.id IS NULL THEN 'Missing curriculum_day'
            WHEN cd.cohort IS NULL THEN 'NULL cohort'
            WHEN cd.cohort = '' THEN 'EMPTY cohort'
            ELSE 'OK'
          END as issue_type
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE t.deliverable_type IN ('text', 'link', 'document', 'video')
        AND (
          cd.day_date BETWEEN DATE(@startDate) AND DATE(@endDate) OR
          cd.day_date IS NULL
        )
        AND (
          tb.id IS NULL OR 
          cd.id IS NULL OR 
          cd.cohort IS NULL OR 
          cd.cohort = ''
        )
      ORDER BY issue_type, t.id
      LIMIT 20
    `;

    console.log('\n🔍 Tasks with join or cohort issues:');
    const [orphanRows] = await bigquery.query({ 
      query: orphanTasksQuery, 
      params: { startDate, endDate } 
    });

    if (orphanRows.length === 0) {
      console.log('   ✅ No orphan tasks found!');
    } else {
      orphanRows.forEach((task, index) => {
        console.log(`   ${index + 1}. Task ${task.task_id}: "${task.task_title}" (${task.deliverable_type})`);
        console.log(`      • Issue: ${task.issue_type}`);
        console.log(`      • Block ID: ${task.block_id} → Time Block ID: ${task.time_block_id}`);
        console.log(`      • Day ID: ${task.day_id} → Curriculum Day ID: ${task.curriculum_day_id}`);
        console.log(`      • Date: ${task.day_date || 'NULL'}`);
        console.log(`      • Cohort: ${task.cohort || 'NULL'}`);
        console.log('');
      });
    }

    // Let's count the different types of issues
    const issueCountQuery = `
      SELECT 
          CASE 
            WHEN tb.id IS NULL THEN 'Missing time_block'
            WHEN cd.id IS NULL THEN 'Missing curriculum_day'
            WHEN cd.day_date < DATE(@startDate) OR cd.day_date > DATE(@endDate) THEN 'Outside date range'
            WHEN cd.cohort IS NULL THEN 'NULL cohort'
            WHEN cd.cohort = '' THEN 'EMPTY cohort'
            ELSE 'OK'
          END as issue_type,
          COUNT(DISTINCT t.id) as task_count
      FROM \`pursuit-ops.pilot_agent_public.tasks\` t
      LEFT JOIN \`pursuit-ops.pilot_agent_public.time_blocks\` tb ON t.block_id = tb.id
      LEFT JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON tb.day_id = cd.id
      WHERE t.deliverable_type IN ('text', 'link', 'document', 'video')
      GROUP BY issue_type
      ORDER BY task_count DESC
    `;

    console.log('\n📊 Task issue breakdown:');
    const [issueRows] = await bigquery.query({ 
      query: issueCountQuery, 
      params: { startDate, endDate } 
    });

    issueRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.issue_type}: ${row.task_count} tasks`);
    });

    // Let's specifically check curriculum_days table for the date range
    const curriculumDaysQuery = `
      SELECT 
          cohort,
          CASE 
            WHEN cohort IS NULL THEN 'NULL'
            WHEN cohort = '' THEN 'EMPTY'
            ELSE cohort
          END as cohort_category,
          COUNT(*) as day_count,
          MIN(day_date) as earliest_date,
          MAX(day_date) as latest_date
      FROM \`pursuit-ops.pilot_agent_public.curriculum_days\`
      WHERE day_date BETWEEN DATE(@startDate) AND DATE(@endDate)
      GROUP BY cohort
      ORDER BY day_count DESC
    `;

    console.log('\n📅 Curriculum days by cohort in date range:');
    const [curriculumRows] = await bigquery.query({ 
      query: curriculumDaysQuery, 
      params: { startDate, endDate } 
    });

    curriculumRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.cohort_category}: ${row.day_count} days (${row.earliest_date} to ${row.latest_date})`);
    });

  } catch (error) {
    console.error('❌ Error analyzing NULL cohort tasks:', error);
  }
}

// Run the analysis
analyzeNullCohortTasks(); 