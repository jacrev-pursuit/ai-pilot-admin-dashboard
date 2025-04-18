import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Spin, Alert, Typography, Modal, List, Space, Tag } from 'antd';
import { Line, Bar } from 'react-chartjs-2';
import { getElementAtEvent, getDatasetAtEvent } from 'react-chartjs-2';
import dayjs from 'dayjs';
import BuilderMetricsTable from './BuilderMetricsTable';
// Import chart styles
import { chartContainer, baseChartOptions } from './ChartStyles';
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils'; // Import grading util

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

// Utility to fetch data
const fetchData = async (endpoint, params) => {
  const queryString = new URLSearchParams(params).toString();
  // Use relative path for fetch
  const response = await fetch(`/api/${endpoint}?${queryString}`);
  if (!response.ok) {
    console.error(`HTTP error! status: ${response.status}, url: ${response.url}`)
    const errorBody = await response.text();
    console.error('Error body:', errorBody);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

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

// Define possible grades and colors for the distribution chart
const gradeCategories = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];
const gradeColors = {
  'A+': '#2f9e44',
  'A': '#40c057',
  'A-': '#69db7c',
  'B+': '#3bc9db',
  'B': '#66d9e8',
  'B-': '#99e9f2',
  'C+': '#ff922b',
  'C': '#ffa94d',
  'F': '#ff6b6b'
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

  // State for Grade Distribution Chart
  const [gradeDistData, setGradeDistData] = useState(null);
  const [gradeDistLoading, setGradeDistLoading] = useState(false);
  const [gradeDistError, setGradeDistError] = useState(null);
  const gradeDistChartRef = React.useRef(); // Ref for grade dist chart

  // State for grade submissions modal
  const [gradeSubmissionsModalVisible, setGradeSubmissionsModalVisible] = useState(false);
  const [gradeSubmissions, setGradeSubmissions] = useState([]);
  const [gradeSubmissionsLoading, setGradeSubmissionsLoading] = useState(false);
  const [gradeSubmissionsError, setGradeSubmissionsError] = useState(null);
  const [selectedGradeTask, setSelectedGradeTask] = useState('');
  const [selectedGradeCategory, setSelectedGradeCategory] = useState('');

  useEffect(() => {
    const fetchTrends = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      setTrendsLoading(true);
      setTrendsError(null);
      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch prompts data
        const promptsResponse = await fetchData('trends/prompts', { startDate, endDate });
        if (!promptsResponse) throw new Error('No data returned from prompts fetch');

        // Fetch general sentiment data
        const sentimentResponse = await fetchData('trends/sentiment', { startDate, endDate });
        if (!sentimentResponse) throw new Error('No data returned from sentiment fetch');

        // Fetch peer feedback sentiment data
        const peerFeedbackResponse = await fetchData('trends/peer-feedback', { startDate, endDate });
        if (!peerFeedbackResponse) throw new Error('No data returned from peer feedback fetch');

        // Process prompts data for line chart
        setPromptTrendData({
          labels: promptsResponse.map(d => dayjs(d.date?.value || d.date).format('MMM D')),
          datasets: [{
            label: 'Prompts Sent',
            data: promptsResponse.map(d => d.prompt_count),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        });

        // Process general sentiment data using the counts processor
        setSentimentTrendData(processSentimentCountsForBarChart(sentimentResponse));

        // Process peer feedback sentiment data using the counts processor
        const processedPeerData = processSentimentCountsForBarChart(peerFeedbackResponse);
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

  // New useEffect for Grade Distribution
  useEffect(() => {
    const fetchGradeDistribution = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      setGradeDistLoading(true);
      setGradeDistError(null);
      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      try {
        const response = await fetchData('grades/distribution', { startDate, endDate });
        if (!response) throw new Error('No data returned from grade distribution fetch');
        console.log("[Debug] Raw Grade Dist Data:", response);

        // Process data for grouped bar chart
        const gradesByTask = response.reduce((acc, item) => {
          const taskDate = item.task_date?.value ? dayjs(item.task_date.value).format('MMM D') : 'No Date';
          const taskTitle = `${item.task_title || 'Unknown Task'} (${taskDate})`; // Combine title and date
          const grade = getLetterGrade(item.score);

          if (!acc[taskTitle]) {
            acc[taskTitle] = {};
            gradeCategories.forEach(g => { acc[taskTitle][g] = 0; }); // Initialize all grades
          }
          if (gradeCategories.includes(grade)) {
              acc[taskTitle][grade]++;
          }
          return acc;
        }, {});
        console.log("[Debug] Grades By Task:", gradesByTask);

        const taskLabels = Object.keys(gradesByTask);

        const datasets = gradeCategories.map(grade => ({
          label: grade,
          data: taskLabels.map(task => gradesByTask[task][grade] || 0),
          backgroundColor: gradeColors[grade] || '#adb5bd' // Fallback color
        }));
        console.log("[Debug] Grade Datasets:", datasets);

        setGradeDistData({
          labels: taskLabels,
          datasets: datasets
        });

      } catch (error) {
        console.error("Failed to fetch grade distribution data:", error);
        setGradeDistError(error.message);
      } finally {
        setGradeDistLoading(false);
      }
    };

    fetchGradeDistribution();
  }, [trendDateRange]);

  // --- Chart Options --- //
  // Options for Grade Distribution Chart (Stacked Bar)
  const gradeChartOptions = (onClickHandler) => ({
    responsive: true,
    maintainAspectRatio: false,
    onClick: onClickHandler, // Pass click handler
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Grade Distribution per Task'
      },
      tooltip: {
        mode: 'index', // Show tooltip for all bars in the group
        intersect: false,
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
            display: true,
            text: 'Task Title'
        },
        ticks: {
             // Potentially shorten labels if they are too long
             callback: function(value, index, values) {
                const label = this.getLabelForValue(value);
                return label.length > 20 ? label.substring(0, 17) + '...' : label;
            }
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Submissions'
        }
      }
    }
  });

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
      const response = await fetchData('sentiment/details', { date: dateForAPI, category: clickedCategory });
      if (!response) throw new Error('No data returned from daily sentiment details fetch');
      setDailySentDetails(response);
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
      const response = await fetchData('feedback/details', { date: dateForAPI, category: clickedCategory });
      if (!response) throw new Error('No data returned from feedback details fetch');
      setFeedbackDetails(response);
    } catch (error) {
      console.error("Failed to fetch feedback details:", error);
      setFeedbackDetailsError(error.message);
    } finally {
      setFeedbackDetailsLoading(false);
    }
  };

  // Click handler for Grade Distribution Chart
  const handleGradeChartClick = async (event, elements) => {
    console.log('[Debug] Grade chart clicked!', event);
    const chart = gradeDistChartRef.current;
    if (!chart || !elements || elements.length === 0) {
      console.log('[Debug] No grade chart element found');
      return;
    }

    const { datasetIndex, index } = elements[0];
    const clickedGrade = chart.data.datasets[datasetIndex].label; // e.g., 'A+', 'B'
    const clickedTaskLabel = chart.data.labels[index]; // e.g., 'Task Title (MMM D)'

    // Extract title and date from label
    const match = clickedTaskLabel.match(/^(.*)\s\(([^)]+)\)$/);
    if (!match) {
        console.error('Could not parse task label:', clickedTaskLabel);
        return;
    }
    const taskTitle = match[1];
    const taskDateStr = match[2]; // 'MMM D' format

    const year = trendDateRange[1].year(); // Use year from date range
    const dateForAPI = dayjs(`${taskDateStr} ${year}`, 'MMM D YYYY').format('YYYY-MM-DD');

    console.log(`[Debug] Grade Click: Task=${taskTitle}, Date=${dateForAPI}, Grade=${clickedGrade}`);

    setSelectedGradeTask(clickedTaskLabel); // Store full label for modal title
    setSelectedGradeCategory(clickedGrade);
    setGradeSubmissionsLoading(true);
    setGradeSubmissionsError(null);
    setGradeSubmissionsModalVisible(true);
    setGradeSubmissions([]);

    try {
      const response = await fetchData('grades/submissions', { task_title: encodeURIComponent(taskTitle), task_date: dateForAPI, grade: clickedGrade });
      if (!response) throw new Error('No data returned from grade submissions fetch');
      setGradeSubmissions(response);
    } catch (error) {
      console.error("Failed to fetch grade submission details:", error);
      setGradeSubmissionsError(error.message);
    } finally {
      setGradeSubmissionsLoading(false);
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

      {/* Grade Distribution Chart Section */}
      <Card style={{ marginBottom: '24px' }}>
         <Title level={4} style={{ margin: 0, marginBottom: '16px' }}>Grade Distribution per Task</Title>
         {gradeDistLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
         {gradeDistError && <Alert message="Error loading grade distribution" description={gradeDistError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
         {!gradeDistLoading && !gradeDistError && gradeDistData && gradeDistData.labels.length > 0 ? (
            <div style={{ ...chartContainer, height: '450px' }}>
                 <Bar
                    ref={gradeDistChartRef}
                    options={gradeChartOptions(handleGradeChartClick)}
                    data={gradeDistData}
                 />
            </div>
         ) : (!gradeDistLoading && !gradeDistError && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No grade data available for the selected period.</div>
         ))}
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

      {/* Grade Submissions Details Modal */}
      <Modal
        title={`Submissions for ${selectedGradeTask} - Grade ${selectedGradeCategory}`}
        open={gradeSubmissionsModalVisible}
        onCancel={() => setGradeSubmissionsModalVisible(false)}
        footer={null}
        width={900} // Wider modal
      >
        {gradeSubmissionsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
        ) : gradeSubmissionsError ? (
          <Alert message="Error Loading Submissions" description={gradeSubmissionsError} type="error" showIcon />
        ) : gradeSubmissions.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={gradeSubmissions}
            renderItem={item => (
              <List.Item key={item.user_id + item.grading_timestamp?.value}> {/* Use a likely unique key */}
                <List.Item.Meta
                  title={<Text strong>{item.user_name || `User ID: ${item.user_id}`}</Text>}
                  description={<pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '10px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>{item.response_content || 'No content available'}</pre>}
                />
                <Space direction="vertical" size="small">
                   <Text>Score: {
                       !isNaN(parseFloat(item.scores)) 
                       ? parseFloat(item.scores).toFixed(2) 
                       : item.scores ?? 'N/A' // Display original string if not a valid number
                   }</Text>
                   <Text>Feedback: {item.feedback || 'N/A'}</Text>
                   <Text type="secondary">Graded: {item.grading_timestamp?.value ? dayjs(item.grading_timestamp.value).format('YYYY-MM-DD HH:mm') : 'N/A'}</Text>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Text>No submissions found for this grade and task.</Text>
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