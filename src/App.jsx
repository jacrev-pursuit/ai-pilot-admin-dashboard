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
        maxWidth: '1200px',
        margin: '0 auto',
        overflow: 'hidden',
        paddingLeft: '12px'
      }}>
        <div style={{ 
          marginRight: '24px', 
          fontSize: '20px', 
          fontWeight: 'bold',
          color: '#4b42d9',
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
      </div>
    </Header>
  );
};

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <div style={{ 
          maxWidth: '1200px', 
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
        </div>
      </Layout>
    </Router>
  );
}

export default App;
