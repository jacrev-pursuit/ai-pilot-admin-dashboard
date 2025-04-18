import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin, Alert, Typography, Modal, List, Space, Tag } from 'antd';
import { Line, Bar } from 'react-chartjs-2';
import { getElementAtEvent, getDatasetAtEvent } from 'react-chartjs-2';
import dayjs from 'dayjs';
import BuilderMetricsTable from './BuilderMetricsTable';
// Import chart styles
import { chartContainer, baseChartOptions } from './ChartStyles';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Use Vite env var

// Options for Sentiment Stacked Bar Charts
const sentimentBarOptions = (title, onClickHandler) => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: onClickHandler,
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

// Renamed function to process sentiment data with category counts
const processSentimentCountsForBarChart = (rawData) => {
  console.log('[Debug] Raw Sentiment Count Data:', rawData);
  // Possible categories from the database (expanded to include all 5)
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
  const [peerFeedbackTrendData, setPeerFeedbackTrendData] = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState(null);

  // State for feedback details modal
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackDetails, setFeedbackDetails] = useState([]);
  const [feedbackDetailsLoading, setFeedbackDetailsLoading] = useState(false);
  const [feedbackDetailsError, setFeedbackDetailsError] = useState(null);
  const [selectedFeedbackDate, setSelectedFeedbackDate] = useState('');
  const [selectedFeedbackCategory, setSelectedFeedbackCategory] = useState('');
  const peerFeedbackChartRef = React.useRef(); // Ref for the peer feedback chart

  // State for daily sentiment details modal
  const [dailySentModalVisible, setDailySentModalVisible] = useState(false);
  const [dailySentDetails, setDailySentDetails] = useState([]);
  const [dailySentDetailsLoading, setDailySentDetailsLoading] = useState(false);
  const [dailySentDetailsError, setDailySentDetailsError] = useState(null);
  const [selectedDailySentDate, setSelectedDailySentDate] = useState('');
  const [selectedDailySentCategory, setSelectedDailySentCategory] = useState('');
  const dailySentimentChartRef = React.useRef(); // Ref for the daily sentiment chart

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

        // Process general sentiment data using the counts processor
        setSentimentTrendData(processSentimentCountsForBarChart(rawSentimentData));

        // Process peer feedback sentiment data using the counts processor
        const processedPeerData = processSentimentCountsForBarChart(rawPeerFeedbackData);
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

  // --- Click Handlers for Charts --- //
  const handleDailySentimentChartClick = async (event, elements) => {
    console.log('[Debug] Daily sentiment chart clicked!', event);
    const chart = dailySentimentChartRef.current;
    if (!chart || !elements || elements.length === 0) {
      console.log('[Debug] No daily sentiment chart element found');
      return;
    }

    const { datasetIndex, index } = elements[0];
    const clickedDataset = chart.data.datasets[datasetIndex];
    const clickedLabel = chart.data.labels[index]; // Date in 'MMM D' format
    const clickedCategory = clickedDataset.label; // Sentiment category (Positive/Neutral/Negative)

    const year = trendDateRange[1].year();
    const dateForAPI = dayjs(`${clickedLabel} ${year}`, 'MMM D YYYY').format('YYYY-MM-DD');

    console.log(`[Debug] Daily Sent Click: Date=${dateForAPI}, Category=${clickedCategory}`);

    setDailySentDetailsLoading(true);
    setDailySentDetailsError(null);
    setSelectedDailySentDate(clickedLabel);
    setSelectedDailySentCategory(clickedCategory);
    setDailySentModalVisible(true);
    setDailySentDetails([]);

    try {
      const response = await fetch(`${API_URL}/api/sentiment/details?date=${dateForAPI}&category=${clickedCategory}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error fetching daily sentiment details: ${response.status}`);
      }
      const data = await response.json();
      setDailySentDetails(data);
    } catch (error) {
      console.error("Failed to fetch daily sentiment details:", error);
      setDailySentDetailsError(error.message);
    } finally {
      setDailySentDetailsLoading(false);
    }
  };

  const handlePeerFeedbackChartClick = async (event, elements) => {
    console.log('[Debug] Peer feedback chart clicked!', event);
    console.log('[Debug] Elements from handler:', elements);
    const chart = peerFeedbackChartRef.current; // Still need the ref for chart data

    if (!chart) {
      console.log('[Debug] Chart ref not found');
      return;
    }

    if (!elements || elements.length === 0) { // Check the passed elements array
        console.log('[Debug] No chart element clicked');
        return; // No element clicked
    }

    const { datasetIndex, index } = elements[0];
    const clickedDataset = chart.data.datasets[datasetIndex];
    const clickedLabel = chart.data.labels[index]; // Date in 'MMM D' format
    const clickedCategory = clickedDataset.label; // Sentiment category
    console.log(`[Debug] Click Details: datasetIndex=${datasetIndex}, index=${index}, label=${clickedLabel}, category=${clickedCategory}`);

    // Convert 'MMM D' back to 'YYYY-MM-DD' - requires knowing the year
    // Assuming the year is the current year or from the date range
    const year = trendDateRange[1].year(); // Get year from end date of range picker
    const dateForAPI = dayjs(`${clickedLabel} ${year}`, 'MMM D YYYY').format('YYYY-MM-DD');

    console.log(`Clicked: Date=${dateForAPI}, Category=${clickedCategory}`);

    // Fetch details
    console.log('[Debug] Setting modal state and fetching details...');
    setFeedbackDetailsLoading(true);
    setFeedbackDetailsError(null);
    setSelectedFeedbackDate(clickedLabel); // Store display date
    setSelectedFeedbackCategory(clickedCategory);
    setFeedbackModalVisible(true);
    setFeedbackDetails([]); // Clear previous details

    try {
      const response = await fetch(`${API_URL}/api/feedback/details?date=${dateForAPI}&category=${clickedCategory}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error fetching feedback details: ${response.status}`);
      }
      const data = await response.json();
      setFeedbackDetails(data);
    } catch (error) {
      console.error("Failed to fetch feedback details:", error);
      setFeedbackDetailsError(error.message);
    } finally {
      setFeedbackDetailsLoading(false);
    }
  };

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
                  <Bar
                    ref={dailySentimentChartRef}
                    options={sentimentBarOptions('Daily Sentiment Distribution', handleDailySentimentChartClick)}
                    data={sentimentTrendData}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No sentiment data</div>
                )}
              </div>
            </Col>
            {/* Peer Feedback Sentiment Chart */}
            <Col xs={24} md={12} lg={12}>
               <div style={{ ...chartContainer, height: '400px' }}>
                {peerFeedbackTrendData && peerFeedbackTrendData.labels.length > 0 ? (
                  <Bar
                    ref={peerFeedbackChartRef}
                    options={sentimentBarOptions('Peer Feedback Sentiment Distribution', handlePeerFeedbackChartClick)}
                    data={peerFeedbackTrendData}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No peer feedback data</div>
                )}
              </div>
            </Col>
          </Row>
        )}
      </Card>

      {/* Feedback Details Modal */}
      <Modal
        title={`Peer Feedback Details - ${selectedFeedbackCategory} on ${selectedFeedbackDate}`}
        open={feedbackModalVisible}
        onCancel={() => setFeedbackModalVisible(false)}
        footer={null} // No OK/Cancel buttons
        width={800}
      >
        {feedbackDetailsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
        ) : feedbackDetailsError ? (
          <Alert message="Error Loading Details" description={feedbackDetailsError} type="error" showIcon />
        ) : feedbackDetails.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={feedbackDetails}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space size="middle">
                       <Text>From: <Text strong>{item.reviewer_name || 'Anonymous'}</Text></Text>
                       <Text>To: <Text strong>{item.recipient_name || 'Unknown'}</Text></Text>
                    </Space>
                  }
                  description={item.feedback_text}
                />
                <Text type="secondary">{dayjs(item.created_at?.value || item.created_at).format('MMMM D')}</Text>
              </List.Item>
            )}
          />
        ) : (
          <Text>No specific feedback found for this category on this day.</Text>
        )}
      </Modal>

      {/* Daily Sentiment Details Modal */}
      <Modal
        title={`Daily Sentiment Details - ${selectedDailySentCategory} on ${selectedDailySentDate}`}
        open={dailySentModalVisible}
        onCancel={() => setDailySentModalVisible(false)}
        footer={null}
        width={800}
      >
        {dailySentDetailsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
        ) : dailySentDetailsError ? (
          <Alert message="Error Loading Details" description={dailySentDetailsError} type="error" showIcon />
        ) : dailySentDetails.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={dailySentDetails}
            renderItem={item => (
              <List.Item
                key={item.user_id + item.date?.value}
              >
                <List.Item.Meta
                  title={<Text strong>{item.user_name || `User ID: ${item.user_id}`}</Text>}
                  description={item.sentiment_reason || 'No reason provided.'}
                />
                <Space size="large">
                   <Text>Score: {item.sentiment_score?.toFixed(2) ?? 'N/A'}</Text>
                   <Text>Messages: {item.message_count ?? 'N/A'}</Text>
                   <Text>Category: <Tag>{item.sentiment_category || 'N/A'}</Tag></Text>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Text>No specific sentiment details found for this category on this day.</Text>
        )}
      </Modal>

      {/* Placeholder for Outliers Section */}
      {/* <Card style={{ marginTop: '24px' }}> */}
      {/*   <Typography.Title level={4} style={{ margin: 0 }}>Outliers</Typography.Title> */}
      {/*   <p style={{ color: '#6c757d', marginTop: '10px' }}>Outlier detection coming soon...</p> */}
      {/* </Card> */}
    </div>
  );
};

export default PilotOverview; 