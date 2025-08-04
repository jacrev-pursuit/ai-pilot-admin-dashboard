import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Row, Col, DatePicker, Spin, Alert, Typography, Modal, List, Space, Tag, Table, Button, Select, Divider } from 'antd';
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
  fetchTaskGradeDistribution,
  fetchVideoAnalyses
} from '../services/builderService';
import { parseAnalysis } from '../utils/parsingUtils'; // Import the utility function
import { LinkOutlined } from '@ant-design/icons';

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
    dayjs('2025-03-15'),
    dayjs(),
  ]);
  const [selectedLevel, setSelectedLevel] = useState('March 2025 - L2'); // Level filter state - default to March 2025 L2
  const [availableLevels, setAvailableLevels] = useState([]); // Available levels
  const [levelsLoading, setLevelsLoading] = useState(false);
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

  // Add video analysis modal state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);

  // Fetch available levels on component mount
  useEffect(() => {
    const fetchLevels = async () => {
      setLevelsLoading(true);
      try {
        const levels = await fetchData('levels', {});
        setAvailableLevels(levels);
      } catch (error) {
        console.error("Failed to fetch available levels:", error);
      } finally {
        setLevelsLoading(false);
      }
    };

    fetchLevels();
  }, []);

  // Auto-set date ranges when specific cohort-level combinations are selected
  useEffect(() => {
    if (selectedLevel === 'March 2025 - L1') {
      // Set date range to 3/15 - 5/9 for L1
      setTrendDateRange([
        dayjs('2025-03-15'),
        dayjs('2025-05-09')
      ]);
    } else if (selectedLevel === 'March 2025 - L2') {
      // Set date range to 3/15 - current date for L2
      setTrendDateRange([
        dayjs('2025-03-15'),
        dayjs()
      ]);
    }
    // If selectedLevel is null or other values, don't change the date range
    // This allows users to manually change dates without interference
  }, [selectedLevel]);

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
        // Build params with level filter if selected
        const params = { startDate, endDate };
        if (selectedLevel) {
          params.level = selectedLevel;
        }

        // Fetch prompts data
        const promptsResponse = await fetchData('trends/prompts', params);
        if (!promptsResponse) throw new Error('No data returned from prompts fetch');

        // Fetch peer feedback sentiment data
        const peerFeedbackResponse = await fetchData('trends/peer-feedback', params);
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
  }, [trendDateRange, selectedLevel]);

  // Fetch data for NEW tables (separate useEffect)
  useEffect(() => {
    const fetchTableData = async () => {
      if (!trendDateRange || trendDateRange.length !== 2) return;

      const startDate = trendDateRange[0].format('YYYY-MM-DD');
      const endDate = trendDateRange[1].format('YYYY-MM-DD');

      // Build params with level filter if selected
      const params = { startDate, endDate };
      if (selectedLevel) {
        params.level = selectedLevel;
      }

      // Fetch All Peer Feedback
      setPeerFeedbackLoading(true);
      setPeerFeedbackError(null);
      try {
        const feedbackData = await fetchData('feedback/all', params);
        setAllPeerFeedbackData(feedbackData);
      } catch (err) {
        console.error("Failed to fetch all peer feedback:", err);
        setPeerFeedbackError(err.message);
      } finally {
        setPeerFeedbackLoading(false);
      }

      // Fetch All Task Analysis and Video Analyses
      setTaskAnalysisLoading(true);
      setTaskAnalysisError(null);
      try {
        // Fetch task analysis data
        const analysisData = await fetchData('analysis/all', params);
        
        // Fetch video analyses
        const videoData = await fetchVideoAnalyses(startDate, endDate, null, selectedLevel);
        
        // Process video data to match the format of task analysis data
        const processedVideoData = videoData.map(video => {
          // Calculate average score (out of 100)
          const scores = [
            video.technical_score || 0,
            video.business_score || 0,
            video.professional_skills_score || 0
          ];
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          
          // Get overall explanations from each rationale
          let technicalExplanation = '';
          let businessExplanation = '';
          let professionalExplanation = '';
          
          try {
            if (video.technical_score_rationale) {
              const technicalJson = JSON.parse(video.technical_score_rationale);
              technicalExplanation = technicalJson.overall_explanation || '';
            }
          } catch (e) {
            console.error('Error parsing technical rationale:', e);
          }
          
          try {
            if (video.business_score_rationale) {
              const businessJson = JSON.parse(video.business_score_rationale);
              businessExplanation = businessJson.overall_explanation || '';
            }
          } catch (e) {
            console.error('Error parsing business rationale:', e);
          }
          
          try {
            if (video.professional_skills_score_rationale) {
              const professionalJson = JSON.parse(video.professional_skills_score_rationale);
              professionalExplanation = professionalJson.overall_explanation || '';
            }
          } catch (e) {
            console.error('Error parsing professional rationale:', e);
          }
          
          // Create an analysis object to match the task analysis format
          const analysisObj = {
            completion_score: (avgScore / 5) * 100, // Convert score out of 5 to percentage
            feedback: `Technical: ${technicalExplanation}\n\nBusiness: ${businessExplanation}\n\nProfessional: ${professionalExplanation}`,
          };
          
          return {
            auto_id: `video-${video.video_id}`, // Create a unique ID with prefix
            task_title: 'Video Demo Analysis',
            learning_type: 'Work product',
            user_name: video.user_name || 'Unknown',
            user_id: video.user_id,
            date: video.submission_date || new Date().toISOString(),
            analysis: JSON.stringify(analysisObj),
            isVideoAnalysis: true, // Flag to identify as video analysis
            videoData: video // Store original video data
          };
        });
        
        // Combine task analysis data with processed video data
        setAllTaskAnalysisData([...analysisData, ...processedVideoData]);
      } catch (err) {
        console.error("Failed to fetch all task analysis or video analysis:", err);
        setTaskAnalysisError(err.message);
      } finally {
        setTaskAnalysisLoading(false);
      }
    };

    fetchTableData();
  }, [trendDateRange, selectedLevel]);

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

      // Build params with level filter if selected
      const baseParams = { startDate, endDate };
      if (selectedLevel) {
        baseParams.level = selectedLevel;
      }

      try {
        // Fetch Work Product Grades using the correct endpoint
        const wpParams = { ...baseParams, learningType: 'Work product' };
        const wpResponse = await fetchData('overview/grade-distribution', wpParams);
        if (!wpResponse) throw new Error('No data returned for Work Product grade distribution');
        const wpProcessedData = processGradeDistributionData(wpResponse);
        // Store the original API data for the pie chart
        wpProcessedData._apiData = wpResponse;
        setWorkProductGradeDistData(wpProcessedData);

        // Fetch Comprehension Grades using the correct endpoint
        const compParams = { ...baseParams, learningType: 'Key concept' };
        const compResponse = await fetchData('overview/grade-distribution', compParams);
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
  }, [trendDateRange, selectedLevel]);

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
        color: chartColors.text
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
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setFeedbackDetails([]); // Clear previous details

    try {
      // Build params with level filter if selected
      const params = { date: dateForAPI, category: clickedCategory };
      if (selectedLevel) {
        params.level = selectedLevel;
      }
      
      const response = await fetchData('feedback/details', params);
      if (!response) throw new Error('No data returned from feedback details fetch');
      setFeedbackDetails(response);
    } catch (error) {
      console.error("Failed to fetch feedback details:", error);
      setFeedbackDetailsError(error.message);
    } finally {
      setFeedbackDetailsLoading(false);
    }
  };

  // Add video analysis modal handler
  const handleViewVideoDetails = (record) => {
    setSelectedVideo(record.videoData);
    setVideoModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add parseRationale function for video analysis modal
  const parseRationale = (jsonString) => {
    if (!jsonString) return { formattedText: 'No rationale provided.' };
    
    try {
      // Try to parse the JSON
      const parsed = JSON.parse(jsonString);
      
      // Create a structured output
      const sections = [];
      
      // Add overall explanation
      if (parsed.overall_explanation) {
        sections.push(
          <div key="explanation">
            <Text strong style={{ color: 'var(--color-text-main)' }}>Overall Assessment:</Text>
            <Paragraph style={{ color: 'var(--color-text-main)', marginLeft: '10px' }}>{parsed.overall_explanation}</Paragraph>
          </div>
        );
      }
      
      // Add supporting evidence without the label
      if (parsed.overall_supporting_evidence) {
        sections.push(
          <div key="evidence">
            <Paragraph style={{ color: 'var(--color-text-main)', marginLeft: '10px' }}>{parsed.overall_supporting_evidence}</Paragraph>
          </div>
        );
      }
      
      // Add subcriteria if available
      if (parsed.sub_criteria && typeof parsed.sub_criteria === 'object') {
        const criteriaList = [];
        
        Object.entries(parsed.sub_criteria).forEach(([key, value], index) => {
          if (value && typeof value === 'object' && value.score !== undefined) {
            criteriaList.push(
              <div key={`criteria-${index}`} style={{ marginBottom: '8px' }}>
                <Text style={{ color: 'var(--color-text-main)' }}>
                  <Text strong>{key}:</Text> {value.explanation}
                </Text>
                <div style={{ marginLeft: '10px' }}>
                  <Text type="secondary" style={{ color: '#cccccc' }}>Score: {value.score}/5</Text>
                  {value.supporting_evidence && (
                    <div>
                      <Text type="secondary" style={{ color: '#cccccc', fontSize: '12px' }}>{value.supporting_evidence}</Text>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        });
        
        if (criteriaList.length > 0) {
          sections.push(
            <div key="subcriteria">
              <Divider style={{ margin: '10px 0', borderColor: '#555555' }} />
              <Text strong style={{ color: 'var(--color-text-main)' }}>Detailed Criteria:</Text>
              <div style={{ marginTop: '8px', marginLeft: '10px' }}>{criteriaList}</div>
            </div>
          );
        }
      }
      
      // If we successfully parsed but didn't find expected fields
      if (sections.length === 0) {
        return { 
          formattedText: null,
          rawJson: parsed
        };
      }
      
      return { 
        formattedContent: <div>{sections}</div>,
        parsed: parsed
      };
    } catch (e) {
      console.error("Failed to parse rationale JSON:", e);
      return { formattedText: jsonString };
    }
  };

  // Convert numerical score to letter grade for video analysis
  const getScoreGrade = (score) => {
    if (score >= 4.5) return 'A+';
    if (score >= 4.0) return 'A';
    if (score >= 3.5) return 'A-';
    if (score >= 3.0) return 'B+';
    if (score >= 2.5) return 'B';
    if (score >= 2.0) return 'B-';
    if (score >= 1.5) return 'C+';
    if (score >= 1.0) return 'C';
    return 'F';
  };

  // Helper function to calculate overall grade distribution for all tasks in date range
  const calculateOverallGradeDistribution = (taskAnalysisData) => {
    if (!taskAnalysisData || taskAnalysisData.length === 0) return {};
    
    const gradeCount = {};
    
    taskAnalysisData.forEach(item => {
      try {
        let completionScore = null;
        
        if (item.analysis) {
          const analysisObj = typeof item.analysis === 'string' ? JSON.parse(item.analysis) : item.analysis;
          completionScore = analysisObj.completion_score;
        }
        
        if (completionScore !== null && completionScore !== undefined && completionScore !== 0) {
          const grade = getLetterGrade(completionScore);
          gradeCount[grade] = (gradeCount[grade] || 0) + 1;
        }
      } catch (error) {
        console.error('Error parsing analysis for grade calculation:', error);
      }
    });
    
    return gradeCount;
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
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
      sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
      sortDirections: ['descend', 'ascend']
    },
    { 
      title: 'Grade', 
      key: 'grade', 
      render: (_, record) => { 
        // For video analysis entries
        if (record.isVideoAnalysis && record.videoData) {
          const video = record.videoData;
          const scores = [
            video.technical_score || 0,
            video.business_score || 0,
            video.professional_skills_score || 0
          ];
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          const grade = getLetterGrade((avgScore / 5) * 100);
          return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
        }
        
        // For regular task analysis entries
        const analysis = parseAnalysis(record.analysis);
        if (!analysis) return '-'; 
        const score = analysis.completion_score;
        const grade = getLetterGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>; 
      },
      filters: gradeFilters,
      onFilter: (value, record) => {
        if (record.isVideoAnalysis && record.videoData) {
          const video = record.videoData;
          const scores = [
            video.technical_score || 0,
            video.business_score || 0,
            video.professional_skills_score || 0
          ];
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          return getLetterGrade((avgScore / 5) * 100) === value;
        }
        
        const analysis = parseAnalysis(record.analysis);
        if (!analysis) return false;
        const score = analysis.completion_score;
        return getLetterGrade(score) === value;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        // For video analysis entries, open video details modal
        if (record.isVideoAnalysis) {
          return (
            <Button 
              size="small" 
              onClick={() => handleViewVideoDetails(record)}
              disabled={!record.videoData}
            >
              View Details
            </Button>
          );
        }
        
        // For regular task analysis entries
        return (
          <Button 
            size="small" 
            onClick={() => {
              // Check if this is a fake auto_id for video analysis (defensive check)
              if (record.auto_id.startsWith('video-')) {
                const videoId = record.auto_id.replace('video-', '');
                navigate(`/video-analysis/${videoId}`);
              } else {
                navigate(`/submission/${record.auto_id}`);
              }
            }} 
            disabled={!record.auto_id}
          >
            View Details
          </Button>
        );
      },
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Select
              placeholder="Cohort + Level"
              value={selectedLevel}
              onChange={setSelectedLevel}
              allowClear
              style={{ minWidth: '240px' }}
              loading={levelsLoading}
            >
              {availableLevels.map(level => (
                <Select.Option key={level} value={level}>
                  {level}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              value={trendDateRange}
              onChange={setTrendDateRange}
              allowClear={false}
            />
          </div>
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
                    options={pieChartOptions('Work Product Grade Distribution')} 
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
                    options={pieChartOptions('Comprehension Grade Distribution')} 
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

      {/* NEW Task Analysis Table Section - MOVED TO BEFORE FEEDBACK */}
       <Card 
         style={{ marginBottom: '24px', borderRadius: '8px' }} 
         title={
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
             <Title level={4} style={{ margin: 0 }}>Task Analysis</Title>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
               {(() => {
                 const gradeDistribution = calculateOverallGradeDistribution(allTaskAnalysisData);
                 const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];
                 
                 return gradeOrder.map(grade => {
                   const count = gradeDistribution[grade] || 0;
                   if (count === 0) return null;
                   
                   return (
                     <Tag 
                       key={grade} 
                       className={getGradeTagClass(grade)}
                       style={{ margin: 0, fontSize: '12px' }}
                     >
                       {grade}: {count}
                     </Tag>
                   );
                 }).filter(Boolean);
               })()}
             </div>
           </div>
         }
       >
         {taskAnalysisLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
         {taskAnalysisError && <Alert message="Error loading task analysis" description={taskAnalysisError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
         {!taskAnalysisLoading && !taskAnalysisError && (
            <Table
              columns={overviewTaskAnalysisColumns}
              dataSource={allTaskAnalysisData}
              rowKey={(record) => record.auto_id ?? record.id ?? `ta-${record.user_id}-${record.date}`}
              pagination={{ 
                pageSize: 10, 
                showSizeChanger: false,
                showQuickJumper: false,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                size: 'default',
                showLessItems: false
              }}
              scroll={{ x: 'max-content', y: 400 }}
              style={{ borderRadius: '8px' }}
            />
         )}
      </Card>

      {/* NEW Peer Feedback Table Section - MOVED TO AFTER TASKS */}
      <Card style={{ marginBottom: '24px', borderRadius: '8px' }} title={<Title level={4} style={{ margin: 0 }}>Peer Feedback Details</Title>}>
         {peerFeedbackLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
         {peerFeedbackError && <Alert message="Error loading peer feedback" description={peerFeedbackError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
         {!peerFeedbackLoading && !peerFeedbackError && (
            <Table
              columns={overviewPeerFeedbackColumns}
              dataSource={allPeerFeedbackData}
              rowKey={(record) => record.feedback_id ?? record.id ?? `pf-${record.user_id}-${record.date}`}
              pagination={{ 
                pageSize: 10, 
                showSizeChanger: false,
                showQuickJumper: false,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                size: 'default',
                showLessItems: false
              }}
              scroll={{ y: 400 }}
              style={{ borderRadius: '8px' }}
            />
         )}
      </Card>

      {/* Feedback Details Modal */}
      <Modal
        title={<span style={{ color: "var(--color-text-main)" }}>{`Peer Feedback Details - ${selectedFeedbackCategory} on ${selectedFeedbackDate}`}</span>}
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
                       <Text style={{ color: "var(--color-text-main)" }}>From: <Text strong style={{ color: "var(--color-text-main)" }}>{item.reviewer_name || 'Anonymous'}</Text></Text>
                       <Text style={{ color: "var(--color-text-main)" }}>To: <Text strong style={{ color: "var(--color-text-main)" }}>{item.recipient_name || 'Unknown'}</Text></Text>
                       {item.sentiment_category && (
                         (() => {
                           const sentimentClassMap = {
                             'Very Positive': 'sentiment-tag-very-positive',
                             'Positive': 'sentiment-tag-positive',
                             'Neutral': 'sentiment-tag-neutral',
                             'Negative': 'sentiment-tag-negative',
                             'Very Negative': 'sentiment-tag-very-negative'
                           };
                           const sentimentClass = sentimentClassMap[item.sentiment_category] || 'sentiment-tag-neutral';
                           return (
                             <Tag className={sentimentClass}>
                               {item.sentiment_category}
                             </Tag>
                           );
                         })()
                       )}
                    </Space>
                  }
                  description={<div style={{ color: "var(--color-text-main)", whiteSpace: "pre-wrap" }}>{item.feedback_text}</div>}
                />
                <Text style={{ color: "var(--color-text-secondary)" }}>{dayjs(item.created_at?.value || item.created_at).format('MMMM D')}</Text>
              </List.Item>
            )}
          />
        ) : (
          <Text style={{ color: "var(--color-text-main)" }}>No specific feedback found for this category on this day.</Text>
        )}
      </Modal>

      {/* Video Analysis Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: "var(--color-text-main)" }}>Video Analysis Details</span>
            {selectedVideo && selectedVideo.loom_url && (
              <a 
                href={selectedVideo.loom_url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: "#1890ff", fontSize: '14px', fontWeight: 'normal' }}
              >
                <LinkOutlined /> Open Video Demo
              </a>
            )}
          </div>
        }
        open={videoModalVisible}
        onCancel={() => setVideoModalVisible(false)}
        footer={null}
        width={1200}
      >
        {selectedVideo && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Technical</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.technical_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.technical_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.technical_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.technical_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Business</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.business_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.business_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.business_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.business_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Professional Skills</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.professional_skills_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.professional_skills_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.professional_skills_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.professional_skills_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
            </Row>
            
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Text style={{ color: "var(--color-text-main)", fontSize: '16px' }}>
                Overall Average: 
              </Text>
              <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.average_score))} style={{ fontSize: '18px', padding: '5px 15px', marginLeft: '10px' }}>
                {getScoreGrade(selectedVideo.average_score)}
              </Tag>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default PilotOverview;
