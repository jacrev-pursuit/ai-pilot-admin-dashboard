// API base URL
const API_BASE_URL = 'http://localhost:3001';

export const fetchBuilderData = async (startDate, endDate) => {
  console.log('Fetching builder data for date range:', startDate, endDate);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/builders?startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Builder data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching builder data:', error);
    throw error;
  }
};

export const fetchBuilderDetails = async (userId, type, startDate, endDate) => {
  console.log('Fetching builder details for user:', userId, 'type:', type);
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/builders/${userId}/details?type=${type}&startDate=${startDate}&endDate=${endDate}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Builder details fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching builder details:', error);
    throw error;
  }
}; 