import { useState, useEffect } from 'react';
import { Scatter } from 'react-chartjs-2';
import { executeQuery } from '../services/bigquery';
import { chartColors, baseChartOptions, chartContainer } from './ChartStyles';

const SentimentChart = ({ timeRange }) => {
  const [chartData, setChartData] = useState({
    datasets: [],
  });

  useEffect(() => {
    fetchChartData();
  }, [timeRange]);

  const fetchChartData = async () => {
    try {
      const daysToLookback = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      const query = `
        WITH task_responses AS (
          SELECT 
            tr.user_id,
            tr.task_id,
            tr.sentiment_score,
            tr.task_completion_percentage,
            t.task_title,
            DATE(tr.created_at) as date,
            COUNT(*) OVER (PARTITION BY tr.user_id, DATE(tr.created_at)) as daily_responses
          FROM \`pilot_agent_public.task_responses\` tr
          JOIN \`pilot_agent_public.tasks\` t ON tr.task_id = t.id
          WHERE tr.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${daysToLookback} DAY)
            AND tr.sentiment_score IS NOT NULL
            AND tr.task_completion_percentage IS NOT NULL
        )
        SELECT 
          sentiment_score,
          task_completion_percentage,
          task_title,
          daily_responses,
          CASE 
            WHEN sentiment_score > 0.5 THEN 'Very Positive'
            WHEN sentiment_score > 0.2 THEN 'Positive'
            WHEN sentiment_score > -0.2 THEN 'Neutral'
            WHEN sentiment_score > -0.5 THEN 'Negative'
            ELSE 'Very Negative'
          END as sentiment_category
        FROM task_responses
      `;

      const results = await executeQuery(query);
      
      const data = results.map(row => ({
        x: row.sentiment_score,
        y: row.task_completion_percentage * 100,
        task_title: row.task_title,
        daily_responses: row.daily_responses,
        sentiment_category: row.sentiment_category
      }));

      // Group data by sentiment category for better visualization
      const groupedData = data.reduce((acc, point) => {
        const category = point.sentiment_category;
        if (!acc[category]) {
          acc[category] = {
            data: [],
            backgroundColor: getSentimentColor(category),
          };
        }
        acc[category].data.push({
          x: point.x,
          y: point.y,
          task_title: point.task_title,
          daily_responses: point.daily_responses
        });
        return acc;
      }, {});

      setChartData({
        datasets: Object.entries(groupedData).map(([category, dataset]) => ({
          label: category,
          data: dataset.data,
          backgroundColor: dataset.backgroundColor,
          pointRadius: 6,
          pointHoverRadius: 8,
        }))
      });

    } catch (error) {
      console.error('Error fetching sentiment data:', error);
    }
  };

  const getSentimentColor = (category) => {
    switch (category) {
      case 'Very Positive':
        return chartColors.primary;
      case 'Positive':
        return `${chartColors.primary}CC`;
      case 'Neutral':
        return `${chartColors.primary}99`;
      case 'Negative':
        return `${chartColors.secondary}CC`;
      case 'Very Negative':
        return chartColors.secondary;
      default:
        return chartColors.muted;
    }
  };

  const options = {
    ...baseChartOptions,
    scales: {
      ...baseChartOptions.scales,
      y: {
        ...baseChartOptions.scales.y,
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: '% of Tasks Completed',
          color: chartColors.text,
        },
      },
      x: {
        ...baseChartOptions.scales.x,
        min: -1,
        max: 1,
        title: {
          display: true,
          text: 'Average Sentiment Score',
          color: chartColors.text,
        },
      },
    },
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            const point = context.raw;
            return [
              `Task: ${point.task_title}`,
              `Completion: ${Math.round(point.y)}%`,
              `Sentiment: ${context.dataset.label}`,
              `Daily Responses: ${point.daily_responses}`
            ];
          }
        }
      }
    }
  };

  return (
    <div style={chartContainer}>
      <Scatter data={chartData} options={options} />
    </div>
  );
};

export default SentimentChart; 