import React from 'react';
import { Layout } from 'antd';
import BuilderView from './components/BuilderView';

const { Content } = Layout;

function App() {
  console.log('App component rendering');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content>
        <BuilderView />
      </Content>
    </Layout>
  );
}

export default App;
