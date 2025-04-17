import React from 'react';
import { Layout } from 'antd';

const { Header: AntHeader } = Layout;

const Header = () => {
  return (
    <AntHeader style={{ background: '#fff', padding: '0 24px' }}>
      <h1 style={{ margin: 0, lineHeight: '64px' }}>AI Pilot Admin Dashboard</h1>
    </AntHeader>
  );
};

export default Header; 