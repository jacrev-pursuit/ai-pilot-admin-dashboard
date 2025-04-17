// Simple script to test BigQuery connection
import fs from 'fs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Read the service account file
const serviceAccount = JSON.parse(fs.readFileSync('./service_account.json', 'utf8'));
console.log('Service account loaded:', {
  project_id: serviceAccount.project_id,
  client_email: serviceAccount.client_email
});

// Function to get access token
const getAccessToken = async () => {
  try {
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    
    // Create JWT token
    const token = jwt.sign(claim, serviceAccount.private_key, {
      algorithm: 'RS256',
      header: {
        kid: serviceAccount.private_key_id,
        typ: 'JWT'
      }
    });
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }
    
    const data = await tokenResponse.json();
    console.log('Access token obtained successfully');
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};

// Test the BigQuery connection
const testConnection = async () => {
  try {
    console.log('Testing BigQuery connection...');
    const accessToken = await getAccessToken();
    
    // Test query
    const query = `
      SELECT 
        DATE_TRUNC(created_at, WEEK) as week_start,
        COUNT(DISTINCT user_id) as active_users,
        AVG(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100 as completion_rate
      FROM \`pilot_agent_public.user_task_progress\`
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      GROUP BY week_start
      ORDER BY week_start ASC
      LIMIT 1
    `;
    
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${serviceAccount.project_id}/queries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          useLegacySql: false
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('BigQuery API error:', errorData);
      throw new Error(`BigQuery API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Query results:', data);
  } catch (error) {
    console.error('BigQuery connection test failed:', error);
  }
};

testConnection(); 