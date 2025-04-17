// BigQuery REST API service
const projectId = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID;
const keyFilename = import.meta.env.VITE_GOOGLE_APPLICATION_CREDENTIALS;

console.log('BigQuery Config:', {
  projectId,
  keyFilename,
  env: import.meta.env
});

if (!projectId || !keyFilename) {
  console.error('Missing BigQuery configuration:', {
    projectId: !!projectId,
    keyFilename: !!keyFilename,
  });
  throw new Error('Missing required BigQuery configuration. Please check your .env file.');
}

// Function to base64url encode a string
const base64UrlEncode = (str) => {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Function to get access token using service account
const getAccessToken = async () => {
  try {
    // Load service account credentials
    const response = await fetch(keyFilename);
    if (!response.ok) {
      throw new Error(`Failed to load service account file: ${response.statusText}`);
    }
    
    const credentials = await response.json();
    console.log('Service account loaded successfully');
    
    // Create JWT header and claim
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: credentials.private_key_id
    };
    
    const claim = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    
    // Create JWT token parts
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaim = base64UrlEncode(JSON.stringify(claim));
    const signatureInput = `${encodedHeader}.${encodedClaim}`;
    
    // For development, use a mock token
    // In production, you would need to implement proper JWT signing
    console.log('Using mock token for development');
    const mockToken = `${signatureInput}.mock_signature`;
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: mockToken
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

/**
 * Execute a BigQuery query
 * @param {string} query - SQL query to execute
 * @returns {Promise<Array>} - Query results
 */
export const executeQuery = async (query) => {
  try {
    console.log('Executing query:', query);
    
    // For development, return mock data
    console.log('Using mock data for development');
    
    // Generate mock data based on the query type
    if (query.includes('user_task_progress')) {
      // Mock data for task progress
      const mockData = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        mockData.push({
          date: date.toISOString().split('T')[0],
          total_users: Math.floor(Math.random() * 50) + 50,
          completed_tasks: Math.floor(Math.random() * 30) + 20,
          completion_rate: Math.floor(Math.random() * 30) + 60
        });
      }
      return mockData;
    }
    
    return [];
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

/**
 * Test the BigQuery connection
 */
export const testConnection = async () => {
  try {
    console.log('Testing BigQuery connection...');
    
    // For development, return mock data
    console.log('Using mock data for development');
    return {
      rows: [
        {
          week_start: new Date().toISOString().split('T')[0],
          active_users: 100,
          completion_rate: 85.5
        }
      ]
    };
  } catch (error) {
    console.error('BigQuery connection test failed:', error);
    throw new Error(`BigQuery test failed: ${error.message}`);
  }
};

/**
 * Get list of datasets
 * @returns {Promise<Array>} - List of datasets
 */
export const listDatasets = async () => {
  try {
    const [datasets] = await bigquery.getDatasets();
    return datasets.map(dataset => dataset.id);
  } catch (error) {
    console.error('Error listing datasets:', error);
    throw error;
  }
};

/**
 * Get list of tables in a dataset
 * @param {string} datasetId - Dataset ID
 * @returns {Promise<Array>} - List of tables
 */
export const listTables = async (datasetId) => {
  try {
    const dataset = bigquery.dataset(datasetId);
    const [tables] = await dataset.getTables();
    return tables.map(table => table.id);
  } catch (error) {
    console.error('Error listing tables:', error);
    throw error;
  }
}; 