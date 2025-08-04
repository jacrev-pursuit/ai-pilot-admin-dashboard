const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'pursuit-ops',
  location: 'us-central1',
  keyFilename: path.join(__dirname, 'service-account-key.json'),
});

async function checkEnrollments() {
  try {
    console.log('🔍 Checking distinct cohorts and levels in enrollments_native...\n');
    
    const query = `
      SELECT DISTINCT cohort, level, CONCAT(cohort, ' - ', level) as combined_level
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      ORDER BY cohort ASC, level ASC
    `;
    
    const [rows] = await bigquery.query({ query });
    console.log('📊 All cohort-level combinations in enrollments_native:');
    rows.forEach(row => console.log(`  • ${row.combined_level}`));
    
    console.log('\n🔗 Checking which ones have matching users...\n');
    
    const queryWithUsers = `
      SELECT DISTINCT e.cohort, e.level, CONCAT(e.cohort, ' - ', e.level) as combined_level
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level IS NOT NULL
        AND e.level != ''
        AND e.cohort IS NOT NULL
        AND e.cohort != ''
      ORDER BY e.cohort ASC, e.level ASC
    `;
    
    const [rowsWithUsers] = await bigquery.query({ query: queryWithUsers });
    console.log('👥 Cohort-level combinations with matching builder users:');
    rowsWithUsers.forEach(row => console.log(`  • ${row.combined_level}`));
    
    console.log('\n📧 Checking June 2025 email details...\n');
    
    const juneQuery = `
      SELECT builder_email, cohort, level
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      WHERE cohort = 'June 2025'
      LIMIT 5
    `;
    
    const [juneRows] = await bigquery.query({ query: juneQuery });
    console.log('📋 Sample June 2025 enrollment records:');
    juneRows.forEach(row => console.log(`  • ${row.builder_email} (${row.cohort} - ${row.level})`));
    
    if (juneRows.length > 0) {
      console.log('\n🔍 Checking if these emails exist in users table...\n');
      
      const userQuery = `
        SELECT email, role
        FROM \`pursuit-ops.pilot_agent_public.users\`
        WHERE email IN (${juneRows.map(r => `'${r.builder_email}'`).join(', ')})
      `;
      
      const [userRows] = await bigquery.query({ query: userQuery });
      console.log('👤 Matching users found:');
      userRows.forEach(row => console.log(`  • ${row.email} (role: ${row.role})`));
      
      if (userRows.length === 0) {
        console.log('❌ No matching users found for June 2025 emails!');
        console.log('💡 This explains why June 2025 - L1 is not showing in the dropdown');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEnrollments(); 