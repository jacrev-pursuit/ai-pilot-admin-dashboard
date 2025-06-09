const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({ 
  projectId: 'pursuit-ops',
  keyFilename: './service-account-key.json'
});

async function copyEnrollmentsData() {
  console.log('📋 Copying data from external enrollments table to native table...\n');
  
  try {
    // Step 1: Clear existing data in native table (optional)
    console.log('1️⃣ Clearing existing data from native table...');
    const deleteQuery = `
      DELETE FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      WHERE TRUE
    `;
    
    await bigquery.query(deleteQuery);
    console.log('   ✅ Native table cleared');
    
    // Step 2: Copy data from external table to native table
    console.log('\n2️⃣ Copying data from external enrollments table...');
    
    const copyQuery = `
      INSERT INTO \`pursuit-ops.pilot_agent_public.enrollments_native\`
      (cohort, level, builder_email, created_at, updated_at)
      SELECT 
        cohort,
        level,
        builder_email,
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
      FROM \`pursuit-ops.pilot_agent_public.enrollments\`
      WHERE cohort IS NOT NULL 
        AND level IS NOT NULL 
        AND builder_email IS NOT NULL
        AND level != ''
        AND builder_email != ''
    `;
    
    const [job] = await bigquery.query(copyQuery);
    console.log('   ✅ Data copy completed successfully');
    
    // Step 3: Verify the copy
    console.log('\n3️⃣ Verifying copied data...');
    
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT level) as unique_levels,
        COUNT(DISTINCT cohort) as unique_cohorts,
        COUNT(DISTINCT builder_email) as unique_emails
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
    `;
    
    const [verifyResults] = await bigquery.query(verifyQuery);
    const stats = verifyResults[0];
    
    console.log('   📊 Copy Results:');
    console.log(`      - Total rows copied: ${stats.total_rows}`);
    console.log(`      - Unique levels: ${stats.unique_levels}`);
    console.log(`      - Unique cohorts: ${stats.unique_cohorts}`);
    console.log(`      - Unique emails: ${stats.unique_emails}`);
    
    // Step 4: Show level breakdown
    console.log('\n4️⃣ Level breakdown:');
    const levelQuery = `
      SELECT level, COUNT(*) as count
      FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
      WHERE level IS NOT NULL
      GROUP BY level
      ORDER BY level
    `;
    
    const [levelResults] = await bigquery.query(levelQuery);
    levelResults.forEach(row => {
      console.log(`      - ${row.level}: ${row.count} users`);
    });
    
    console.log('\n🎉 SUCCESS! All data copied successfully.');
    console.log('The native enrollments table now contains all data from the external table.');
    console.log('Level filtering should work properly now.');
    
  } catch (error) {
    console.error('❌ COPY FAILED:', error.message);
    
    if (error.message.includes('Permission denied while getting Drive credentials')) {
      console.log('\n🔧 ISSUE: Google Drive permissions still not working');
      console.log('The external enrollments table is still inaccessible.');
      console.log('You need to manually populate the native table or fix the Drive permissions first.');
      console.log('\nAlternative: Use the seeded test data:');
      console.log('node create-native-enrollments-table.js --seed');
    } else if (error.message.includes('not found')) {
      console.log('\n🔧 ISSUE: Table not found');
      console.log('Make sure both tables exist:');
      console.log('1. Create native table: node create-native-enrollments-table.js');
      console.log('2. Verify external table exists');
    } else {
      console.log('\n🔧 ISSUE: Unexpected error');
      console.log('Check the error message above for details.');
    }
  }
}

// Alternative query if you want to run it manually in BigQuery console
function printManualQuery() {
  console.log('\n📝 Manual BigQuery Query:');
  console.log('If you prefer to run this directly in BigQuery console:\n');
  
  const manualQuery = `
-- Clear existing data (optional)
DELETE FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`
WHERE TRUE;

-- Copy data from external to native table
INSERT INTO \`pursuit-ops.pilot_agent_public.enrollments_native\`
(cohort, level, builder_email, created_at, updated_at)
SELECT 
  cohort,
  level,
  builder_email,
  CURRENT_TIMESTAMP() as created_at,
  CURRENT_TIMESTAMP() as updated_at
FROM \`pursuit-ops.pilot_agent_public.enrollments\`
WHERE cohort IS NOT NULL 
  AND level IS NOT NULL 
  AND builder_email IS NOT NULL
  AND level != ''
  AND builder_email != '';

-- Verify the copy
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT level) as unique_levels,
  COUNT(DISTINCT cohort) as unique_cohorts
FROM \`pursuit-ops.pilot_agent_public.enrollments_native\`;
`;

  console.log(manualQuery);
}

async function main() {
  try {
    // Check for --manual flag to just print the query
    if (process.argv.includes('--manual')) {
      printManualQuery();
      return;
    }
    
    await copyEnrollmentsData();
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

main(); 