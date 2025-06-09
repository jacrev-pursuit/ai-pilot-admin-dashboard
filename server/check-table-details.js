const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function checkTableDetails() {
  try {
    console.log('Getting detailed table information...');
    
    // Get table metadata
    const query = `
      SELECT 
        table_name,
        table_type,
        table_schema
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.TABLES\` 
      WHERE table_name = 'enrollments'
    `;
    
    const [tables] = await bigquery.query(query);
    console.log('Table details:', JSON.stringify(tables[0], null, 2));
    
    // Also try to get schema information
    const schemaQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS\` 
      WHERE table_name = 'enrollments'
      ORDER BY ordinal_position
    `;
    
    const [columns] = await bigquery.query(schemaQuery);
    console.log('Table columns:', columns);
    
  } catch (error) {
    console.error('❌ Error getting table details:', error.message);
  }
}

checkTableDetails(); 