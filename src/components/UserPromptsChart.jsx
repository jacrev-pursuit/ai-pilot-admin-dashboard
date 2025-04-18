import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { chartColors, baseChartOptions, chartContainer } from './ChartStyles';

// Register Chart.js components
// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   BarElement,
//   Title,
//   Tooltip,
//   Legend
// );

const UserPromptsChart = ({ timeRange, data }) => {
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

      console.log('Processing task metrics data:', rawData);

      if (!rawData || !rawData.rows || rawData.rows.length === 0) {
        throw new Error('No data available');
      }

      // Format data for chart
      const labels = rawData.rows.map(row => row.f[0].v); // task_type field
      const totalTasks = rawData.rows.map(row => parseInt(row.f[1].v)); // total_tasks field
      const completionRates = rawData.rows.map(row => parseFloat(row.f[2].v)); // completion_rate field
      const avgCompletionTime = rawData.rows.map(row => {
        const seconds = parseFloat(row.f[3].v); // avg_completion_time field
        return seconds ? Math.round(seconds / 60) : 0; // Convert to minutes
      });

      console.log('Processed data:', {
        labels,
        totalTasks,
        completionRates,
        avgCompletionTime
      });

      setChartData({
        labels,
        datasets: [
          {
            label: 'Total Tasks',
            data: totalTasks,
            backgroundColor: chartColors.primaryLight,
            borderColor: chartColors.primary,
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Completion Rate (%)',
            data: completionRates,
            backgroundColor: chartColors.secondaryLight,
            borderColor: chartColors.secondary,
            borderWidth: 1,
            yAxisID: 'y1'
          },
          {
            label: 'Avg. Completion Time (min)',
            data: avgCompletionTime,
            backgroundColor: chartColors.tertiaryLight,
            borderColor: chartColors.tertiary,
            borderWidth: 1,
            yAxisID: 'y2'
          }
        ]
      });
    } catch (err) {
      console.error('Error processing task metrics data:', err);
      setError(`Failed to process task metrics data: ${err.message}`);
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
          text: 'Total Tasks'
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
      y2: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Avg. Time (min)'
        },
        grid: {
          drawOnChartArea: false
        },
        offset: true
      },
      x: {
        title: {
          display: true,
          text: 'Task Type'
        }
      }
    },
    plugins: {
      ...baseChartOptions.plugins,
      title: {
        display: true,
        text: 'Task Metrics by Type',
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
        <Bar data={chartData} options={chartOptions} />
      )}
    </div>
  );
};

export default UserPromptsChart; 