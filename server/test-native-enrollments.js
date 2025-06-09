const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function testNativeEnrollments() {
  console.log('🧪 Testing native enrollments table...\n');
  
  const tableName = 'enrollments_native';
  
  try {
    // Test 1: Check if native table exists
    console.log('1️⃣ Checking if native enrollments table exists...');
    const tableExistsQuery = `
      SELECT table_name, table_type 
      FROM \`pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.TABLES\` 
      WHERE table_name = '${tableName}'
    `;
    
    const [tables] = await bigquery.query(tableExistsQuery);
    if (tables.length === 0) {
      console.log(`❌ Native enrollments table '${tableName}' does not exist`);
      console.log('Run: node create-native-enrollments-table.js --seed');
      return;
    }
    
    console.log(`✅ Native enrollments table exists:`, tables[0]);
    console.log('');

    // Test 2: Count total rows
    console.log('2️⃣ Counting total rows in native table...');
    const countQuery = `
      SELECT COUNT(*) as total_rows
      FROM \`pursuit-ops.pilot_agent_public.${tableName}\`
    `;
    
    const [countResult] = await bigquery.query(countQuery);
    console.log(`✅ Total rows: ${countResult[0].total_rows}`);
    console.log('');

    // Test 3: Get available levels
    console.log('3️⃣ Testing levels query (API endpoint equivalent)...');
    const levelsQuery = `
      SELECT DISTINCT e.level
      FROM \`pursuit-ops.pilot_agent_public.${tableName}\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level IS NOT NULL
        AND e.level != ''
      ORDER BY e.level ASC
    `;
    
    const [levelsResult] = await bigquery.query(levelsQuery);
    console.log('✅ Available levels:', levelsResult.map(l => l.level));
    console.log('');
    
    // Test 4: Test level filtering
    console.log('4️⃣ Testing level filtering...');
    const filterQuery = `
      SELECT e.level, COUNT(*) as count
      FROM \`pursuit-ops.pilot_agent_public.${tableName}\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level IS NOT NULL
        AND e.level != ''
      GROUP BY e.level
      ORDER BY e.level
    `;
    
    const [filterResult] = await bigquery.query(filterQuery);
    console.log('✅ Level counts:');
    filterResult.forEach(row => {
      console.log(`   - ${row.level}: ${row.count} users`);
    });
    console.log('');
    
    // Test 5: Test specific level filter (like API would use)
    console.log('5️⃣ Testing specific level filter (Beginner)...');
    const specificLevelQuery = `
      SELECT e.builder_email, e.level, e.cohort
      FROM \`pursuit-ops.pilot_agent_public.${tableName}\` e
      INNER JOIN \`pursuit-ops.pilot_agent_public.users\` u ON e.builder_email = u.email
      WHERE u.role = 'builder'
        AND e.level = 'Beginner'
      LIMIT 5
    `;
    
    const [specificResult] = await bigquery.query(specificLevelQuery);
    console.log('✅ Sample Beginner users:');
    specificResult.forEach(row => {
      console.log(`   - ${row.builder_email} (${row.cohort})`);
    });
    console.log('');

    console.log('🎉 ALL TESTS PASSED!');
    console.log('The native enrollments table is working correctly.');
    console.log('Level filtering should now work properly in the dashboard.');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.log('');
    
    if (error.message.includes('Table') && error.message.includes('not found')) {
      console.log('🔧 ISSUE: Native table does not exist');
      console.log('SOLUTION: Run: node create-native-enrollments-table.js --seed');
    } else {
      console.log('🔧 ISSUE: Unexpected error');
      console.log('Check the error message above for details.');
    }
  }
}

testNativeEnrollments(); 