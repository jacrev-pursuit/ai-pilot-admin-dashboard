import React from 'react';
import { Menu } from 'antd';
import { DashboardOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const selectedKey = location.pathname === '/' ? 'dashboard' : location.pathname.slice(1);

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{ height: '100%', borderRight: 0 }}
    >
      <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
        <Link to="/">Dashboard</Link>
      </Menu.Item>
      <Menu.Item key="builders" icon={<TeamOutlined />}>
        <Link to="/builders">Builders</Link>
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        <Link to="/settings">Settings</Link>
      </Menu.Item>
    </Menu>
  );
};

export default Sidebar; 