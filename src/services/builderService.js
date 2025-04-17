// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

console.log(`Using API URL: ${API_URL}`);

export const fetchBuilderData = async (startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching builder data with dates:', { startDate: effectiveStartDate, endDate: effectiveEndDate });
  
  try {
    const response = await fetch(`${API_URL}/builders?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Builder data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch builder data:', error);
    throw error;
  }
};

export const fetchBuilderDetails = async (userId, type, startDate, endDate) => {
  const effectiveStartDate = startDate || '2000-01-01';
  const effectiveEndDate = endDate || '2100-12-31';
  console.log('Fetching details for:', { userId, type, startDate: effectiveStartDate, endDate: effectiveEndDate });
  const url = `${API_URL}/builders/${userId}/details?type=${type}&startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
  console.log('Fetching from URL:', url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error Response:', errorData);
      throw new Error(errorData.error?.message || errorData.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Successfully fetched ${type} details for user ${userId}:`, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${type} details for user ${userId}:`, error);
    throw error;
  }
}; 