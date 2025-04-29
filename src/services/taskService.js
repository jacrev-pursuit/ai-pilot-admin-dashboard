export const fetchCohortTaskDetails = async (taskId, startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching cohort task details for:', { taskId, startDate: effectiveStartDate, endDate: effectiveEndDate });
  const url = `/api/tasks/${taskId}/cohort-details?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
  console.log('Fetching from URL:', url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      // Log the detailed error from the server
      console.error('Server responded with error:', errorData);
      throw new Error(errorData.error || 'Failed to fetch cohort task details');
    }
    const data = await response.json();
    console.log(`Successfully fetched cohort details for task ${taskId}:`, data);
    return data;
  } catch (error) {
    console.error('API request failed for cohort task details:', error);
    throw error; // Re-throw the error for the component to handle
  }
};

export const fetchTaskList = async () => {
  console.log('Fetching task list...');
  const url = `/api/tasks/list`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server responded with error fetching task list:', errorData);
      throw new Error(errorData.error || 'Failed to fetch task list');
    }
    const data = await response.json();
    console.log('Successfully fetched task list:', data);
    return data; // Should be an array like [{ task_id: 1, task_title: 'Task A' }, ...]
  } catch (error) {
    console.error('API request failed for task list:', error);
    throw error;
  }
};

export const fetchTaskSubmissions = async (taskId, startDate, endDate, page = 1, pageSize = 10) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching task submissions for:', { taskId, startDate: effectiveStartDate, endDate: effectiveEndDate, page, pageSize });
  const url = `/api/tasks/${taskId}/submissions?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}&page=${page}&pageSize=${pageSize}`;
  console.log('Fetching from URL:', url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server responded with error fetching task submissions:', errorData);
      throw new Error(errorData.error || 'Failed to fetch task submissions');
    }
    const data = await response.json(); // Expects { submissions: [], pagination: {} }
    console.log(`Successfully fetched page ${page} of submissions for task ${taskId}:`, data);
    return data;
  } catch (error) {
    console.error('API request failed for task submissions:', error);
    throw error;
  }
}; 