import React from 'react';
import { Layout, Typography } from 'antd';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  return (
    <AntHeader style={{ background: 'var(--color-bg-header)', padding: '0 24px' }}>
      <Title level={3} style={{ color: 'var(--color-text-main)', margin: 0, lineHeight: '64px' }}>
        AI Pilot Dashboard
      </Title>
    </AntHeader>
  );
};

export default Header; 