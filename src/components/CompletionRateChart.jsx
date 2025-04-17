import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { chartColors, baseChartOptions, chartContainer } from './ChartStyles';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CompletionRateChart = ({ timeRange, data }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (data) {
      processChartData(data);
    }
  }, [data, timeRange]);

  const processChartData = (rawData) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Processing completion rate data:', rawData);

      if (!rawData || !rawData.rows || rawData.rows.length === 0) {
        throw new Error('No data available');
      }

      // Format data for chart
      const labels = rawData.rows.map(row => {
        const date = new Date(row.f[0].v); // date field
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      const activeUsers = rawData.rows.map(row => parseInt(row.f[1].v)); // active_users field
      const completionRates = rawData.rows.map(row => parseFloat(row.f[2].v)); // completion_rate field

      console.log('Processed data:', {
        labels,
        activeUsers,
        completionRates
      });

      setChartData({
        labels,
        datasets: [
          {
            label: 'Active Users',
            data: activeUsers,
            borderColor: chartColors.secondary,
            backgroundColor: chartColors.secondaryLight,
            tension: 0.3,
            fill: false,
            yAxisID: 'y',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Completion Rate (%)',
            data: completionRates,
            borderColor: chartColors.primary,
            backgroundColor: chartColors.primaryLight,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      });
    } catch (err) {
      console.error('Error processing completion rate data:', err);
      setError(`Failed to process completion rate data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const chartOptions = {
    ...baseChartOptions,
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Active Users'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Completion Rate (%)'
        },
        grid: {
          drawOnChartArea: false
        },
        min: 0,
        max: 100
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    },
    plugins: {
      ...baseChartOptions.plugins,
      title: {
        display: true,
        text: 'Daily Active Users and Completion Rate',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  };

  return (
    <div style={chartContainer}>
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '300px',
          color: 'white'
        }}>
          Loading chart data...
        </div>
      ) : error ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '300px',
          color: '#ff6b6b',
          textAlign: 'center',
          padding: '20px'
        }}>
          {error}
        </div>
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
    </div>
  );
};

export default CompletionRateChart; 