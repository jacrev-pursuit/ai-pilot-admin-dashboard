import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  // Set up axios defaults with token
  const setAuthToken = (newToken) => {
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      setToken(newToken);
    } else {
      localStorage.removeItem('auth_token');
      setToken(null);
    }
  };

  // Check if user is authenticated
  const checkAuth = async () => {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/auth/me', {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(savedToken);
      } else {
        // Token is invalid
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = (newToken) => {
    setAuthToken(newToken);
    checkAuth();
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAuthToken(null);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 