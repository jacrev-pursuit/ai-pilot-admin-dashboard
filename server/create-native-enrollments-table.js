const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function createNativeEnrollmentsTable() {
  console.log('🔄 Creating native BigQuery enrollments table...\n');
  
  const dataset = bigquery.dataset('pilot_agent_public');
  const newTableName = 'enrollments_native';
  
  try {
    // Step 1: Try to get data from external table (if it works)
    console.log('1️⃣ Attempting to read from external enrollments table...');
    let enrollmentsData = [];
    
    try {
      const externalQuery = `
        SELECT cohort, level, builder_email
        FROM \`pursuit-ops.pilot_agent_public.enrollments\`
        WHERE level IS NOT NULL AND level != ''
          AND builder_email IS NOT NULL AND builder_email != ''
      `;
      
      const [rows] = await bigquery.query(externalQuery);
      enrollmentsData = rows;
      console.log(`   ✅ Successfully read ${enrollmentsData.length} rows from external table`);
      
    } catch (error) {
      console.log('   ❌ External table failed (expected):', error.message);
      console.log('   📝 We\'ll create the table structure and you can populate it manually');
    }
    
    // Step 2: Create the native table
    console.log('\n2️⃣ Creating native enrollments table...');
    
    // Define table schema
    const schema = [
      { name: 'cohort', type: 'STRING', mode: 'NULLABLE' },
      { name: 'level', type: 'STRING', mode: 'NULLABLE' },
      { name: 'builder_email', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'NULLABLE' }
    ];
    
    // Create table options
    const options = {
      schema: schema,
      location: 'us-central1',
    };
    
    // Check if table already exists
    const [tableExists] = await dataset.table(newTableName).exists();
    if (tableExists) {
      console.log(`   ⚠️  Table ${newTableName} already exists. Dropping it...`);
      await dataset.table(newTableName).delete();
    }
    
    // Create the table
    const [table] = await dataset.createTable(newTableName, options);
    console.log(`   ✅ Created table: ${table.id}`);
    
    // Step 3: Insert data if we have any
    if (enrollmentsData.length > 0) {
      console.log('\n3️⃣ Inserting data into native table...');
      
      // Add timestamps to the data
      const dataWithTimestamps = enrollmentsData.map(row => ({
        ...row,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      await table.insert(dataWithTimestamps);
      console.log(`   ✅ Inserted ${dataWithTimestamps.length} rows`);
      
      // Test the new table
      console.log('\n4️⃣ Testing the new native table...');
      const testQuery = `
        SELECT 
          level,
          COUNT(*) as count
        FROM \`pursuit-ops.pilot_agent_public.${newTableName}\`
        WHERE level IS NOT NULL
        GROUP BY level
        ORDER BY level
      `;
      
      const [testResults] = await bigquery.query(testQuery);
      console.log('   ✅ Test results:');
      testResults.forEach(row => {
        console.log(`      - ${row.level}: ${row.count} users`);
      });
      
    } else {
      console.log('\n3️⃣ No data to insert (external table inaccessible)');
      console.log('   📝 You can populate this table manually using:');
      console.log(`   INSERT INTO \`pursuit-ops.pilot_agent_public.${newTableName}\``);
      console.log(`   (cohort, level, builder_email, created_at, updated_at)`);
      console.log(`   VALUES`);
      console.log(`   ('Cohort1', 'Beginner', 'user1@example.com', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()),`);
      console.log(`   ('Cohort1', 'Intermediate', 'user2@example.com', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());`);
    }
    
    console.log('\n🎉 SUCCESS! Native enrollments table created.');
    console.log(`Table name: ${newTableName}`);
    console.log(`Full reference: pursuit-ops.pilot_agent_public.${newTableName}`);
    
    return newTableName;
    
  } catch (error) {
    console.error('❌ Failed to create native table:', error.message);
    throw error;
  }
}

// Also create a data seeding function for testing
async function seedTestData(tableName = 'enrollments_native') {
  console.log('\n🌱 Seeding test data...');
  
  const testData = [
    { cohort: 'Cohort-2024-Q1', level: 'Beginner', builder_email: 'test.builder1@pursuit.org', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { cohort: 'Cohort-2024-Q1', level: 'Intermediate', builder_email: 'test.builder2@pursuit.org', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { cohort: 'Cohort-2024-Q1', level: 'Advanced', builder_email: 'test.builder3@pursuit.org', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { cohort: 'Cohort-2024-Q2', level: 'Beginner', builder_email: 'test.builder4@pursuit.org', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { cohort: 'Cohort-2024-Q2', level: 'Intermediate', builder_email: 'test.builder5@pursuit.org', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  
  try {
    const dataset = bigquery.dataset('pilot_agent_public');
    const table = dataset.table(tableName);
    
    await table.insert(testData);
    console.log(`   ✅ Inserted ${testData.length} test records`);
    
    // Verify the data
    const verifyQuery = `
      SELECT level, COUNT(*) as count
      FROM \`pursuit-ops.pilot_agent_public.${tableName}\`
      GROUP BY level
      ORDER BY level
    `;
    
    const [results] = await bigquery.query(verifyQuery);
    console.log('   📊 Current data in table:');
    results.forEach(row => {
      console.log(`      - ${row.level}: ${row.count} users`);
    });
    
  } catch (error) {
    console.error('❌ Failed to seed test data:', error.message);
  }
}

async function main() {
  try {
    const tableName = await createNativeEnrollmentsTable();
    
    // Ask if user wants to seed test data
    console.log('\n❓ Would you like to seed with test data?');
    console.log('Run: node create-native-enrollments-table.js --seed');
    
    // Check for --seed flag
    if (process.argv.includes('--seed')) {
      await seedTestData(tableName);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

main(); 