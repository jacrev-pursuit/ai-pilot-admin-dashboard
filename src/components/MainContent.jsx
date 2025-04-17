import React from 'react';
import { Layout } from 'antd';
import { Routes, Route } from 'react-router-dom';
import BuilderView from './BuilderView';

const { Content } = Layout;

const MainContent = () => {
  return (
    <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
      <Routes>
        <Route path="/" element={<BuilderView />} />
        <Route path="/builders" element={<BuilderView />} />
        <Route path="/settings" element={<div>Settings Page</div>} />
      </Routes>
    </Content>
  );
};

export default MainContent; 