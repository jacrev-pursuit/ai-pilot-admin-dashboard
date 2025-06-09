const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function checkCohortLevelCombinations() {
  console.log('🔍 Checking available Cohort-Level combinations...\n');
  
  try {
    const query = `
      SELECT 
        cohort,
        level,
        COUNT(*) as count,
        CONCAT(cohort, ' - ', level) as combined_filter
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      WHERE cohort IS NOT NULL AND level IS NOT NULL
        AND cohort != '' AND level != ''
      GROUP BY cohort, level
      ORDER BY cohort, level
    `;
    
    const [rows] = await bigquery.query(query);
    
    console.log('📊 Available Cohort-Level combinations:');
    rows.forEach(row => {
      console.log(`   "${row.combined_filter}": ${row.count} users`);
    });
    
    console.log(`\n✅ Total combinations: ${rows.length}`);
    console.log(`✅ Total users: ${rows.reduce((sum, row) => sum + row.count, 0)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkCohortLevelCombinations(); 