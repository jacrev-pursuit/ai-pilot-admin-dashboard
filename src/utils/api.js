// API utility with automatic authentication
const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

// Helper function to make authenticated requests
const apiRequest = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add auth token if available
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  const response = await fetch(`${API_BASE}${url}`, config);

  // Handle authentication errors
  if (response.status === 401) {
    // Token is invalid, clear it and redirect to login
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorData.message || 'Request failed');
  }

  return response;
};

// Export convenience methods
export const api = {
  get: (url, options = {}) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url, data, options = {}) => apiRequest(url, { 
    ...options, 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  put: (url, data, options = {}) => apiRequest(url, { 
    ...options, 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  delete: (url, options = {}) => apiRequest(url, { ...options, method: 'DELETE' })
};

export default api; 