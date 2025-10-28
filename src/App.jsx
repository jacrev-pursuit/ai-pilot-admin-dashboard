import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  StarOutlined,
  LogoutOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import PilotOverview from './components/Dashboard';
import BuilderView from './components/BuilderView';
import BuilderDetailsPage from './components/BuilderDetailsPage';
import AllTaskAnalysisView from './components/AllTaskAnalysisView';
import WeeklySummary from './components/WeeklySummary';
import JuneL2SelectionsView from './components/JuneL2SelectionsView';
import VideoSubmissions from './components/VideoSubmissions';
import TaskSubmissionDetailPage from './pages/TaskSubmissionDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import VideoAnalysisDetailPage from './pages/VideoAnalysisDetailPage';
import SurveyFeedback from './components/SurveyFeedback';
import ConversationAnalytics from './components/ConversationAnalytics';

const { Header, Content } = Layout;

// Placeholder components for other pages
// const Dashboard = () => <div>Dashboard Page</div>; // Can remove or keep as reference
const Metrics = () => <div>Metrics Page</div>;
const Settings = () => <div>Settings Page</div>;

const Navigation = () => {
  const location = useLocation();
  // const { user, logout } = useAuth(); // DISABLED FOR TESTING
  const user = { name: 'Test User', email: 'test@pursuit.org' }; // Mock user for testing
  
  const menuItems = [
    // ARCHIVED: Pilot Overview tab - code preserved but hidden from navigation
    // {
    //   key: '/',
    //   icon: <DashboardOutlined />,
    //   label: <Link to="/">Pilot Overview</Link>,
    // },
    {
      key: '/weekly-summary',
      icon: <CalendarOutlined />,
      label: <Link to="/weekly-summary">Summary</Link>,
    },
    {
      key: '/l2-selections',
      icon: <StarOutlined />,
      label: <Link to="/l2-selections">L2 selections</Link>,
    },
    {
      key: '/video-submissions',
      icon: <BookOutlined />,
      label: <Link to="/video-submissions">Video Submissions</Link>,
    },
    {
      key: '/survey-feedback',
      icon: <BarChartOutlined />,
      label: <Link to="/survey-feedback">Survey Feedback</Link>,
    },
    {
      key: '/conversation-analytics',
      icon: <RobotOutlined />,
      label: <Link to="/conversation-analytics">Conversation Analytics</Link>,
    },
    // ARCHIVED: Builders tab - code preserved but hidden from navigation
    // {
    //   key: '/builders',
    //   icon: <TeamOutlined />,
    //   label: <Link to="/builders">Builders</Link>,
    // },
    // ARCHIVED: Builder Details tab - code preserved but hidden from navigation
    // {
    //   key: '/builder-details',
    //   icon: <UserOutlined />,
    //   label: <Link to="/builder-details">Builder Details</Link>,
    // },
    // { // Removed Tasks Overview link
    //   key: '/tasks',
    //   icon: <BookOutlined />,
    //   label: <Link to="/tasks">Tasks Overview</Link>,
    // }
  ];

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: (
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{user?.email}</div>
          </div>
        )
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout (Disabled)',
        onClick: () => console.log('Logout disabled for testing')
      }
    ]
  };

  return (
    <Header style={{ 
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        overflow: 'hidden',
        paddingLeft: '12px',
        paddingRight: '12px'
      }}>
        <div style={{ 
          marginRight: '24px', 
          fontSize: '20px', 
          fontWeight: 'bold',
          color: '#ffffff',
          whiteSpace: 'nowrap'
        }}>
          AI Pilot Admin
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          style={{ 
            flex: 1,
            border: 'none'
          }}
          theme="dark"
          items={menuItems}
        />
        
        <Dropdown menu={userMenu} placement="bottomRight">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer', 
            color: 'white',
            padding: '0 8px'
          }}>
            <Avatar 
              src={user?.picture} 
              icon={<UserOutlined />} 
              style={{ marginRight: '8px' }}
              size="small"
            />
            <span style={{ whiteSpace: 'nowrap' }}>{user?.name}</span>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};

const AuthenticatedApp = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <div style={{ 
        maxWidth: '1440px', 
        width: '100%', 
        margin: '0 auto',
        padding: '0 16px',
        marginTop: '64px'
      }}>
        <Content style={{ 
          padding: '24px 0', 
          minHeight: 280
        }}>
          <Routes>
            {/* Authentication routes (unprotected) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/success" element={<LoginPage />} />
            <Route path="/login/error" element={<LoginPage />} />
            
            {/* Protected routes - AUTHENTICATION DISABLED FOR TESTING */}
            <Route path="/" element={<WeeklySummary />} />
            <Route path="/weekly-summary" element={<WeeklySummary />} />
            <Route path="/l2-selections" element={<JuneL2SelectionsView />} />
            <Route path="/video-submissions" element={<VideoSubmissions />} />
            <Route path="/survey-feedback" element={<SurveyFeedback />} />
            <Route path="/conversation-analytics" element={<ConversationAnalytics />} />
            <Route path="/pilot-overview" element={<PilotOverview />} />
            <Route path="/builders" element={<BuilderView />} />
            <Route path="/builders/:builderId" element={<BuilderDetailsPage />} />
            <Route path="/builder-details" element={<BuilderDetailsPage />} />
            <Route path="/all-analysis" element={<AllTaskAnalysisView />} />
            <Route path="/submission/:autoId" element={<TaskSubmissionDetailPage />} />
            <Route path="/video-analysis/:videoId" element={<VideoAnalysisDetailPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          </Routes>
        </Content>
      </div>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </Router>
  );
}

export default App;
