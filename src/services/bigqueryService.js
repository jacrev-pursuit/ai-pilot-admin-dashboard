// const API_URL = 'http://localhost:3001'; // Comment out or remove the hardcoded URL

export const executeQuery = async () => {
  try {
    console.log('Fetching builder metrics from API...');
    // Get date range for last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Use a relative path for the fetch URL
    const response = await fetch(`/api/builders?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch data');
    }
    
    const data = await response.json();
    console.log('API response:', data);
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Mock queries (kept for reference)
export const queries = {
  builderMetrics: `
    WITH user_metrics AS (
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT CASE WHEN utp.status = 'completed' THEN utp.task_id END) as completed_tasks,
        COUNT(DISTINCT utp.task_id) as total_tasks,
        COUNT(DISTINCT cm.message_id) as total_prompts,
        AVG(sr.sentiment_score) as avg_sentiment_score
      FROM \`pilot_agent_public.users\` u
      LEFT JOIN \`pilot_agent_public.user_task_progress\` utp
        ON u.user_id = utp.user_id
      LEFT JOIN \`pilot_agent_public.conversation_messages\` cm
        ON u.user_id = cm.user_id
      LEFT JOIN \`pilot_agent_public.sentiment_results\` sr
        ON u.user_id = sr.user_id
      GROUP BY u.user_id, u.first_name, u.last_name
    )
    SELECT 
      user_id,
      CONCAT(first_name, ' ', last_name) as builder_name,
      ROUND(completed_tasks * 100.0 / NULLIF(total_tasks, 0), 2) as completion_rate,
      total_prompts,
      ROUND(avg_sentiment_score, 2) as avg_sentiment_score
    FROM user_metrics
    ORDER BY builder_name ASC
  `
}; 