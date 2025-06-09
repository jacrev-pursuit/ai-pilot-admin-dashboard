const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function testDriveAccess() {
  console.log('🧪 Testing Google Drive API access for BigQuery external tables...\n');
  
  try {
    // Test 1: Check if enrollments table exists
    console.log('1️⃣ Checking if enrollments table exists...');
    const tableExistsQuery = `
      SELECT table_name, table_type 
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.TABLES\` 
      WHERE table_name = 'enrollments'
    `;
    
    const [tables] = await bigquery.query(tableExistsQuery);
    if (tables.length === 0) {
      console.log('❌ Enrollments table does not exist');
      return;
    }
    
    console.log('✅ Enrollments table exists:', tables[0]);
    console.log('');

    // Test 2: Try to read table schema (this should work even without Drive access)
    console.log('2️⃣ Reading table schema...');
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS\` 
      WHERE table_name = 'enrollments'
      ORDER BY ordinal_position
    `;
    
    const [columns] = await bigquery.query(schemaQuery);
    console.log('✅ Table schema:', columns);
    console.log('');

    // Test 3: Try to read actual data (this will fail without proper Drive access)
    console.log('3️⃣ Testing data access (this is the critical test)...');
    const dataQuery = `
      SELECT DISTINCT level 
      FROM \`pursuit-ops.pilot_agent_public.enrollments\` 
      WHERE level IS NOT NULL 
      LIMIT 5
    `;
    
    const [levels] = await bigquery.query(dataQuery);
    console.log('✅ SUCCESS! Real levels from Google Sheet:', levels.map(l => l.level));
    console.log('');
    
    // Test 4: Try the full query that our API uses
    console.log('4️⃣ Testing full API query...');
    const fullQuery = `
      SELECT DISTINCT e.level
      FROM \`pursuit-ops.pilot_agent_public.enrollments\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level IS NOT NULL
      ORDER BY e.level ASC
    `;
    
    const [apiLevels] = await bigquery.query(fullQuery);
    console.log('✅ SUCCESS! API-style levels query works:', apiLevels.map(l => l.level));
    console.log('');
    
    // Test 5: Count total enrollments
    console.log('5️⃣ Testing enrollment counts...');
    const countQuery = `
      SELECT 
        level,
        COUNT(*) as count
      FROM \`pursuit-ops.pilot_agent_public.enrollments\` 
      WHERE level IS NOT NULL 
      GROUP BY level
      ORDER BY level
    `;
    
    const [counts] = await bigquery.query(countQuery);
    console.log('✅ Enrollment counts by level:', counts);
    console.log('');

    console.log('🎉 ALL TESTS PASSED! Google Drive access is working correctly.');
    console.log('Your levels filter should now work with real data instead of mock data.');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.log('');
    
    if (error.message.includes('Permission denied while getting Drive credentials')) {
      console.log('🔧 DIAGNOSIS: Google Drive API access issue');
      console.log('');
      console.log('SOLUTIONS:');
      console.log('1. Run: chmod +x setup-drive-access.sh && ./setup-drive-access.sh');
      console.log('2. Add the service account to your Google Sheet:');
      console.log('   Email: bq-nlp@pursuit-ops.iam.gserviceaccount.com');
      console.log('   Permission: Viewer');
      console.log('3. Make sure Google Drive API is enabled in your project');
      console.log('');
    } else if (error.message.includes('Access Denied')) {
      console.log('🔧 DIAGNOSIS: Service account permissions issue');
      console.log('');
      console.log('SOLUTIONS:');
      console.log('1. Check if service account has BigQuery roles');
      console.log('2. Verify the service account email in the Google Sheet');
      console.log('3. Check if the Google Sheet link in BigQuery is correct');
      console.log('');
    } else {
      console.log('🔧 DIAGNOSIS: Unknown error');
      console.log('Check the error message above for more details.');
      console.log('');
    }
  }
}

// Also test regular BigQuery tables to make sure basic access works
async function testRegularTables() {
  try {
    console.log('🔍 Testing regular BigQuery table access...');
    
    const query = `
      SELECT COUNT(*) as user_count
      FROM \`pursuit-ops.pilot_agent_public.users\` 
      WHERE role = 'builder'
      LIMIT 1
    `;
    
    const [result] = await bigquery.query(query);
    console.log('✅ Regular BigQuery access works. Builder count:', result[0].user_count);
    console.log('');
    
  } catch (error) {
    console.error('❌ Regular BigQuery access failed:', error.message);
    console.log('This indicates a basic service account configuration issue.');
    console.log('');
  }
}

async function runAllTests() {
  await testRegularTables();
  await testDriveAccess();
}

runAllTests(); 