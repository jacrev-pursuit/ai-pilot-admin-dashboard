import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin, Alert, Typography } from 'antd';
import { Line, Bar } from 'react-chartjs-2';
import dayjs from 'dayjs';
import BuilderMetricsTable from './BuilderMetricsTable';
// Import chart styles
import { chartContainer, baseChartOptions } from './ChartStyles';

const { RangePicker } = DatePicker;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Use Vite env var

// Options for Sentiment Stacked Bar Charts
const sentimentBarOptions = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
    title: {
        display: true,
        text: title // Dynamic title
    }
  },
  scales: {
    x: {
      stacked: true,
      ticks: {
        maxTicksLimit: 10,
        autoSkip: true,
      },
      title: {
        display: true,
        text: 'Date'
      }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      title: {
        display: true,
        text: 'Number of Entries' // Generic Y-axis title
      }
    }
  }
});

// Helper to categorize sentiment score
const getSentimentCategory = (score) => {
  if (score === null || score === undefined) return 'Neutral';
  if (score > 0.2) return 'Positive';
  if (score < -0.2) return 'Negative';
  return 'Neutral';
};

// Define colors for the 5 sentiment categories
const sentimentCategoryColors = {
  'Very Positive': 'rgba(16, 185, 129, 0.6)',  // Brighter Green
  'Positive': 'rgba(75, 192, 192, 0.6)',     // Greenish/Cyan
  'Neutral': 'rgba(201, 203, 207, 0.6)',    // Grey
  'Negative': 'rgba(245, 158, 11, 0.6)',     // Orange
  'Very Negative': 'rgba(255, 99, 132, 0.6)'     // Reddish
};

// Function to process raw GENERAL sentiment data (uses average score)
const processGeneralSentimentForBarChart = (rawData) => {
  const processedSentiment = rawData.reduce((acc, item) => {
    const dateStr = dayjs(item.date?.value || item.date).format('YYYY-MM-DD');
    const category = getSentimentCategory(item.sentiment_score);
    if (!acc[dateStr]) {
      acc[dateStr] = { Positive: 0, Neutral: 0, Negative: 0 };
    }
    acc[dateStr][category]++;
    return acc;
  }, {});

  const labels = Object.keys(processedSentiment).sort();
  const positiveCounts = labels.map(date => processedSentiment[date].Positive);
  const neutralCounts = labels.map(date => processedSentiment[date].Neutral);
  const negativeCounts = labels.map(date => processedSentiment[date].Negative);

  return {
    labels: labels.map(date => dayjs(date).format('MMM D')),
    datasets: [
      { label: 'Positive', data: positiveCounts, backgroundColor: 'rgba(75, 192, 192, 0.6)' },
      { label: 'Neutral', data: neutralCounts, backgroundColor: 'rgba(201, 203, 207, 0.6)' },
      { label: 'Negative', data: negativeCounts, backgroundColor: 'rgba(255, 99, 132, 0.6)' }
    ]
  };
};

// Function to process raw PEER FEEDBACK sentiment data (uses counts per category)
const processPeerFeedbackSentimentForBarChart = (rawData) => {
  console.log('[Debug] Raw Peer Feedback Data:', rawData);
  // Possible categories from the database
  const possibleCategories = Object.keys(sentimentCategoryColors);

  // Group counts by date and category
  const countsByDate = rawData.reduce((acc, item) => {
    const dateStr = dayjs(item.date?.value || item.date).format('YYYY-MM-DD');
    const category = item.sentiment_category;

    if (!acc[dateStr]) {
      acc[dateStr] = {};
      possibleCategories.forEach(cat => { acc[dateStr][cat] = 0; }); // Initialize all categories with 0
    }
    // Increment the count for the specific category, handling potential null/undefined categories defensively
    if (category && possibleCategories.includes(category)) {
       acc[dateStr][category] = (acc[dateStr][category] || 0) + Number(item.count || 0);
    }
    return acc;
  }, {});

  console.log('[Debug] Peer Feedback Counts By Date:', countsByDate);

  const labels = Object.keys(countsByDate).sort(); // Sorted dates

  // Create datasets for each category
  const datasets = possibleCategories.map(category => ({
    label: category,
    data: labels.map(date => countsByDate[date][category] || 0), // Get count for this date, default 0
    backgroundColor: sentimentCategoryColors[category] || 'rgba(150, 150, 150, 0.6)' // Use defined color or fallback grey
  }));

  const result = {
    labels: labels.map(date => dayjs(date).format('MMM D')), // Format dates for display
    datasets: datasets
  };

  console.log('[Debug] Processed Peer Feedback Chart Data:', result);
  return result;
};

const PilotOverview = () => {
  const [trendDateRange, setTrendDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [promptTrendData, setPromptTrendData] = useState(null);
  const [sentimentTrendData, setSentimentTrendData] = useState(null);
  const [peerFeedbackTrendData, setPeerFeedbackTrendData] = useState(null); // State for peer feedback
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState(null);

  useEffect(() => {
    const fetchTrends = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      setTrendsLoading(true);
      setTrendsError(null);
      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch prompts data
        const promptsResponse = await fetch(`${API_URL}/api/trends/prompts?startDate=${startDate}&endDate=${endDate}`);
        if (!promptsResponse.ok) throw new Error(`HTTP error fetching prompts: ${promptsResponse.status}`);
        const promptsData = await promptsResponse.json();

        // Fetch general sentiment data
        const sentimentResponse = await fetch(`${API_URL}/api/trends/sentiment?startDate=${startDate}&endDate=${endDate}`);
        if (!sentimentResponse.ok) throw new Error(`HTTP error fetching sentiment: ${sentimentResponse.status}`);
        const rawSentimentData = await sentimentResponse.json();

        // Fetch peer feedback sentiment data
        const peerFeedbackResponse = await fetch(`${API_URL}/api/trends/peer-feedback?startDate=${startDate}&endDate=${endDate}`);
        if (!peerFeedbackResponse.ok) throw new Error(`HTTP error fetching peer feedback: ${peerFeedbackResponse.status}`);
        const rawPeerFeedbackData = await peerFeedbackResponse.json();

        // Process prompts data for line chart
        setPromptTrendData({
          labels: promptsData.map(d => dayjs(d.date?.value || d.date).format('MMM D')),
          datasets: [{
            label: 'Prompts Sent',
            data: promptsData.map(d => d.prompt_count),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        });

        // Process general sentiment data for stacked bar chart
        setSentimentTrendData(processGeneralSentimentForBarChart(rawSentimentData));

        // Process peer feedback sentiment data for stacked bar chart
        const processedPeerData = processPeerFeedbackSentimentForBarChart(rawPeerFeedbackData);
        console.log('[Debug] Setting Peer Feedback State:', processedPeerData);
        setPeerFeedbackTrendData(processedPeerData);

      } catch (error) {
        console.error("Failed to fetch trend data:", error);
        setTrendsError(error.message);
      } finally {
        setTrendsLoading(false);
      }
    };

    fetchTrends();
  }, [trendDateRange]);

  return (
    <div>
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Pilot Overview</Typography.Title>
      </div>

      {/* Trend Charts Section */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Overall Trends</Typography.Title>
          <RangePicker
            value={trendDateRange}
            onChange={setTrendDateRange}
            allowClear={false}
          />
        </div>
        {trendsLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
        {trendsError && <Alert message="Error loading trends" description={trendsError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
        {!trendsLoading && !trendsError && (
          <Row gutter={[16, 16]}>
            {/* Prompt Trend Chart */}
            <Col xs={24} md={12} lg={12}>
              <div style={{ ...chartContainer, height: '400px' }}>
                {promptTrendData ? (
                  <Line options={baseChartOptions} data={promptTrendData} />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No prompt data</div>
                )}
              </div>
            </Col>
            {/* General Sentiment Chart */}
            <Col xs={24} md={12} lg={12}>
               <div style={{ ...chartContainer, height: '400px' }}>
                {sentimentTrendData && sentimentTrendData.labels.length > 0 ? (
                  <Bar options={sentimentBarOptions('Daily Sentiment Distribution')} data={sentimentTrendData} />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No sentiment data</div>
                )}
              </div>
            </Col>
            {/* Peer Feedback Sentiment Chart */}
            <Col xs={24} md={12} lg={12}>
               <div style={{ ...chartContainer, height: '400px' }}>
                {peerFeedbackTrendData && peerFeedbackTrendData.labels.length > 0 ? (
                  <Bar options={sentimentBarOptions('Peer Feedback Sentiment Distribution')} data={peerFeedbackTrendData} />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No peer feedback data</div>
                )}
              </div>
            </Col>
          </Row>
        )}
      </Card>

      {/* Existing Builder Metrics Table */}
      <BuilderMetricsTable />

      {/* Placeholder for Outliers Section */}
      {/* <Card style={{ marginTop: '24px' }}> */}
      {/*   <Typography.Title level={4} style={{ margin: 0 }}>Outliers</Typography.Title> */}
      {/*   <p style={{ color: '#6c757d', marginTop: '10px' }}>Outlier detection coming soon...</p> */}
      {/* </Card> */}
    </div>
  );
};

export default PilotOverview; 