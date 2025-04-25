import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Typography, DatePicker, Table, Tabs, Spin, message, Button, Select, Space, Row, Col, Tag, Modal } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import { Line, getElementAtEvent } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle, // Renamed to avoid conflict with Typography.Title
  Tooltip,
  Legend,
  Filler, // Import Filler plugin
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation'; // Import the plugin
import { baseChartOptions, chartContainer, chartColors } from './ChartStyles';
import { Bar } from 'react-chartjs-2';
// Import the correct grading utils
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils';

// Add/Update CSS for highlighting - More specific selector
const styleSheet = document.styleSheets[0];
// Remove previous rule if it exists to avoid duplicates
try {
  for (let i = styleSheet.cssRules.length - 1; i >= 0; i--) {
    if (styleSheet.cssRules[i].selectorText === '.ant-table-row.highlighted-row > td') {
      styleSheet.deleteRule(i);
      break;
    }
  }
} catch (e) {
  console.warn("Could not remove previous highlight CSS rule:", e);
}
// Insert the new, more specific rule
styleSheet.insertRule(`
  .ant-table-row.highlighted-row > td {
    background-color: #fff1b8 !important; /* Slightly darker yellow */
    transition: background-color 0.3s ease-in-out !important;
  }
`, styleSheet.cssRules.length);

// Register Chart.js components AND the plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  annotationPlugin, // Register the annotation plugin
  Filler // Register the Filler plugin
);

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

// Add parseAnalysis helper function here (needed for WP/Comp processing)
const parseAnalysis = (analysisString) => {
  if (!analysisString || typeof analysisString !== 'string') return null;
  try {
    return JSON.parse(analysisString);
  } catch (error) {
    // console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    return null;
  }
};

// Helper function to map score to a sentiment label
const mapScoreToLabel = (score) => {
  if (score === null || score === undefined) return 'N/A';
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'N/A';

  if (numScore >= 0.6) return 'Very Positive';
  if (numScore >= 0.2) return 'Positive';
  if (numScore > -0.2) return 'Neutral';
  if (numScore >= -0.6) return 'Negative';
  return 'Very Negative';
};

// Helper function to map score to just a color name for Ant Design Tags
const mapScoreToColor = (score) => {
  if (score === null || score === undefined) return 'default'; // Default Antd color

  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'default'; // Default Antd color

  // Use Ant Design Tag color names
  if (numScore >= 0.6) return 'green'; // Very Positive
  if (numScore >= 0.2) return 'cyan';  // Positive
  if (numScore > -0.2) return 'default'; // Neutral
  if (numScore >= -0.6) return 'orange';// Negative
  return 'red';   // Very Negative
};

// --- Data Processing Functions for Charts ---

// Updated function to handle different data structures
const processScoreBasedLineChartData = (data, dateField, valueField, keyField, label, startDate, endDate, dataType) => {
  if (!startDate || !endDate) {
    return { labels: [], datasets: [] }; // Need date range
  }

  const allDates = [];
  let currentDate = dayjs(startDate);
  const finalEndDate = dayjs(endDate);
  while (currentDate.isBefore(finalEndDate) || currentDate.isSame(finalEndDate, 'day')) {
    allDates.push(currentDate);
    currentDate = currentDate.add(1, 'day');
  }

  const dataMap = new Map();
  if (data) {
    data.forEach(item => {
      const itemDateStr = dayjs(item[dateField]?.value || item[dateField]).format('MM-DD');
      // Allow multiple items per date (e.g., multiple WP tasks on one day)
      if (!dataMap.has(itemDateStr)) {
          dataMap.set(itemDateStr, []);
      }
      dataMap.get(itemDateStr).push(item);
    });
  }

  const labels = allDates.map(date => date.format('MM-DD'));
  const values = [];
  const pointColors = [];
  const keys = [];

  labels.forEach(labelDateStr => {
    const itemsForDate = dataMap.get(labelDateStr);
    if (itemsForDate && itemsForDate.length > 0) {
      // For WP/Comp, potentially average scores if multiple on one day
      let score = null;
      let key = null;
      if (dataType === 'workProduct' || dataType === 'comprehension') {
          let totalScore = 0;
          let count = 0;
          let firstKey = null; // Use the key of the first item for click handling
          itemsForDate.forEach((item, index) => {
              const analysis = parseAnalysis(item.analysis); // Parse analysis here
              const itemScore = analysis?.completion_score;
              if (itemScore !== null && itemScore !== undefined) {
                  totalScore += itemScore;
                  count++;
                  if (index === 0) firstKey = item[keyField]; // Capture first key
              }
          });
          score = count > 0 ? totalScore / count : null;
          key = firstKey; // Use the key of the first task for the day
      } else { // For Sentiment/Peer Feedback, assume only one relevant value per day
          score = itemsForDate[0][valueField];
          key = itemsForDate[0][keyField];
      }

      values.push(score);
      pointColors.push(mapScoreToColor(score)); // Use the potentially averaged score for color
      keys.push(key); // Use the determined key

    } else {
      values.push(null);
      pointColors.push('rgba(0,0,0,0.1)');
      keys.push(null);
    }
  });

  return {
    labels,
    datasets: [
      {
        label: label,
        data: values,
        borderColor: '#000000', 
        backgroundColor: 'rgba(0, 0, 0, 0.1)', 
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors.map(color => {
          if (typeof color === 'string') {
            if (color.includes('rgba') && color.includes('0.6')) { 
              return color.replace('0.6', '1'); 
            }
            return color; 
          }
          return chartColors.borderColor || '#000000';
        }),
        pointBorderWidth: 2,
        pointRadius: 3, 
        pointHoverRadius: 10, 
        fill: true,
        tension: 0.1,
        segment: {
          borderColor: ctx => ctx.p0.raw === null || ctx.p1.raw === null ? 'transparent' : undefined,
        }
      }
    ],
    keys 
  };
};

// Function for processing prompt counts over time, now includes all dates in range
const processPromptCountData = (data, startDate, endDate) => {
  if (!startDate || !endDate) {
    return { labels: [], datasets: [] };
  }

  // 1. Generate all dates in the range
  const allDates = [];
  let currentDate = dayjs(startDate);
  const finalEndDate = dayjs(endDate);
  while (currentDate.isBefore(finalEndDate) || currentDate.isSame(finalEndDate, 'day')) {
    allDates.push(currentDate);
    currentDate = currentDate.add(1, 'day');
  }

  // 2. Create a map of the fetched data for quick lookup (using MM-DD format)
  const dataMap = new Map();
  if (data) {
    data.forEach(item => {
      const itemDateStr = dayjs(item.date?.value || item.date).format('MM-DD');
      dataMap.set(itemDateStr, item.prompt_count);
    });
  }

  // 3. Generate labels and map data
  const labels = allDates.map(date => date.format('MM-DD'));
  const values = labels.map(labelDateStr => {
    return dataMap.get(labelDateStr) || 0; // Use 0 for dates with no prompts
  });

  return {
    labels,
    datasets: [
      {
        label: 'Prompts Sent',
        data: values,
        borderColor: '#000000',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        tension: 0.1,
        fill: false, // This might be irrelevant for Bar chart, but keep for consistency if type changes
      },
    ],
  };
};

// --- Chart Components ---

const SentimentChart = ({ data, onPointClick, highlightedRowKey, highlightedRowType, onPointHover, hoveredPointIndex, hoveredChartType, dateRange }) => {
  const chartRef = React.useRef();
  // Pass dataType to processor
  const { labels, datasets: originalDatasets, keys } = processScoreBasedLineChartData(
      data, 'date', 'sentiment_score', 'date', 'Daily Sentiment Score', dateRange[0], dateRange[1], 'sentiment' 
  );

  // Calculate highlighted index
  let highlightedIndex = -1;
  if (highlightedRowType === 'sentiment' && highlightedRowKey) {
    // For date keys, need to compare the primitive value
    const keyToFind = highlightedRowKey?.value || highlightedRowKey?.toString();
    highlightedIndex = keys.findIndex(key => (key?.value || key?.toString()) === keyToFind);
  }

  // Generate dynamic point styles based on hover AND highlight
  const pointRadius = labels.map((_, index) => {
    if (index === highlightedIndex) return 8; // Highlighted takes precedence
    if (index === hoveredPointIndex && hoveredChartType === 'sentiment') return 10; // Hovered (Set to 10)
    return 3; // Default
  });
  const pointBorderWidth = labels.map((_, index) => {
    if (index === highlightedIndex) return 3;
    return 1; // Default border width
  });
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    return '#000000'; // Default border color
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'sentiment') return '#bbdefb'; // Hover fill (light blue)
    return 'rgba(0, 0, 0, 0.1)'; // Default
  });

  // Create the final dataset with dynamic styles
  const datasets = originalDatasets.map(dataset => ({
    ...dataset,
    pointRadius,
    pointBorderWidth,
    pointBorderColor,
    pointBackgroundColor,
    hoverRadius: pointRadius, // Use pointRadius (no change on hover)
    hoverBorderWidth: pointBorderWidth, // Use pointBorderWidth (no change on hover)
    hoverBorderColor: pointBorderColor, // Use pointBorderColor (no change on hover)
    hoverBackgroundColor: pointBackgroundColor // Use dynamic background color
  }));

  const chartData = { labels, datasets };

  const handleChartClick = (event) => {
      const elements = getElementAtEvent(chartRef.current, event);
      if (elements.length > 0) {
          const firstElement = elements[0];
          const index = firstElement.index;
          const key = keys[index];
          if (key && onPointClick) {
              onPointClick(key, 'sentiment');
              event.stopPropagation(); // Prevent click from bubbling up
          }
      }
  };

  const options = { 
    ...baseChartOptions, 
    scales: {
        ...baseChartOptions.scales,
        y: {
            ...baseChartOptions.scales.y,
            min: -1.1,
            max: 1.1
        }
    },
    plugins: { 
      ...baseChartOptions.plugins, 
      title: { display: true, text: 'Daily Sentiment Score Over Time', color: chartColors.text },
      legend: { display: false },
      tooltip: {
        enabled: false // Disable tooltip
      },
      annotation: {
        annotations: {
          veryPositive: {
            type: 'box',
            yMin: 0.8,
            yMax: 1.1, 
            backgroundColor: chartColors.veryPositiveBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          positive: {
            type: 'box',
            yMin: 0.4,
            yMax: 0.8,
            backgroundColor: chartColors.positiveBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          neutral: {
            type: 'box',
            yMin: -0.2,
            yMax: 0.4,
            backgroundColor: chartColors.neutralBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          negative: {
            type: 'box',
            yMin: -0.6,
            yMax: -0.2,
            backgroundColor: chartColors.negativeBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          veryNegative: {
            type: 'box',
            yMin: -1.1, 
            yMax: -0.6,
            backgroundColor: chartColors.veryNegativeBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          }
        }
      },
    },
    onHover: (event, chartElement, chart) => {
      console.log('SentimentChart onHover fired', chartElement); // Added log
      const canvas = chart.canvas;
      if (chartElement.length > 0) {
        canvas.style.cursor = 'pointer';
        onPointHover(chartElement[0].index, 'sentiment');
      } else {
        canvas.style.cursor = 'default';
        onPointHover(null, null);
      }
    }
  };
  return <div style={chartContainer}><Line ref={chartRef} options={options} data={chartData} onClick={handleChartClick} /></div>;
};

const PeerFeedbackChart = ({ data, onPointClick, highlightedRowKey, highlightedRowType, onPointHover, hoveredPointIndex, hoveredChartType, dateRange }) => {
  const chartRef = React.useRef();
  // Pass dataType to processor
  const { labels, datasets: originalDatasets, keys } = processScoreBasedLineChartData(
      data, 'timestamp', 'sentiment_score', 'feedback_id', 'Peer Feedback Sentiment', dateRange[0], dateRange[1], 'peerFeedback' 
  );

  // Calculate highlighted index
  let highlightedIndex = -1;
  if (highlightedRowType === 'peerFeedback' && highlightedRowKey) {
    highlightedIndex = keys.indexOf(highlightedRowKey);
  }

  // Generate dynamic point styles based on hover AND highlight
  const pointRadius = labels.map((_, index) => {
    if (index === highlightedIndex) return 8; // Highlighted takes precedence
    if (index === hoveredPointIndex && hoveredChartType === 'peerFeedback') return 10; // Hovered (Set to 10)
    return 3; // Default
  });
  const pointBorderWidth = labels.map((_, index) => {
    if (index === highlightedIndex) return 3;
    return 1; // Default border width
  });
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    return '#000000'; // Default border color
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'peerFeedback') return '#bbdefb'; // Hover fill (light blue)
    return 'rgba(0, 0, 0, 0.1)'; // Default
  });

  // Create the final dataset with dynamic styles
  const datasets = originalDatasets.map(dataset => ({
    ...dataset,
    pointRadius,
    pointBorderWidth,
    pointBorderColor,
    pointBackgroundColor,
    hoverRadius: pointRadius, // Use pointRadius (no change on hover)
    hoverBorderWidth: pointBorderWidth, // Use pointBorderWidth (no change on hover)
    hoverBorderColor: pointBorderColor, // Use pointBorderColor (no change on hover)
    hoverBackgroundColor: pointBackgroundColor // Use dynamic background color
  }));

  const chartData = { labels, datasets };

  const handleChartClick = (event) => {
      const elements = getElementAtEvent(chartRef.current, event);
      if (elements.length > 0) {
          const firstElement = elements[0];
          const index = firstElement.index;
          const key = keys[index];
          if (key && onPointClick) {
              onPointClick(key, 'peerFeedback');
              event.stopPropagation(); // Prevent click from bubbling up
          }
      }
  };

  const options = { 
    ...baseChartOptions, 
    scales: {
        ...baseChartOptions.scales,
        y: {
            ...baseChartOptions.scales.y,
            min: -1.1,
            max: 1.1
        }
    },
    plugins: { 
      ...baseChartOptions.plugins, 
      title: { display: true, text: 'Peer Feedback Sentiment Over Time', color: chartColors.text },
      legend: { display: false },
      tooltip: {
        enabled: false // Disable tooltip
      },
      annotation: {
        annotations: {
          veryPositive: {
            type: 'box',
            yMin: 0.8,
            yMax: 1.1, 
            backgroundColor: chartColors.veryPositiveBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          positive: {
            type: 'box',
            yMin: 0.4,
            yMax: 0.8,
            backgroundColor: chartColors.positiveBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          neutral: {
            type: 'box',
            yMin: -0.2,
            yMax: 0.4,
            backgroundColor: chartColors.neutralBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          negative: {
            type: 'box',
            yMin: -0.6,
            yMax: -0.2,
            backgroundColor: chartColors.negativeBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          },
          veryNegative: {
            type: 'box',
            yMin: -1.1, 
            yMax: -0.6,
            backgroundColor: chartColors.veryNegativeBg,
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 1
          }
        }
      },
    },
    onHover: (event, chartElement, chart) => {
      console.log('PeerFeedbackChart onHover fired', chartElement); // Added log
      const canvas = chart.canvas;
      if (chartElement.length > 0) {
        canvas.style.cursor = 'pointer';
        onPointHover(chartElement[0].index, 'peerFeedback');
      } else {
        canvas.style.cursor = 'default';
        onPointHover(null, null);
      }
    }
  };
  return <div style={chartContainer}><Line ref={chartRef} options={options} data={chartData} onClick={handleChartClick} /></div>;
};

const WorkProductChart = ({ data, onPointClick, highlightedRowKey, highlightedRowType, onPointHover, hoveredPointIndex, hoveredChartType, dateRange }) => {
  const chartRef = React.useRef();
  // Pass dataType and updated valueField placeholder (logic is inside processor)
  const { labels, datasets: originalDatasets, keys } = processScoreBasedLineChartData(
      data, 'date', null /* valueField not used directly */, 'task_id', 'Work Product Score', dateRange[0], dateRange[1], 'workProduct'
  );

  // Calculate highlighted index
  let highlightedIndex = -1;
  if (highlightedRowType === 'workProduct' && highlightedRowKey) {
    // Ensure comparison uses strings if keys are potentially numbers
    highlightedIndex = keys.findIndex(key => key?.toString() === highlightedRowKey?.toString());
  }

  // Generate dynamic point styles based on hover AND highlight
  const pointRadius = labels.map((_, index) => {
    if (index === highlightedIndex) return 8; // Highlighted takes precedence
    if (index === hoveredPointIndex && hoveredChartType === 'workProduct') return 10; // Hovered (Set to 10)
    return 3; // Default
  });
  const pointBorderWidth = labels.map((_, index) => {
    if (index === highlightedIndex) return 3;
    return 1; // Default border width
  });
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    return '#000000'; // Default border color
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'workProduct') return '#bbdefb'; // Hover fill (light blue)
    return 'rgba(0, 0, 0, 0.1)'; // Default
  });

  // Create the final dataset with dynamic styles
  const datasets = originalDatasets.map(dataset => ({
    ...dataset,
    pointRadius,
    pointBorderWidth,
    pointBorderColor,
    pointBackgroundColor,
    hoverRadius: pointRadius, // Use pointRadius (no change on hover)
    hoverBorderWidth: pointBorderWidth, // Use pointBorderWidth (no change on hover)
    hoverBorderColor: pointBorderColor, // Use pointBorderColor (no change on hover)
    hoverBackgroundColor: pointBackgroundColor // Use dynamic background color
  }));

  const chartData = { labels, datasets };

  const handleChartClick = (event) => {
      const elements = getElementAtEvent(chartRef.current, event);
      if (elements.length > 0) {
          const firstElement = elements[0];
          const index = firstElement.index;
          const key = keys[index];
          if (key && onPointClick) {
              onPointClick(key, 'workProduct');
              event.stopPropagation(); // Prevent click from bubbling up
          }
      }
  };

  const options = { 
    ...baseChartOptions, 
    plugins: { 
        ...baseChartOptions.plugins, 
        title: { display: true, text: 'Work Product Score Over Time', color: chartColors.text },
        legend: { display: false },
        tooltip: {
          enabled: false // Disable tooltip
        }
      },
      onHover: (event, chartElement, chart) => {
        const canvas = chart.canvas;
        if (chartElement.length > 0) {
          canvas.style.cursor = 'pointer';
          onPointHover(chartElement[0].index, 'workProduct');
        } else {
          canvas.style.cursor = 'default';
          onPointHover(null, null);
        }
      }
  };
  return <div style={chartContainer}><Line ref={chartRef} options={options} data={chartData} onClick={handleChartClick} /></div>;
};

const PromptsChart = ({ data, dateRange }) => {
  const chartRef = useRef(null);
  const chartData = processPromptCountData(data, dateRange[0], dateRange[1]);

  // Restore Bar chart options structure
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'category',
        ticks: {
          maxRotation: 90,
          minRotation: 45,
          callback: function(value, index, values) {
            return this.getLabelForValue(value); // Use the label generated by processPromptCountData
          }
        },
        grid: {
          display: false // Keep grid display setting if it was there before
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Prompts'
        },
        grid: {
          color: chartColors.grid // Keep grid color if needed
        }
      }
    },
    plugins: {
      title: { display: true, text: 'Prompts Sent Over Time (Daily)', color: chartColors.text }, // Restore title
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems) {
            // Format the date in the tooltip title to MM-DD
            return dayjs(tooltipItems[0].label, 'MM-DD').format('MM-DD');
          },
          label: function(context) {
            return `Prompts: ${context.parsed.y}`;
          }
        }
      }
    }
  };

  // Change back to Bar chart
  return <div style={chartContainer}><Bar ref={chartRef} options={options} data={chartData} /></div>;
};

const BuilderDetailsPage = () => {
  const { builderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [allBuilders, setAllBuilders] = useState([]);
  const [selectedBuilderId, setSelectedBuilderId] = useState(builderId || null);
  const [selectedBuilderName, setSelectedBuilderName] = useState('');
  
  // Set default date range: 3/15/2025 to today
  const [dateRange, setDateRange] = useState([
    dayjs('2025-03-15'), // Start date
    dayjs() // End date (today)
  ]);
  const [activeTab, setActiveTab] = useState('workProduct');
  
  const [workProductData, setWorkProductData] = useState([]);
  const [comprehensionData, setComprehensionData] = useState([]);
  const [peerFeedbackData, setPeerFeedbackData] = useState([]);
  const [promptsData, setPromptsData] = useState([]);
  const [sentimentData, setSentimentData] = useState([]);

  // Need state for the modal
  const [workProductModalVisible, setWorkProductModalVisible] = useState(false);
  const [selectedWorkProduct, setSelectedWorkProduct] = useState(null);

  const [highlightedRowKey, setHighlightedRowKey] = useState(null);
  const [highlightedRowType, setHighlightedRowType] = useState(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);

  // Chart Refs
  const sentimentChartRef = useRef(null);
  const peerFeedbackChartRef = useRef(null);
  const workProductChartRef = useRef(null);
  // ADD Table Refs
  const sentimentTableRef = useRef(null);
  const peerFeedbackTableRef = useRef(null);
  const workProductTableRef = useRef(null);

  // Updated useMemo calls to pass dataType
  const sentimentChartData = useMemo(() => processScoreBasedLineChartData(
    sentimentData, 'date', 'sentiment_score', 'date', 'Sentiment Score', dateRange[0], dateRange[1], 'sentiment'
  ), [sentimentData, dateRange]);

  const peerFeedbackChartData = useMemo(() => processScoreBasedLineChartData(
    peerFeedbackData, 'timestamp', 'sentiment_score', 'feedback_id', 'Peer Feedback Score', dateRange[0], dateRange[1], 'peerFeedback'
  ), [peerFeedbackData, dateRange]);

  const workProductChartData = useMemo(() => processScoreBasedLineChartData(
    workProductData, 'date', null /* valueField not used directly */, 'task_id', 'Work Product Score', dateRange[0], dateRange[1], 'workProduct'
  ), [workProductData, dateRange]);

  const promptsChartData = useMemo(() => processPromptCountData(
    promptsData, 
    dateRange[0], // Pass start date
    dateRange[1] // Pass end date
  ), [promptsData, dateRange]);

  // --- Data Fetching Logic ---
  const fetchTabData = async (dataType) => {
    if (!selectedBuilderId || !dateRange) return;

    // Determine if data already exists for this type
    let dataExists = false;
    switch (dataType) {
      case 'workProduct': dataExists = workProductData.length > 0; break;
      case 'comprehension': dataExists = comprehensionData.length > 0; break;
      case 'peer_feedback': dataExists = peerFeedbackData.length > 0; break;
      case 'prompts': dataExists = promptsData.length > 0; break;
      case 'sentiment': dataExists = sentimentData.length > 0; break;
      default: return; // Unknown type
    }

    // Don't re-fetch if data already exists for the current builder/date range
    if (dataExists) {
        console.log(`Data for ${dataType} already loaded.`);
        return; 
    }

    console.log(`Fetching data for tab: ${dataType}`);
    setLoading(true); // Show spinner when fetching tab data
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');

    try {
      const data = await fetchBuilderDetails(selectedBuilderId, dataType, startDate, endDate);
      switch (dataType) {
        case 'workProduct': setWorkProductData(data); break;
        case 'comprehension': setComprehensionData(data); break;
        case 'peer_feedback': setPeerFeedbackData(data); break;
        case 'prompts': setPromptsData(data); break; // Assuming you add a prompts tab/table
        case 'sentiment': setSentimentData(data); break;
        default: break;
      }
    } catch (error) {
      message.error(`Failed to load ${dataType} details`);
      console.error(`Error fetching ${dataType} details:`, error);
      // Optionally clear the specific state on error
      // switch (dataType) { ... clear state ... }
    } finally {
      setLoading(false); // Hide spinner after fetch completes or fails
    }
  };

  // Fetch all builders for the filter dropdown
  useEffect(() => {
    const loadAllBuilders = async () => {
      try {
        // Use very broad dates to get all builders initially
        const builders = await fetchBuilderData('2000-01-01', '2100-12-31');
        // Capitalize names
        const formattedBuilders = builders.map(b => ({
            ...b,
            name: b.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
        })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        setAllBuilders(formattedBuilders);
        
        if (selectedBuilderId) {
            const builder = formattedBuilders.find(b => b.user_id.toString() === selectedBuilderId);
            setSelectedBuilderName(builder ? builder.name : 'Unknown Builder');
        } else if (formattedBuilders.length > 0) {
            // Optionally select the first builder if none is specified
            // handleBuilderChange(formattedBuilders[0].user_id.toString()); 
        }
      } catch (error) {
        message.error('Failed to load builder list');
        console.error('Error fetching all builders:', error);
      }
    };
    loadAllBuilders();
  }, []); // Run only once on mount

  // Fetch all data when builder or date range changes
  useEffect(() => {
    const loadAllDataSequentially = async () => {
      if (!selectedBuilderId || !dateRange) return;

      console.log('Builder or Date Range changed. Clearing old data and fetching all data sequentially.');
      setLoading(true);
      // Clear all data first
      setWorkProductData([]); 
      setComprehensionData([]);
      setPeerFeedbackData([]);
      setPromptsData([]);
      setSentimentData([]);
      
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch all data types sequentially
        const wpData = await fetchBuilderDetails(selectedBuilderId, 'workProduct', startDate, endDate).catch(e => { console.error('WP fetch error:', e); return []; });
        setWorkProductData(wpData);

        const compData = await fetchBuilderDetails(selectedBuilderId, 'comprehension', startDate, endDate).catch(e => { console.error('Comp fetch error:', e); return []; });
        setComprehensionData(compData);

        const pfData = await fetchBuilderDetails(selectedBuilderId, 'peer_feedback', startDate, endDate).catch(e => { console.error('PF fetch error:', e); return []; });
        setPeerFeedbackData(pfData);

        const pData = await fetchBuilderDetails(selectedBuilderId, 'prompts', startDate, endDate).catch(e => { console.error('Prompts fetch error:', e); return []; });
        setPromptsData(pData);

        const sentData = await fetchBuilderDetails(selectedBuilderId, 'sentiment', startDate, endDate).catch(e => { console.error('Sent fetch error:', e); return []; });
        setSentimentData(sentData);

      } catch (error) {
        message.error(`Failed to load some builder details`);
        console.error(`Error fetching details sequentially:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadAllDataSequentially();
    // Dependency array remains the same, triggers on builder/date change
  }, [selectedBuilderId, dateRange]); 
  
  // Update selected builder name when ID changes
  useEffect(() => {
      if (selectedBuilderId) {
          const builder = allBuilders.find(b => b.user_id.toString() === selectedBuilderId);
          setSelectedBuilderName(builder ? builder.name : 'Unknown Builder');
          // Update URL if changed via dropdown, not just initial load
          if(builderId !== selectedBuilderId) {
              navigate(`/builders/${selectedBuilderId}`);
          }
      } else {
          setSelectedBuilderName('');
          // Optionally navigate back to base page if builder is deselected
          // navigate('/builder-details');
      }
  }, [selectedBuilderId, allBuilders, navigate, builderId]);

  const handleBuilderChange = (value) => {
    setSelectedBuilderId(value);
     // Clear existing data when builder changes
    setWorkProductData([]); 
    setComprehensionData([]); 
    setPeerFeedbackData([]); 
    setPromptsData([]); // Keep clearing prompts data
    setSentimentData([]); 
  };

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    } else {
      // Handle clear or invalid selection, maybe revert to default?
       setDateRange([dayjs().subtract(30, 'day'), dayjs()]); 
    }
  };
  
  const handleTabChange = (key) => {
    console.log('Tab changed to:', key);
    setActiveTab(key);
    // Fetch data for the new tab if it hasn't been loaded yet
    fetchTabData(key);
  };

  // Function to handle clicks from charts
  const handlePointClick = (key, type) => {
    console.log(`Chart point clicked: Key=${key}, Type=${type}`);
    // console.log(`Current highlighted key (before update): ${highlightedRowKey}`); // Keep logs if needed
    setHighlightedRowKey(key);
    setHighlightedRowType(type);
    // console.log(`New highlighted key (after update): ${key}`); // Keep logs if needed

    // REMOVED SetTimeout
    // setTimeout(() => {
    //   setHighlightedRowKey(null);
    //   setHighlightedRowType(null);
    // }, 3000); 
  };

  // Function to handle hovers from charts
  const handlePointHover = (index, type) => {
    // Log state update attempts
    console.log(`Setting hover state: index=${index}, type=${type}`);
    setHoveredPointIndex(index);
    setHoveredChartType(type);
  };

  // Effect for handling clicks outside interactive elements
  useEffect(() => {
    const handleClickOutside = (event) => { // Receive event object
      // Check if the click is outside ALL chart refs and ALL table refs
      const isOutsideCharts = ![sentimentChartRef, peerFeedbackChartRef, workProductChartRef].some(
        ref => ref.current && ref.current.contains(event.target)
      );
      const isOutsideTables = ![sentimentTableRef, peerFeedbackTableRef, workProductTableRef].some(
        ref => ref.current && ref.current.contains(event.target)
      );

      if (isOutsideCharts && isOutsideTables && (highlightedRowKey !== null || highlightedRowType !== null)) {
        // Reset highlight state only if click is outside both charts and tables
        setHighlightedRowKey(null);
        setHighlightedRowType(null);
        // Also reset chart hover state if needed
        setHoveredPointIndex(null);
        setHoveredChartType(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // Add table refs to dependency array
  }, [highlightedRowKey, highlightedRowType, sentimentChartRef, peerFeedbackChartRef, workProductChartRef, sentimentTableRef, peerFeedbackTableRef, workProductTableRef]);

  // Define columns for each table
  const workProductColumns = [
    { title: 'Task Title', dataIndex: 'task_title', key: 'task_title', width: '25%' }, // Adjusted width
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => d ? dayjs(d?.value || d).format('MMMM D') : 'N/A', // Updated format
      width: '15%' // Adjusted width
    }, 
    { 
      title: 'Feedback', 
      key: 'feedback', 
      width: '35%', // Adjusted width
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        const feedback = analysis?.feedback;
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error') return <Tag color="red">Document Access Error</Tag>;
        if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') return <Tag color="red">Tech issue</Tag>;
        return feedback || '-';
      } 
    },
    { 
      title: 'Grade', // Renamed from Score
      key: 'grade', // Changed key 
      width: '10%', // Adjusted width
      render: (_, record) => { // Parse analysis for score
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        // Only return the Tag
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>; 
      }
    },
    { 
      title: 'Actions',
      key: 'actions',
      width: '15%', // Adjusted width
      render: (_, record) => (
        <Button size="small" onClick={() => showWorkProductDetails(record)}>
          View Details
        </Button>
      ),
    },
  ].map(col => ({ ...col, className: 'work-product-col' }));

  const comprehensionColumns = [
    { title: 'Task Title', dataIndex: 'task_title', key: 'task_title', width: '25%' },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (d) => d ? dayjs(d?.value || d).format('YYYY-MM-DD') : 'N/A', width: '15%' },
    { 
      title: 'Score', 
      key: 'score', 
      width: '60%',
      render: (_, record) => { // Parse analysis for score
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        return (
          <Space>
            <span>{score?.toFixed(2) ?? 'N/A'}</span> {/* Display numeric score */}
            <Tag color={getGradeColor(grade)}>{grade}</Tag>
          </Space>
        );
      }
    },
    // Add Feedback column back, parsing from analysis
    { title: 'Feedback', key: 'feedback', width: '50%', render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const feedback = analysis?.feedback;
        // Add checks for special feedback tags if needed
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error') return <Tag color="red">Document Access Error</Tag>;
        if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') return <Tag color="red">Tech issue</Tag>;
        return feedback || '-';
      } 
    },
  ].map(col => ({ ...col, className: 'comprehension-col' }));

  const peerFeedbackColumns = [
    { 
      title: 'Date', 
      dataIndex: 'timestamp', 
      key: 'timestamp', 
      render: (ts) => ts ? dayjs(ts?.value || ts).format('MMMM D') : 'N/A', 
      width: '15%',
      sorter: (a, b) => dayjs(a.timestamp?.value || a.timestamp).unix() - dayjs(b.timestamp?.value || b.timestamp).unix(), 
      sortDirections: ['descend', 'ascend']
    },
    { 
      title: 'Reviewer Name',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
      width: '15%',
      render: (text, record) => {
        return record.from_user_id ? (
          <Link 
            to={`/builders/${record.from_user_id}`} 
          >
            {text || 'Unknown'}
          </Link>
        ) : (
          text || 'Unknown'
        );
      }
    },
    { title: 'Feedback', dataIndex: 'feedback', key: 'feedback', render: (text) => <Text>{text || '-'}</Text>, width: '30%' },
    { title: 'Summary', dataIndex: 'summary', key: 'summary', render: (text) => <Text style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</Text>, width: '25%' },
    { 
      title: 'Sentiment', 
      dataIndex: 'sentiment_label', // Use the label from the API for display
      key: 'sentiment_label', 
      width: '15%', 
      // Still sort by the numeric score
      sorter: (a, b) => (a.sentiment_score ?? -Infinity) - (b.sentiment_score ?? -Infinity),
      sortDirections: ['descend', 'ascend'],
      render: (label) => { // Render function now receives the label
        // Define color mapping based on the label text
        const sentimentColorMap = {
          'Very Positive': 'green',
          'Positive': 'cyan',
          'Neutral': 'default', // Or 'blue' if you prefer
          'Negative': 'orange',
          'Very Negative': 'red'
        };
        const color = sentimentColorMap[label] || 'default'; // Fallback color
        return (
          <Tag color={color}>
            {label || 'N/A'} {/* Display the label directly */}
          </Tag>
        );
      }
    },
  ].map(col => ({ ...col, className: 'peer-feedback-col' }));
  
  const sentimentColumns = [
      { 
        title: 'Date', 
        dataIndex: 'date', 
        key: 'date', 
        render: (d) => d ? dayjs(d?.value || d).format('MMMM D') : 'N/A', 
        width: '15%', // Adjusted width
        sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
        sortDirections: ['descend', 'ascend']
      },
      {
        title: 'Category', // Shortened title
        dataIndex: 'sentiment_score', // Still sorting/coloring by score
        key: 'sentiment_score', 
        width: '15%', // Adjusted width
        sorter: (a, b) => (a.sentiment_score ?? -Infinity) - (b.sentiment_score ?? -Infinity),
        sortDirections: ['descend', 'ascend'],
        render: (score, record) => { // Access full record if needed (for category fallback)
          // Use category from data if available, otherwise map from score
          const label = record.sentiment_category || mapScoreToLabel(score);
          const color = mapScoreToColor(score);
          return (
            <Tag color={color}>
              {label}
            </Tag>
          );
        }
      },
      { 
        title: 'Sentiment Reason (Outlier Sentence)', 
        dataIndex: 'sentiment_reason', // Use the new field from backend
        key: 'sentiment_reason', 
        width: '70%', // Adjusted width
        render: (text) => text || '-' // Display text or dash if null
      },
  ].map(col => ({ ...col, className: 'sentiment-col' }));

  // Function to show modal
  const showWorkProductDetails = (record) => {
    setSelectedWorkProduct(record);
    setWorkProductModalVisible(true);
  };

  // Function to hide modal
  const hideWorkProductDetails = () => {
    setWorkProductModalVisible(false);
    setSelectedWorkProduct(null); // Clear selected record
  };

  return (
    <div style={{ padding: '20px' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/builders')} 
        style={{ marginBottom: '20px' }}
      >
        Back to Builders List
      </Button>
      
      <Title level={2}>Builder Details</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
              <Space wrap>
                  <Select
                    showSearch
                    style={{ width: 300 }}
                    placeholder="Select a Builder"
                    optionFilterProp="children"
                    onChange={handleBuilderChange}
                    value={selectedBuilderId}
                    filterOption={(input, option) =>
                      (option?.children ?? '').toLowerCase().includes(input.toLowerCase()) // Safe access
                    }
                    allowClear
                  >
                    {allBuilders.map(builder => (
                      <Option key={builder.user_id} value={builder.user_id.toString()}>
                        {builder.name}
                      </Option>
                    ))}
                  </Select>
                  <RangePicker 
                      value={dateRange} 
                      onChange={handleDateRangeChange} 
                      allowClear={false} // Usually you want a date range
                  />
              </Space>
               {selectedBuilderName && (
                  <Title level={3} style={{ marginTop: '16px' }}>{selectedBuilderName}</Title>
              )}
          </Card>
          
          {!selectedBuilderId ? (
              <Text>Please select a builder to view details.</Text>
          ) : (
            <Spin spinning={loading}>
             {/* Remove the single Chart Section Card */}
             {/* <Card title="Metrics Over Time" style={{ marginBottom: '20px' }}> ... </Card> */}
             
              {/* Details Section - Restructured into Chart/Table Pairs */}
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Row 1: Sentiment */}
                <Row gutter={[16, 16]}>
                  <Col span={24}> 
                    <Card title="Sentiment Trend & Details" bordered={true}>
                      <Row gutter={[16, 16]}> 
                        <Col xs={24} md={12}> 
                          <SentimentChart 
                            ref={sentimentChartRef}
                            data={sentimentData} 
                            onPointClick={handlePointClick} 
                            highlightedRowKey={highlightedRowKey} 
                            highlightedRowType={highlightedRowType}
                            onPointHover={handlePointHover}
                            hoveredPointIndex={hoveredPointIndex}
                            hoveredChartType={hoveredChartType}
                            dateRange={dateRange}
                          /> 
                        </Col>
                        <Col xs={24} md={12}> 
                          <div ref={sentimentTableRef} style={{ height: '290px', overflow: 'hidden' }}>
                            <Table 
                              dataSource={
                                // Apply filter when highlighted
                                highlightedRowType === 'sentiment' && highlightedRowKey
                                  ? sentimentData.filter(record => (record.date?.value || record.date.toString()) === (highlightedRowKey?.value || highlightedRowKey?.toString()))
                                  : sentimentData
                              }
                              columns={sentimentColumns} 
                              rowKey={(record) => record.date?.value || record.date.toString()} // Extract primitive key
                              size="small" 
                              scroll={{ y: 240 }} 
                              rowClassName={(record) => {
                                // Ensure consistent key comparison (primitive vs primitive)
                                const recordKey = record.date?.value || record.date.toString();
                                const highlightKey = highlightedRowKey?.value || highlightedRowKey?.toString(); 
                                const shouldHighlight = highlightedRowType === 'sentiment' && recordKey === highlightKey;
                                return shouldHighlight ? 'highlighted-row' : '';
                              }}
                            />
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                {/* Row 2: Peer Feedback */}
                <Row gutter={[16, 16]}>
                   <Col span={24}> 
                     <Card title="Peer Feedback Trend & Details" bordered={true}>
                      <Row gutter={[16, 16]}> 
                        <Col xs={24} md={12}> 
                          <PeerFeedbackChart 
                            ref={peerFeedbackChartRef}
                            data={peerFeedbackData} 
                            onPointClick={handlePointClick} 
                            highlightedRowKey={highlightedRowKey} 
                            highlightedRowType={highlightedRowType}
                            onPointHover={handlePointHover}
                            hoveredPointIndex={hoveredPointIndex}
                            hoveredChartType={hoveredChartType}
                            dateRange={dateRange}
                          /> 
                        </Col>
                        <Col xs={24} md={12}> 
                          <div ref={peerFeedbackTableRef} style={{ height: '290px', overflow: 'hidden' }}>
                            <Table
                              dataSource={
                                // Apply filter when highlighted
                                highlightedRowType === 'peerFeedback' && highlightedRowKey
                                  ? peerFeedbackData.filter(record => record.feedback_id === highlightedRowKey)
                                  : peerFeedbackData
                              }
                              columns={peerFeedbackColumns}
                              rowKey="feedback_id"
                              size="small"
                              scroll={{ y: 240 }}
                              rowClassName={(record) => {
                                const shouldHighlight = highlightedRowType === 'peerFeedback' && record.feedback_id === highlightedRowKey;
                                // Optional Log:
                                // if (highlightedRowKey && highlightedRowType === 'peerFeedback') {
                                //   console.log(`Checking Peer Feedback Row: Record Key=${record.feedback_id}, Highlight Key=${highlightedRowKey}, Match=${shouldHighlight}`);
                                // }
                                return shouldHighlight ? 'highlighted-row' : '';
                              }}
                            />
                          </div>
                        </Col>
                       </Row>
                     </Card>
                  </Col>
                </Row>

                {/* Row 3: Work Product */}
                 <Row gutter={[16, 16]}>
                   <Col span={24}> 
                     <Card title="Work Product Trend & Details" bordered={true}>
                      <Row gutter={[16, 16]}> 
                        <Col xs={24} md={12}> 
                          <WorkProductChart 
                            ref={workProductChartRef}
                            data={workProductData} 
                            onPointClick={handlePointClick} 
                            highlightedRowKey={highlightedRowKey} 
                            highlightedRowType={highlightedRowType}
                            onPointHover={handlePointHover}
                            hoveredPointIndex={hoveredPointIndex}
                            hoveredChartType={hoveredChartType}
                            dateRange={dateRange}
                          /> 
                        </Col>
                        <Col xs={24} md={12}> 
                           <div ref={workProductTableRef} style={{ height: '290px', overflow: 'hidden' }}>
                             <Table 
                                dataSource={
                                  // Apply filter when highlighted
                                  highlightedRowType === 'workProduct' && highlightedRowKey
                                    ? workProductData.filter(record => record.task_id?.toString() === highlightedRowKey?.toString())
                                    : workProductData
                                } 
                                columns={workProductColumns} 
                                rowKey={(record) => record.task_id?.toString()} // Ensure primitive key
                                size="small" 
                                scroll={{ y: 240 }} 
                                rowClassName={(record) => {
                                  const recordKey = record.task_id?.toString();
                                  const highlightKey = highlightedRowKey?.toString();
                                  const shouldHighlight = highlightedRowType === 'workProduct' && recordKey === highlightKey;
                                  return shouldHighlight ? 'highlighted-row' : '';
                                }}
                             />
                           </div>
                        </Col>
                       </Row>
                     </Card>
                  </Col>
                </Row>
                
                {/* Row 4: Prompts - Assuming no interaction needed for outside click */}
                <Row gutter={[16, 16]}>
                  <Col span={24}> 
                    <Card title="Prompts Sent Over Time (Daily)" bordered={true}>
                      <Row gutter={[16, 16]}> 
                         <Col xs={24} md={12}> 
                           <PromptsChart 
                             data={promptsData}
                             dateRange={dateRange} 
                           /> 
                         </Col>
                         <Col xs={24} md={12}> 
                           {/* Maybe add prompt details table here later? */}
                           <div style={{ height: '290px', display: 'flex', alignItems:'center', justifyContent:'center' }}>
                             <Text type="secondary">(Prompt details table placeholder)</Text>
                           </div>
                         </Col>
                       </Row>
                     </Card>
                   </Col>
                 </Row>
              </Space>
            </Spin>
          )}
      </Space>

      {/* Work Product Details Modal */}
      <Modal
        title="Work Product Details" 
        open={workProductModalVisible}
        onCancel={hideWorkProductDetails}
        footer={[
          <Button key="back" onClick={hideWorkProductDetails}>
            Close
          </Button>,
        ]}
        width={800} // Adjusted width
      >
        {selectedWorkProduct && ( // Ensure record exists
          () => { // Use function to parse safely
            const analysis = parseAnalysis(selectedWorkProduct.analysis);
            return (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={4}>{selectedWorkProduct.task_title || 'Task Details'}</Title>
                
                {analysis?.submission_summary && (
                  <> 
                    <Text strong>Submission Summary:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                      {analysis.submission_summary}
                    </Paragraph>
                  </>
                )}

                {analysis?.completion_score !== null && analysis?.completion_score !== undefined && (
                  <Text strong>Score: {analysis.completion_score}</Text>
                )}
                
                {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                  <>
                    <Text strong>Criteria Met:</Text>
                    <Space wrap size={[4, 8]}>
                      {analysis.criteria_met.map((item, index) => <Tag color="green" key={`crit-${index}`}>{item}</Tag>)}
                    </Space>
                  </>
                )}

                {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                  <>
                    <Text strong>Areas for Improvement:</Text>
                    <Space wrap size={[4, 8]}>
                      {analysis.areas_for_improvement.map((item, index) => <Tag color="orange" key={`area-${index}`}>{item}</Tag>)}
                    </Space>
                  </>
                )}

                {/* --- Specific Findings Section --- */}
                {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                  <>
                    <Title level={5} style={{ marginTop: '16px', marginBottom: '8px' }}>Specific Findings:</Title>
                    {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                      <div key={`find-cat-${catIndex}`} style={{ marginBottom: '12px', paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
                        <Text strong>{category}:</Text>
                        {findings?.strengths && findings.strengths.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <Text>Strengths:</Text>
                            <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                              {findings.strengths.map((item, index) => <li key={`str-${catIndex}-${index}`}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                        {findings?.weaknesses && findings.weaknesses.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <Text>Weaknesses:</Text>
                            <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                              {findings.weaknesses.map((item, index) => <li key={`weak-${catIndex}-${index}`}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
                {/* --- End Specific Findings --- */}
                
                {analysis?.feedback && (
                  <>
                    <Text strong>Feedback:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                      {analysis.feedback}
                    </Paragraph>
                  </>
                )}
                
                {/* Add Strengths/Weaknesses parsing later if needed */}

              </Space>
            );
          })()
        }
      </Modal>
    </div>
  );
};

export default BuilderDetailsPage; 
