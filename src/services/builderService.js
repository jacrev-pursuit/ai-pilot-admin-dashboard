// Removed API_URL constant: const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const fetchBuilderData = async (startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching builder data with dates:', { startDate: effectiveStartDate, endDate: effectiveEndDate });
  
  try {
    const response = await fetch(`/api/builders?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch builder data');
    }
    const data = await response.json();
    console.log('Builder data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const fetchBuilderDetails = async (userId, type, startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching details for:', { userId, type, startDate: effectiveStartDate, endDate: effectiveEndDate });
  const url = `/api/builders/${userId}/details?type=${type}&startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
  console.log('Fetching from URL:', url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch builder details');
    }
    const data = await response.json();
    console.log(`Successfully fetched ${type} details for user ${userId}:`, data);
    return data;
  } catch (error) {
    console.error('API request failed for details:', error);
    throw error;
  }
};

// Fetch all peer feedback within a date range
export const fetchAllPeerFeedback = async (startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching all peer feedback with dates:', { startDate: effectiveStartDate, endDate: effectiveEndDate });
  const url = `/api/feedback/all?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch all peer feedback');
    }
    const data = await response.json();
    console.log('All peer feedback fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('API request failed for all peer feedback:', error);
    throw error;
  }
};

// Fetch all task analysis results within a date range
export const fetchAllTaskAnalysis = async (startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching all task analysis with dates:', { startDate: effectiveStartDate, endDate: effectiveEndDate });
  const url = `/api/analysis/all?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch all task analysis');
    }
    const data = await response.json();
    console.log('All task analysis fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('API request failed for all task analysis:', error);
    throw error;
  }
}; 