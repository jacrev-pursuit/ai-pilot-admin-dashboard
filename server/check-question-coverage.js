const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = process.env.PROJECT_ID;
const DATASET = 'pilot_agent_public';

const bigqueryConfig = {
  projectId: PROJECT_ID,
  keyFilename: path.join(__dirname, 'service-account-key.json')
};

const bigquery = new BigQuery(bigqueryConfig);

async function checkQuestionCoverage() {
  console.log('Checking question coverage data...\n');
  
  // Check daily metrics
  const query = `
    SELECT 
      task_id,
      thread_id,
      questions_coverage_pct,
      questions_asked_in_order,
      completion_pct,
      date
    FROM \`${PROJECT_ID}.${DATASET}.conversation_efficacy_daily_metrics\`
    WHERE date >= '2025-10-13'
    ORDER BY task_id, date DESC
    LIMIT 20
  `;
  
  const [rows] = await bigquery.query({ query });
  
  console.log('Sample question coverage from daily metrics:');
  console.table(rows.map(r => ({
    TaskID: r.task_id,
    ThreadID: r.thread_id,
    Coverage: r.questions_coverage_pct,
    InOrder: r.questions_asked_in_order,
    Completion: (r.completion_pct * 100).toFixed(0) + '%',
    Date: r.date.value
  })));
  
  // Check aggregated by task
  const query2 = `
    SELECT 
      task_id,
      COUNT(*) as count,
      AVG(questions_coverage_pct) as avg_coverage,
      AVG(CASE WHEN questions_asked_in_order THEN 100.0 ELSE 0.0 END) as pct_in_order,
      AVG(completion_pct) as avg_completion
    FROM \`${PROJECT_ID}.${DATASET}.conversation_efficacy_daily_metrics\`
    WHERE date >= '2025-10-13'
    GROUP BY task_id
    ORDER BY task_id
  `;
  
  const [rows2] = await bigquery.query({ query: query2 });
  
  console.log('\nAggregated question coverage by task:');
  console.table(rows2.map(r => ({
    TaskID: r.task_id,
    Count: r.count,
    'Avg Coverage %': r.avg_coverage?.toFixed(1),
    '% In Order': r.pct_in_order?.toFixed(1),
    'Avg Completion %': (r.avg_completion * 100)?.toFixed(1)
  })));
}

checkQuestionCoverage().catch(console.error);
