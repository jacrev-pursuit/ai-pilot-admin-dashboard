import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Row, Col, DatePicker, Spin, Alert, Typography, Modal, List, Space, Tag, Table, Button, Select } from 'antd';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { getElementAtEvent, getDatasetAtEvent } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend
} from 'chart.js';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';
import BuilderMetricsTable from './BuilderMetricsTable';
// Import chart styles
import { chartContainer, baseChartOptions, chartColors } from './ChartStyles';
import { getLetterGrade, getGradeColor, getGradeTagClass } from '../utils/gradingUtils'; // Import grading util
// Import new fetch functions
import {
  fetchBuilderData,
  fetchBuilderDetails,
  fetchAllPeerFeedback, 
  fetchAllTaskAnalysis,
  fetchTaskSummary,
  fetchTaskGradeDistribution
} from '../services/builderService';
import { parseAnalysis } from '../utils/parsingUtils'; // Import the utility function

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,  // Required for Pie charts
  ChartTitle,
  Tooltip,
  Legend
);

const { RangePicker } = DatePicker;
const { Text, Title, Paragraph } = Typography;

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
      labels: { color: chartColors.text }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
    title: {
        display: true,
        text: title,
        color: chartColors.text
    }
  },
  scales: {
    x: {
      stacked: true,
      ticks: {
        maxTicksLimit: 10,
        autoSkip: true,
        color: chartColors.text
      },
      title: {
        display: true,
        text: 'Date',
        color: chartColors.text
      }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        color: chartColors.text
      },
      title: {
        display: true,
        text: 'Number of Entries',
        color: chartColors.text
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
  'Very Positive': '#1e4d28',  // Darker Green
  'Positive': '#38761d',     // Original Green
  'Neutral': '#808080',    // Grey from tags
  'Negative': '#b45f06',     // Orange from tags
  'Very Negative': '#990000'     // Red from tags
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

// Define possible grades and colors for the distribution charts
const gradeCategories = ['A', 'B', 'C', 'F']; // Simplified categories
const gradeColors = {
  'A': '#38761d', // Green for all A grades
  'B': '#bf9002', // Yellow/Gold for all B grades
  'C': '#b45f06', // Orange for all C grades
  'F': '#990000'  // Red for F grades
};

const PilotOverview = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  const [trendDateRange, setTrendDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [promptTrendData, setPromptTrendData] = useState(null);
  const [sentimentTrendData, setSentimentTrendData] = useState(null);
  const [peerFeedbackTrendData, setPeerFeedbackTrendData] = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState(null);

  // State for NEW tables
  const [allPeerFeedbackData, setAllPeerFeedbackData] = useState([]);
  const [allTaskAnalysisData, setAllTaskAnalysisData] = useState([]);
  const [peerFeedbackLoading, setPeerFeedbackLoading] = useState(false);
  const [taskAnalysisLoading, setTaskAnalysisLoading] = useState(false);
  const [peerFeedbackError, setPeerFeedbackError] = useState(null);
  const [taskAnalysisError, setTaskAnalysisError] = useState(null);

  // State for feedback details modal
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackDetails, setFeedbackDetails] = useState([]);
  const [feedbackDetailsLoading, setFeedbackDetailsLoading] = useState(false);
  const [feedbackDetailsError, setFeedbackDetailsError] = useState(null);
  const [selectedFeedbackDate, setSelectedFeedbackDate] = useState('');
  const [selectedFeedbackCategory, setSelectedFeedbackCategory] = useState('');
  const peerFeedbackChartRef = React.useRef(); // Ref for the peer feedback chart

  // State for Grade Distribution Charts (Separate states again)
  const [workProductGradeDistData, setWorkProductGradeDistData] = useState(null); 
  const [comprehensionGradeDistData, setComprehensionGradeDistData] = useState(null); 
  const [gradeDistLoading, setGradeDistLoading] = useState(false);
  const [gradeDistError, setGradeDistError] = useState(null);

  // Define specific options for the Prompt Trend Chart
  const promptTrendChartOptions = {
    ...baseChartOptions, // Start with base options
    plugins: {
      ...baseChartOptions.plugins,
      legend: {
        display: false, // Remove the legend
      },
      title: {
        display: true,
        text: 'Prompts Sent Over Time', // Add the title
        color: chartColors.text, // Ensure title color matches theme
      },
    },
  };

  // Helper to get unique values for table filters
  const getUniqueFilterValues = (data, key) => {
    if (!data || data.length === 0) return [];
    const uniqueValues = [...new Set(data.map(item => item[key]).filter(Boolean))];
    return uniqueValues.sort().map(value => ({ text: value, value: value }));
  };

  // Helper to get unique grades for filtering
  const getUniqueGradeFilterValues = (data) => {
    if (!data || data.length === 0) return [];
    const uniqueGrades = [...new Set(data.map(item => {
        const analysis = parseAnalysis(item.analysis);
        if (!analysis) return null;
        const score = analysis.completion_score;
        return getLetterGrade(score);
    }).filter(Boolean))]; // Filter out null/undefined grades
    return uniqueGrades.sort().map(grade => ({ text: grade, value: grade }));
  };

  // Generate filter options dynamically
  const reviewerFilters = useMemo(() => getUniqueFilterValues(allPeerFeedbackData, 'reviewer_name'), [allPeerFeedbackData]);
  const recipientFilters = useMemo(() => getUniqueFilterValues(allPeerFeedbackData, 'recipient_name'), [allPeerFeedbackData]);
  const sentimentFilters = useMemo(() => getUniqueFilterValues(allPeerFeedbackData, 'sentiment_label'), [allPeerFeedbackData]);

  const builderFilters = useMemo(() => getUniqueFilterValues(allTaskAnalysisData, 'user_name'), [allTaskAnalysisData]);
  const taskTitleFilters = useMemo(() => getUniqueFilterValues(allTaskAnalysisData, 'task_title'), [allTaskAnalysisData]);
  const learningTypeFilters = useMemo(() => getUniqueFilterValues(allTaskAnalysisData, 'learning_type'), [allTaskAnalysisData]);
  const gradeFilters = useMemo(() => getUniqueGradeFilterValues(allTaskAnalysisData), [allTaskAnalysisData]);

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

        // Fetch peer feedback sentiment data
        const peerFeedbackResponse = await fetchData('trends/peer-feedback', { startDate, endDate });
        if (!peerFeedbackResponse) throw new Error('No data returned from peer feedback fetch');

        // Process prompts data for line chart
        setPromptTrendData({
          labels: promptsResponse.map(d => dayjs(d.date?.value || d.date).format('MMM D')),
          datasets: [{
            label: 'Prompts Sent',
            data: promptsResponse.map(d => d.prompt_count),
            borderColor: '#ffffff',
            tension: 0.1
          }]
        });

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

  // Fetch data for NEW tables (separate useEffect)
  useEffect(() => {
    const fetchTableData = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      // Fetch All Peer Feedback
      setPeerFeedbackLoading(true);
      setPeerFeedbackError(null);
      try {
        const feedbackData = await fetchAllPeerFeedback(startDate, endDate);
        setAllPeerFeedbackData(feedbackData);
      } catch (err) {
        console.error("Failed to fetch all peer feedback:", err);
        setPeerFeedbackError(err.message);
      } finally {
        setPeerFeedbackLoading(false);
      }

      // Fetch All Task Analysis
      setTaskAnalysisLoading(true);
      setTaskAnalysisError(null);
      try {
        const analysisData = await fetchAllTaskAnalysis(startDate, endDate);
        setAllTaskAnalysisData(analysisData);
      } catch (err) {
        console.error("Failed to fetch all task analysis:", err);
        setTaskAnalysisError(err.message);
      } finally {
        setTaskAnalysisLoading(false);
      }
    };

    fetchTableData();
  }, [trendDateRange]);

  // useEffect for Grade Distribution (Fetch separately)
  useEffect(() => {
    const fetchAllGradeDistributions = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      setGradeDistLoading(true);
      setGradeDistError(null);
      setWorkProductGradeDistData(null); // Clear previous data
      setComprehensionGradeDistData(null); // Clear previous data

      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch Work Product Grades using the correct endpoint
        const wpResponse = await fetchData('overview/grade-distribution', { startDate, endDate, learningType: 'Work product' });
        if (!wpResponse) throw new Error('No data returned for Work Product grade distribution');
        const wpProcessedData = processGradeDistributionData(wpResponse);
        // Store the original API data for the pie chart
        wpProcessedData._apiData = wpResponse;
        setWorkProductGradeDistData(wpProcessedData);

        // Fetch Comprehension Grades using the correct endpoint
        const compResponse = await fetchData('overview/grade-distribution', { startDate, endDate, learningType: 'Key concept' });
        if (!compResponse) throw new Error('No data returned for Comprehension grade distribution');
        const compProcessedData = processGradeDistributionData(compResponse);
        // Store the original API data for the pie chart
        compProcessedData._apiData = compResponse;
        setComprehensionGradeDistData(compProcessedData);

      } catch (error) {
        console.error("Failed to fetch grade distribution data:", error);
        setGradeDistError(error.message);
      } finally {
        setGradeDistLoading(false);
      }
    };

    fetchAllGradeDistributions();
  }, [trendDateRange]);

  // Helper function to process grade distribution data for STACKED bar chart
  const processGradeDistributionData = (apiData) => {
    // Helper function to map detailed grade to a primary letter grade
    const mapToPrimaryGrade = (detailedGrade) => {
      if (!detailedGrade) return 'F'; // Or handle as N/A if preferred
      if (detailedGrade.startsWith('A')) return 'A';
      if (detailedGrade.startsWith('B')) return 'B';
      if (detailedGrade.startsWith('C')) return 'C';
      if (detailedGrade === 'F') return 'F';
      return 'F'; // Default or unmapped
    };

    // Group counts by task_title (with date), then by primary grade
    const gradesByTask = apiData.reduce((acc, item) => {
      const dateStr = item.date ? dayjs(item.date?.value || item.date).format('YYYY-MM-DD') : '';
      const taskLabel = dateStr ? `${item.task_title || 'Unknown Task'} (${dateStr})` : (item.task_title || 'Unknown Task');
      const primaryGrade = mapToPrimaryGrade(item.grade); // Map to A, B, C, F
      const count = item.count || 0;

      if (!acc[taskLabel]) {
        acc[taskLabel] = {};
        gradeCategories.forEach(g => { acc[taskLabel][g] = 0; }); // Initialize all primary grades for the task
      }
      // Accumulate counts for the primary grade
      if (gradeCategories.includes(primaryGrade)) {
         acc[taskLabel][primaryGrade] = (acc[taskLabel][primaryGrade] || 0) + count;
      }
      return acc;
    }, {});

    const taskLabels = Object.keys(gradesByTask).sort(); // Sort task titles alphabetically

    // Create a dataset for each primary grade category
    const datasets = gradeCategories.map(grade => ({
      label: grade,
      data: taskLabels.map(task => gradesByTask[task][grade] || 0),
      backgroundColor: gradeColors[grade] || '#adb5bd',
      categoryPercentage: 1.0, // Fill the category space
      barPercentage: 1.0,      // Fill the bar space
      maxBarThickness: 48      // Ensure bars are thick enough for 5 bars in 300px
    }));

    return {
      labels: taskLabels,
      datasets: datasets
    };
  };

  // Process data for pie charts - aggregates all grades regardless of task
  const processGradeDistributionForPieChart = (apiData) => {
    // Handle empty or undefined data
    if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'No Data Available',
          data: [1],
          backgroundColor: ['#808080'],
          borderWidth: 0
        }]
      };
    }
    
    // Initialize counts for each grade category
    const gradeCounts = {
      'A': 0,
      'B': 0,
      'C': 0,
      'F': 0
    };
    
    // Aggregate all grades
    apiData.forEach(item => {
      const grade = item.grade || '';
      const count = parseInt(item.count, 10) || 0;
      
      if (grade.startsWith('A')) gradeCounts['A'] += count;
      else if (grade.startsWith('B')) gradeCounts['B'] += count;
      else if (grade.startsWith('C')) gradeCounts['C'] += count;
      else if (grade === 'F') gradeCounts['F'] += count;
    });
    
    // Check if we have any data after processing
    const total = Object.values(gradeCounts).reduce((sum, count) => sum + count, 0);
    if (total === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'No Data Available',
          data: [1],
          backgroundColor: ['#808080'],
          borderWidth: 0
        }]
      };
    }
    
    return {
      labels: Object.keys(gradeCounts),
      datasets: [{
        label: 'Grade Distribution',
        data: Object.values(gradeCounts),
        backgroundColor: [
          gradeColors['A'],
          gradeColors['B'],
          gradeColors['C'], 
          gradeColors['F']
        ],
        borderWidth: 0
      }]
    };
  };
  
  // Options for pie charts
  const pieChartOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { 
          color: chartColors.text,
          font: {
            size: 11
          },
          boxWidth: 15,
          padding: 5
        }
      },
      title: {
        display: true,
        text: title,
        color: chartColors.text,
        font: {
          size: 14,
          weight: 'bold'
        },
        padding: {
          top: 5,
          bottom: 5
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  });

  // Options for Stacked Bar Chart
  const gradeDistributionBarOptions = (title) => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Make it a horizontal bar chart
      layout: {
        padding: {
          left: 50 // Added padding to give more space for Y-axis labels
        }
      },
      plugins: {
        legend: { 
          position: 'right',
          labels: { color: chartColors.text }
        },
        title: { 
          display: true, 
          text: title, // User wants to wrap this if long, but Chart.js doesn't auto-wrap titles.
          color: chartColors.text
        },
        tooltip: { 
          mode: 'y', // Changed from 'index' to 'y' for horizontal bar chart
          intersect: false 
        }
      },
      scales: {
        x: { // X-axis is now 'Number of Assessments'
            stacked: true, 
            beginAtZero: true,
            title: { 
              display: true, 
              text: 'Number of Assessments',
              color: chartColors.text
            },
            ticks: {
              color: chartColors.text
            }
        },
        y: { // Y-axis is now 'Task Title' (categories)
            stacked: true, 
            title: { 
              display: false, // Remove Y-axis title
              text: 'Task Title',
              color: chartColors.text
            },
             ticks: { 
               autoSkip: false, // Ensure all labels are attempted to be shown
               callback: function(value, index, values) {
                  const label = this.getLabelForValue(value);
                  if (typeof label === 'string' && label.length > 25) {
                    const words = label.split(' ');
                    const lines = [];
                    let currentLine = '';
                    for (const word of words) {
                      if (currentLine.length === 0) {
                        currentLine = word;
                      } else if ((currentLine + ' ' + word).length <= 22) { // Max length per line
                        currentLine += ' ' + word;
                      } else {
                        lines.push(currentLine);
                        currentLine = word;
                      }
                    }
                    if (currentLine.length > 0) {
                        lines.push(currentLine);
                    }
                    return lines.length > 0 ? lines : label; // Return array or original label
                  }
                  return label;
              },
              color: chartColors.text
          }
        }
      }
  });

  // --- Click Handlers for Charts --- //
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

  // --- Table Column Definitions --- 

  const overviewPeerFeedbackColumns = [
    { 
      title: 'Date', 
      dataIndex: 'timestamp', 
      key: 'timestamp', 
      width: '15%',
      render: (ts) => ts ? dayjs(ts?.value || ts).format('MMM D, YYYY') : 'N/A', 
      sorter: (a, b) => dayjs(a.timestamp?.value || a.timestamp).unix() - dayjs(b.timestamp?.value || b.timestamp).unix(), 
      sortDirections: ['descend', 'ascend']
    },
    { 
      title: 'Reviewer',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
      width: '15%',
      render: (text, record) => (
        record.from_user_id ? (
          <Link to={`/builders/${record.from_user_id}`}>{text || 'Unknown'}</Link>
        ) : ( text || 'Unknown' )
      ),
      sorter: (a, b) => (a.reviewer_name || '').localeCompare(b.reviewer_name || ''),
      filters: reviewerFilters,
      onFilter: (value, record) => (record.reviewer_name || '').indexOf(value) === 0,
    },
     { 
      title: 'Recipient',
      dataIndex: 'recipient_name',
      key: 'recipient_name',
      width: '15%',
      render: (text, record) => (
        record.to_user_id ? (
          <Link to={`/builders/${record.to_user_id}`}>{text || 'Unknown'}</Link>
        ) : ( text || 'Unknown' )
      ),
       sorter: (a, b) => (a.recipient_name || '').localeCompare(b.recipient_name || ''),
       filters: recipientFilters,
       onFilter: (value, record) => (record.recipient_name || '').indexOf(value) === 0,
    },
    { 
      title: 'Sentiment', 
      dataIndex: 'sentiment_label',
      key: 'sentiment_label', 
      width: '15%',
      sorter: (a, b) => (a.sentiment_score ?? -Infinity) - (b.sentiment_score ?? -Infinity),
      sortDirections: ['descend', 'ascend'],
      render: (label) => { 
        const sentimentClassMap = {
          'Very Positive': 'sentiment-tag-very-positive',
          'Positive': 'sentiment-tag-positive',
          'Neutral': 'sentiment-tag-neutral',
          'Negative': 'sentiment-tag-negative',
          'Very Negative': 'sentiment-tag-very-negative'
        };
        const sentimentClass = sentimentClassMap[label] || 'sentiment-tag-neutral'; // Default to neutral
        return <Tag className={sentimentClass}>{label || 'N/A'}</Tag>;
      },
      filters: sentimentFilters,
      onFilter: (value, record) => record.sentiment_label === value,
    },
    { 
      title: 'Feedback', 
      dataIndex: 'feedback', 
      key: 'feedback', 
      width: '40%',
      render: (text) => <div style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</div> 
    },
  ];

  const overviewTaskAnalysisColumns = [
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
      sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
      sortDirections: ['descend', 'ascend']
    },
    {
      title: 'Builder',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text, record) => (
        record.user_id ? (
          <Link to={`/builders/${record.user_id}`}>{text || 'Unknown'}</Link>
        ) : ( text || 'Unknown' )
      ),
       sorter: (a, b) => (a.user_name || '').localeCompare(b.user_name || ''),
       filters: builderFilters,
       onFilter: (value, record) => (record.user_name || '').indexOf(value) === 0,
    },
    { 
      title: 'Task Title', 
      dataIndex: 'task_title', 
      key: 'task_title',
      filters: taskTitleFilters,
      onFilter: (value, record) => (record.task_title || '').indexOf(value) === 0,
    },
    { 
      title: 'Type', 
      dataIndex: 'learning_type', 
      key: 'learning_type',
      filters: learningTypeFilters,
      onFilter: (value, record) => record.learning_type === value,
    },
    { 
      title: 'Grade', 
      key: 'grade', 
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        if (!analysis) return '-'; 
        const score = analysis.completion_score;
        const grade = getLetterGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>; 
      },
      filters: gradeFilters,
      onFilter: (value, record) => {
        const analysis = parseAnalysis(record.analysis);
        if (!analysis) return false;
        const score = analysis.completion_score;
        return getLetterGrade(score) === value;
      },
    },
     {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          size="small" 
          onClick={() => navigate(`/submission/${record.auto_id}`)} 
          disabled={!record.auto_id}
        >
          View Details
        </Button>
      ),
    },
  ];

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
      <Card style={{ marginBottom: '24px', borderRadius: '8px' }}>
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
          <Row gutter={[24, 24]}>
            {/* Prompt Trend Chart */}
            <Col xs={24} md={12} lg={12}>
              <div style={{ ...chartContainer, height: '300px', borderRadius: '8px' }}>
                {promptTrendData ? (
                  <Line 
                    options={promptTrendChartOptions} 
                    data={promptTrendData}
                    key={`prompt-line-${trendDateRange[0].format('YYYYMMDD')}-${trendDateRange[1].format('YYYYMMDD')}`}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No prompt data</div>
                )}
              </div>
            </Col>
            {/* Peer Feedback Sentiment Chart */}
            <Col xs={24} md={12} lg={12}>
               <div style={{ ...chartContainer, height: '300px', borderRadius: '8px' }}>
                {peerFeedbackTrendData && peerFeedbackTrendData.labels.length > 0 ? (
                  <Bar
                    ref={peerFeedbackChartRef}
                    options={sentimentBarOptions('Peer Feedback Sentiment Distribution', handlePeerFeedbackChartClick)}
                    data={peerFeedbackTrendData}
                    key={`peer-bar-${trendDateRange[0].format('YYYYMMDD')}-${trendDateRange[1].format('YYYYMMDD')}`}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No peer feedback data</div>
                )}
              </div>
            </Col>
            
            {/* Work Product Grade Pie Chart */}
            <Col xs={24} md={12} lg={6}>
              <div style={{ ...chartContainer, height: '200px', borderRadius: '8px' }}>
                {workProductGradeDistData && workProductGradeDistData.labels && workProductGradeDistData.labels.length > 0 ? (
                  <Pie 
                    options={pieChartOptions('Work Product Grades')} 
                    data={processGradeDistributionForPieChart(
                      // Pass the original API data, not the processed bar chart data
                      workProductGradeDistData._apiData || []
                    )}
                    key={`wp-pie-${trendDateRange[0].format('YYYYMMDD')}-${trendDateRange[1].format('YYYYMMDD')}`}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '70px', color: '#888' }}>No Work Product grade data</div>
                )}
              </div>
            </Col>
            {/* Comprehension Grade Pie Chart */}
            <Col xs={24} md={12} lg={6}>
              <div style={{ ...chartContainer, height: '200px', borderRadius: '8px' }}>
                {comprehensionGradeDistData && comprehensionGradeDistData.labels && comprehensionGradeDistData.labels.length > 0 ? (
                  <Pie 
                    options={pieChartOptions('Comprehension Grades')} 
                    data={processGradeDistributionForPieChart(
                      // Pass the original API data, not the processed bar chart data
                      comprehensionGradeDistData._apiData || []
                    )}
                    key={`comp-pie-${trendDateRange[0].format('YYYYMMDD')}-${trendDateRange[1].format('YYYYMMDD')}`}
                  />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '70px', color: '#888' }}>No Comprehension grade data</div>
                )}
              </div>
            </Col>
          </Row>
        )}
      </Card>

      {/* NEW Peer Feedback Table Section */}
      <Card style={{ marginBottom: '24px', borderRadius: '8px' }} title={<Title level={4} style={{ margin: 0 }}>Peer Feedback Details</Title>}>
         {peerFeedbackLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
         {peerFeedbackError && <Alert message="Error loading peer feedback" description={peerFeedbackError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
         {!peerFeedbackLoading && !peerFeedbackError && (
            <Table
              columns={overviewPeerFeedbackColumns}
              dataSource={allPeerFeedbackData}
              rowKey={(record, index) => record.feedback_id ?? `pf-${index}`}
              pagination={{ pageSize: 10, position: ['bottomCenter'] }}
              scroll={{ y: 400 }}
              style={{ borderRadius: '8px' }}
            />
         )}
      </Card>

      {/* NEW Task Analysis Table Section */}
       <Card style={{ marginBottom: '24px', borderRadius: '8px' }} title={<Title level={4} style={{ margin: 0 }}>Task Analysis</Title>}>
         {taskAnalysisLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
         {taskAnalysisError && <Alert message="Error loading task analysis" description={taskAnalysisError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
         {!taskAnalysisLoading && !taskAnalysisError && (
            <Table
              columns={overviewTaskAnalysisColumns}
              dataSource={allTaskAnalysisData}
              rowKey={(record, index) => record.auto_id ?? `ta-${index}`}
              pagination={{ pageSize: 10, position: ['bottomCenter'] }}
              scroll={{ x: 'max-content', y: 400 }}
              style={{ borderRadius: '8px' }}
            />
         )}
      </Card>

      {/* Feedback Details Modal */}
      <Modal
        title={`Peer Feedback Details - ${selectedFeedbackCategory} on ${selectedFeedbackDate}`}
        open={feedbackModalVisible}
        onCancel={() => setFeedbackModalVisible(false)}
        footer={null} 
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
    </div>
  );
};

export default PilotOverview;
