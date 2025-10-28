import React, { useEffect } from 'react';
import { Button, Card, Typography, Space, Alert } from 'antd';
import { GoogleOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for token in URL (from OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    
    if (token) {
      login(token);
      // Clean up URL
      navigate('/login/success', { replace: true });
    }
  }, [location, login, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/weekly-summary', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleLogin = () => {
    // Redirect to server's Google OAuth endpoint
    window.location.href = 'http://localhost:3001/auth/google';
  };

  // Check if this is an error page
  const isError = location.pathname === '/login/error';
  const isSuccess = location.pathname === '/login/success';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <LockOutlined style={{ fontSize: '48px', color: '#667eea', marginBottom: '16px' }} />
          <Title level={2} style={{ marginBottom: '8px', color: '#333' }}>
            AI Pilot Admin Dashboard
          </Title>
          <Text type="secondary">
            Sign in with your Pursuit.org account
          </Text>
        </div>

        {isError && (
          <Alert
            message="Access Denied"
            description="You must be a member of staff@pursuit.org to access this dashboard."
            type="error"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}

        {isSuccess && !isAuthenticated && (
          <Alert
            message="Signing you in..."
            description="Please wait while we complete your authentication."
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}

        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              height: '48px',
              fontSize: '16px',
              borderRadius: '8px',
              background: '#4285f4',
              borderColor: '#4285f4'
            }}
            disabled={isSuccess}
          >
            Sign in with Google
          </Button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Only Pursuit staff members can access this dashboard.<br />
              You must be a member of staff@pursuit.org Google Group.
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage; 