import BuilderMetricsTable from './BuilderMetricsTable';

const Dashboard = () => {
  return (
    <div style={{
      padding: '20px',
      background: '#242424',
      minHeight: '100vh',
      color: 'white'
    }}>
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1>AI Pilot Analytics Dashboard</h1>
      </div>

      <BuilderMetricsTable />
    </div>
  );
};

export default Dashboard; 