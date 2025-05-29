import React from 'react';
import { Layout, Typography } from 'antd';
import { Routes, Route } from 'react-router-dom';
import BuilderView from './BuilderView';

const { Content } = Layout;
const { Title } = Typography;

const MainContent = ({ children }) => {
  return (
    <Content style={{ margin: '24px 16px', padding: 24, background: 'var(--color-bg-main)' }}>
      <div style={{ minHeight: 360 }}>
        <Routes>
          <Route path="/" element={<BuilderView />} />
          <Route path="/builders" element={<BuilderView />} />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </div>
    </Content>
  );
};

export default MainContent; 