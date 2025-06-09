const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

const datasetId = 'pilot_agent_public';
const tableId = 'task_feedback_summaries';

async function createTaskFeedbackSummariesTable() {
  try {
    console.log('Creating task_feedback_summaries table...');

    const schema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'task_id', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'week_start_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'week_end_date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'task_title', type: 'STRING', mode: 'NULLABLE' },
      { name: 'learning_type', type: 'STRING', mode: 'NULLABLE' },
      { name: 'assigned_date', type: 'DATE', mode: 'NULLABLE' },
      { name: 'total_submissions', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'feedback_summary', type: 'STRING', mode: 'NULLABLE' },
      { name: 'trends_identified', type: 'STRING', mode: 'NULLABLE' },
      { name: 'standout_builders', type: 'STRING', mode: 'NULLABLE' },
      { name: 'struggling_builders', type: 'STRING', mode: 'NULLABLE' },
      { name: 'key_insights', type: 'STRING', mode: 'NULLABLE' },
      { name: 'raw_openai_response', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'openai_model_used', type: 'STRING', mode: 'NULLABLE' },
      { name: 'prompt_version', type: 'STRING', mode: 'NULLABLE' }
    ];

    const options = {
      schema: schema,
      location: 'us-central1',
    };

    // Create the table
    const [table] = await bigquery
      .dataset(datasetId)
      .createTable(tableId, options);

    console.log(`✅ Table ${table.id} created successfully in dataset ${datasetId}`);
    
    // Display the schema
    console.log('\n📋 Table Schema:');
    table.metadata.schema.fields.forEach(field => {
      console.log(`  • ${field.name}: ${field.type} (${field.mode})`);
    });

  } catch (error) {
    if (error.code === 409) {
      console.log(`ℹ️  Table ${tableId} already exists in dataset ${datasetId}`);
      
      // Get existing table info
      const table = bigquery.dataset(datasetId).table(tableId);
      const [metadata] = await table.getMetadata();
      
      console.log('\n📋 Existing Table Schema:');
      metadata.schema.fields.forEach(field => {
        console.log(`  • ${field.name}: ${field.type} (${field.mode})`);
      });
    } else {
      console.error('❌ Error creating table:', error);
    }
  }
}

// Run the function
createTaskFeedbackSummariesTable(); 