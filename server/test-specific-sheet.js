const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function testSpecificSheet() {
  console.log('🧪 Testing access to the specific Google Sheet used by enrollments table...\n');
  
  const SHEET_ID = '1eeVTYQU6erVFGd0KuWpTfb6a8i5buxJB0Q9kGOnv_E0';
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
  
  console.log('📊 Sheet Information:');
  console.log(`   ID: ${SHEET_ID}`);
  console.log(`   URL: ${SHEET_URL}`);
  console.log('');
  
  console.log('🔧 Required Steps:');
  console.log('1. Open the Google Sheet URL above');
  console.log('2. Click "Share" button in top right');
  console.log('3. Add this email as Viewer: bq-nlp@pursuit-ops.iam.gserviceaccount.com');
  console.log('4. Make sure permission is set to "Viewer"');
  console.log('5. Click "Send"');
  console.log('');
  
  // Test direct query
  console.log('🧪 Testing BigQuery external table access...');
  
  try {
    // Try a simple query first
    const simpleQuery = `
      SELECT COUNT(*) as total_rows
      FROM \`pursuit-ops.pilot_agent_public.enrollments\`
    `;
    
    console.log('   Running count query...');
    const [countResult] = await bigquery.query(simpleQuery);
    console.log('   ✅ SUCCESS! Total rows:', countResult[0].total_rows);
    console.log('');
    
    // Try getting distinct levels
    const levelsQuery = `
      SELECT DISTINCT level, COUNT(*) as count
      FROM \`pursuit-ops.pilot_agent_public.enrollments\`
      WHERE level IS NOT NULL AND level != ''
      GROUP BY level
      ORDER BY level
    `;
    
    console.log('   Running levels query...');
    const [levelsResult] = await bigquery.query(levelsQuery);
    console.log('   ✅ SUCCESS! Available levels:');
    levelsResult.forEach(row => {
      console.log(`      - ${row.level}: ${row.count} users`);
    });
    console.log('');
    
    // Try the full API query
    const apiQuery = `
      SELECT DISTINCT e.level
      FROM \`pursuit-ops.pilot_agent_public.enrollments\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level IS NOT NULL
        AND e.level != ''
      ORDER BY e.level ASC
    `;
    
    console.log('   Running API-style query...');
    const [apiResult] = await bigquery.query(apiQuery);
    console.log('   ✅ SUCCESS! API levels:', apiResult.map(r => r.level));
    console.log('');
    
    console.log('🎉 ALL TESTS PASSED!');
    console.log('Your enrollments table is working correctly.');
    console.log('The levels filter should now work with real data!');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.log('');
    
    if (error.message.includes('Permission denied while getting Drive credentials')) {
      console.log('🔧 ISSUE: Google Drive permission problem');
      console.log('');
      console.log('TROUBLESHOOTING:');
      console.log(`1. Double-check you added bq-nlp@pursuit-ops.iam.gserviceaccount.com to:`);
      console.log(`   ${SHEET_URL}`);
      console.log('2. Make sure the permission is set to "Viewer" (not "Commenter" or "Editor")');
      console.log('3. Try waiting 5-10 minutes for permissions to propagate');
      console.log('4. Check if the sheet has any access restrictions or is in a restricted Drive folder');
      console.log('');
    } else {
      console.log('🔧 ISSUE: Different error occurred');
      console.log('Error details:', error.message);
      console.log('');
    }
  }
}

testSpecificSheet(); 