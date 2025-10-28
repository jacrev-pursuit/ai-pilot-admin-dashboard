const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = process.env.PROJECT_ID;
const DATASET = process.env.BIGQUERY_DATASET || 'pilot_agent_public';

console.log('='.repeat(80));
console.log('Checking Conversation Efficacy Tables');
console.log('='.repeat(80));
console.log(`Project: ${PROJECT_ID}`);
console.log(`Dataset: ${DATASET}`);
console.log('');

// Initialize BigQuery
const bigqueryConfig = {
  projectId: PROJECT_ID,
};

const keyPath = path.join(__dirname, 'service-account-key.json');
const fs = require('fs');
if (fs.existsSync(keyPath)) {
  console.log('Using service account key file for authentication');
  bigqueryConfig.keyFilename = keyPath;
}

const bigquery = new BigQuery(bigqueryConfig);

// Tables to check
const tablesToCheck = [
  'conversation_efficacy_daily_metrics',
  'conversation_efficacy_aggregated_daily',
  'conversation_efficacy_alerts',
  'conversation_efficacy_examples'
];

async function checkTable(tableName) {
  try {
    // Check if table exists
    const tableExistsQuery = `
      SELECT COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET}.__TABLES__\`
      WHERE table_id = '${tableName}'
    `;
    
    const [tableCheck] = await bigquery.query({ query: tableExistsQuery });
    
    if (tableCheck[0].count === 0) {
      console.log(`❌ ${tableName}: NOT FOUND`);
      return { exists: false, rowCount: 0 };
    }
    
    // Table exists, get row count
    const rowCountQuery = `
      SELECT COUNT(*) as row_count
      FROM \`${PROJECT_ID}.${DATASET}.${tableName}\`
    `;
    
    const [rowCountResult] = await bigquery.query({ query: rowCountQuery });
    const rowCount = parseInt(rowCountResult[0].row_count);
    
    console.log(`✅ ${tableName}: EXISTS with ${rowCount.toLocaleString()} rows`);
    
    // Get sample data if rows exist
    if (rowCount > 0) {
      const sampleQuery = `
        SELECT *
        FROM \`${PROJECT_ID}.${DATASET}.${tableName}\`
        LIMIT 1
      `;
      
      const [sampleData] = await bigquery.query({ query: sampleQuery });
      console.log(`   Sample columns: ${Object.keys(sampleData[0]).join(', ')}`);
      
      // Get date range if date column exists
      const dateColumn = tableName.includes('aggregated') ? 'analysis_date' : 
                        tableName.includes('alert') ? 'alert_date' : 'date';
      
      try {
        const dateRangeQuery = `
          SELECT 
            MIN(${dateColumn}) as min_date,
            MAX(${dateColumn}) as max_date
          FROM \`${PROJECT_ID}.${DATASET}.${tableName}\`
        `;
        
        const [dateRange] = await bigquery.query({ query: dateRangeQuery });
        if (dateRange[0].min_date && dateRange[0].max_date) {
          console.log(`   Date range: ${dateRange[0].min_date.value} to ${dateRange[0].max_date.value}`);
        }
      } catch (e) {
        // Date column might not exist
      }
    }
    
    console.log('');
    return { exists: true, rowCount };
    
  } catch (error) {
    console.log(`❌ ${tableName}: ERROR - ${error.message}`);
    console.log('');
    return { exists: false, rowCount: 0, error: error.message };
  }
}

async function checkAllTables() {
  console.log('Checking tables...\n');
  
  const results = {};
  
  for (const tableName of tablesToCheck) {
    results[tableName] = await checkTable(tableName);
  }
  
  console.log('='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  
  const existingTables = Object.entries(results).filter(([_, r]) => r.exists);
  const missingTables = Object.entries(results).filter(([_, r]) => !r.exists);
  
  console.log(`\n✅ Existing tables: ${existingTables.length}/${tablesToCheck.length}`);
  existingTables.forEach(([name, result]) => {
    console.log(`   - ${name}: ${result.rowCount.toLocaleString()} rows`);
  });
  
  if (missingTables.length > 0) {
    console.log(`\n❌ Missing tables: ${missingTables.length}/${tablesToCheck.length}`);
    missingTables.forEach(([name, _]) => {
      console.log(`   - ${name}`);
    });
  }
  
  console.log('\n');
  
  // If all tables exist, show sample query results
  if (existingTables.length === tablesToCheck.length) {
    console.log('='.repeat(80));
    console.log('All tables exist! Fetching sample metrics...');
    console.log('='.repeat(80));
    console.log('');
    
    try {
      // Sample query from aggregated table
      const sampleMetricsQuery = `
        SELECT
          analysis_date,
          ai_helper_mode,
          total_conversations,
          avg_student_quality_score,
          avg_human_authenticity_score,
          avg_completion_rate,
          avg_message_compliance_pct
        FROM \`${PROJECT_ID}.${DATASET}.conversation_efficacy_aggregated_daily\`
        ORDER BY analysis_date DESC
        LIMIT 5
      `;
      
      const [metrics] = await bigquery.query({ query: sampleMetricsQuery });
      
      console.log('Recent aggregated metrics:');
      console.log('');
      console.table(metrics.map(row => ({
        Date: row.analysis_date.value,
        Mode: row.ai_helper_mode,
        Conversations: row.total_conversations,
        'Quality Score': row.avg_student_quality_score?.toFixed(1),
        'Authenticity': row.avg_human_authenticity_score?.toFixed(1),
        'Completion %': (row.avg_completion_rate * 100)?.toFixed(0),
        'Compliance %': row.avg_message_compliance_pct?.toFixed(0)
      })));
      
    } catch (error) {
      console.log(`Error fetching sample metrics: ${error.message}`);
    }
  }
}

// Run the check
checkAllTables().catch(console.error);

