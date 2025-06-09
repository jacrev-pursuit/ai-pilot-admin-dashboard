const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function checkEnrollmentsTable() {
  try {
    console.log('Checking if enrollments table exists...');
    
    // First, list all tables in the dataset
    const query1 = `
      SELECT table_name 
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.TABLES\` 
      WHERE table_name = 'enrollments'
    `;
    
    console.log('Running query:', query1);
    const [tables] = await bigquery.query(query1);
    console.log('Tables found:', tables);
    
    if (tables.length === 0) {
      console.log('❌ Enrollments table does not exist');
      
      // List all tables to see what's available
      const query2 = `
        SELECT table_name 
        FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.TABLES\`
        ORDER BY table_name
      `;
      
      const [allTables] = await bigquery.query(query2);
      console.log('Available tables:', allTables.map(t => t.table_name));
    } else {
      console.log('✅ Enrollments table exists');
      
      // Try to get sample data
      const query3 = `
        SELECT DISTINCT level 
        FROM \`pursuit-ops.pilot_agent_public.enrollments\` 
        WHERE level IS NOT NULL 
        LIMIT 5
      `;
      
      const [levels] = await bigquery.query(query3);
      console.log('Sample levels:', levels);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 403) {
      console.log('This is a permissions issue. The service account may not have access to BigQuery or the dataset.');
    }
  }
}

checkEnrollmentsTable(); 