import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  BookOutlined
} from '@ant-design/icons';
import PilotOverview from './components/Dashboard';
import BuilderView from './components/BuilderView';
import BuilderDetailsPage from './components/BuilderDetailsPage';
import AllTaskAnalysisView from './components/AllTaskAnalysisView';
import TaskSubmissionDetailPage from './pages/TaskSubmissionDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';

const { Header, Content } = Layout;

// Placeholder components for other pages
// const Dashboard = () => <div>Dashboard Page</div>; // Can remove or keep as reference
const Metrics = () => <div>Metrics Page</div>;
const Settings = () => <div>Settings Page</div>;

const Navigation = () => {
  const location = useLocation();
  
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Pilot Overview</Link>,
    },
    {
      key: '/builders',
      icon: <TeamOutlined />,
      label: <Link to="/builders">Builders</Link>,
    },
    {
      key: '/builder-details',
      icon: <UserOutlined />,
      label: <Link to="/builder-details">Builder Details</Link>,
    },
    // { // Removed Tasks Overview link
    //   key: '/tasks',
    //   icon: <BookOutlined />,
    //   label: <Link to="/tasks">Tasks Overview</Link>,
    // }
  ];

  return (
    <Header style={{ 
      background: '#fff', 
      padding: '0 24px', 
      display: 'flex', 
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{ 
        marginRight: '48px', 
        fontSize: '20px', 
        fontWeight: 'bold',
        color: '#4f46e5'
      }}>
        AI Pilot Admin
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        style={{ 
          flex: 1,
          border: 'none',
          background: 'transparent'
        }}
        items={menuItems}
      />
    </Header>
  );
};

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
          <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<PilotOverview />} />
              <Route path="/builders" element={<BuilderView />} />
              <Route path="/builders/:builderId" element={<BuilderDetailsPage />} />
              <Route path="/builder-details" element={<BuilderDetailsPage />} />
              {/* Removed Task Cohort View routes */}
              {/* <Route path="/tasks/" element={<CohortTaskDetailsPage />} /> */}
              {/* <Route path="/tasks/:taskId" element={<CohortTaskDetailsPage />} /> */}
              <Route path="/all-analysis" element={<AllTaskAnalysisView />} />
              <Route path="/submission/:autoId" element={<TaskSubmissionDetailPage />} />
              {/* <Route path="/tasks" element={<TaskOverviewPage />} /> */} {/* Removed Tasks Overview route */}
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            </Routes>
          </Content>
      </Layout>
    </Router>
  );
}

export default App;
