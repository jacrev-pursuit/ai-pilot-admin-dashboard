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

async function checkAuthenticityData() {
  console.log('Checking authenticity score data...\n');
  
  // Check aggregated table
  const query = `
    SELECT 
      analysis_date,
      task_id,
      task_title,
      ai_helper_mode,
      avg_human_authenticity_score,
      avg_student_quality_score,
      total_conversations
    FROM \`${PROJECT_ID}.${DATASET}.conversation_efficacy_aggregated_daily\`
    WHERE analysis_date >= '2025-10-13'
    ORDER BY analysis_date DESC
    LIMIT 10
  `;
  
  const [rows] = await bigquery.query({ query });
  
  console.log('Sample from aggregated table:');
  console.table(rows.map(r => ({
    Date: r.analysis_date.value,
    TaskID: r.task_id,
    Task: r.task_title?.substring(0, 20),
    Mode: r.ai_helper_mode,
    Authenticity: r.avg_human_authenticity_score,
    Quality: r.avg_student_quality_score?.toFixed(2),
    Convos: r.total_conversations
  })));
  
  // Check daily metrics table
  const query2 = `
    SELECT 
      date,
      task_id,
      thread_id,
      human_authenticity_score,
      student_response_quality_score
    FROM \`${PROJECT_ID}.${DATASET}.conversation_efficacy_daily_metrics\`
    WHERE date >= '2025-10-13'
    ORDER BY date DESC
    LIMIT 10
  `;
  
  const [rows2] = await bigquery.query({ query: query2 });
  
  console.log('\nSample from daily metrics table:');
  console.table(rows2.map(r => ({
    Date: r.date.value,
    TaskID: r.task_id,
    ThreadID: r.thread_id,
    Authenticity: r.human_authenticity_score,
    Quality: r.student_response_quality_score?.toFixed(2)
  })));
}

checkAuthenticityData().catch(console.error);
