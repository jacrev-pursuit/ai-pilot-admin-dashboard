const { BigQuery } = require('@google-cloud/bigquery');

async function showSchema() {
  try {
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: 'pursuit-ops',
      keyFilename: './service_account.json'
    });

    console.log('Fetching schema information...\n');

    // Query to get all tables
    const tablesQuery = `
      SELECT 
        table_name,
        COUNT(*) as column_count
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS\`
      GROUP BY table_name
      ORDER BY table_name;
    `;

    const [tables] = await bigquery.query({ query: tablesQuery });
    
    // For each table, get its columns
    for (const table of tables) {
      console.log(`\nTable: ${table.table_name} (${table.column_count} columns)`);
      console.log('----------------------------------------');

      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS\`
        WHERE table_name = '${table.table_name}'
        ORDER BY ordinal_position;
      `;

      const [columns] = await bigquery.query({ query: columnsQuery });
      
      columns.forEach(column => {
        console.log(`${column.column_name} (${column.data_type})${column.is_nullable === 'YES' ? ' - nullable' : ''}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

showSchema(); 