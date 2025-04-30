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
import TaskOverviewPage from './pages/TaskOverviewPage';
import TaskDetailPage from './pages/TaskDetailPage';

const { Header, Sider, Content } = Layout;

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
    {
      key: '/tasks',
      icon: <BookOutlined />,
      label: <Link to="/tasks">Tasks Overview</Link>,
    }
  ];

  return (
    <Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
      <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#4f46e5' }}>AI Pilot Admin</h1>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
      />
    </Sider>
  );
};

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout>
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
              <Route path="/tasks" element={<TaskOverviewPage />} />
              <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
