import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, Typography, DatePicker, Table, Tabs, Spin, message, Button, Select, Space, Row, Col, Tag, Modal, Descriptions, Alert } from 'antd';
import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails, fetchVideoAnalyses } from '../services/builderService';
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
import { getLetterGrade, getGradeColor, getGradeTagClass } from '../utils/gradingUtils';
import { parseAnalysis } from '../utils/parsingUtils'; // Import the utility function


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
    background-color: #2D3748 !important; /* Lighter blue highlight */
    /* color: #000000 !important; */ /* Removed to keep text white */
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
  if (score === null || score === undefined) return '#CCCCCC'; // Brighter Neutral Grey for N/A

  const numScore = parseFloat(score);
  if (isNaN(numScore)) return '#CCCCCC'; // Brighter Neutral Grey for NaN

  // Use brighter standardized hex colors for points
  if (numScore >= 0.6) return '#2E7D32'; // Very Positive (Darker Brighter Green, e.g., Material UI Green 800)
  if (numScore >= 0.2) return '#54D654';  // Positive (Original Brighter Green)
  if (numScore > -0.2) return '#CCCCCC'; // Neutral (Lighter Grey)
  if (numScore >= -0.6) return '#FFAA44';// Negative (Brighter Orange)
  return '#dc3545';   // Very Negative (Brighter Red, matches chartColors.secondary)
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
        borderColor: '#ffffff', // Changed to white
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Light transparent white for fill
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors, // Set border color same as fill color from pointColors
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
        borderColor: '#ffffff', // Changed to white
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Light transparent white for fill
        tension: 0.1,
        fill: false, 
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

  // Use original dataset colors as default
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    // Default to the color from the original dataset (from mapScoreToColor via processScoreBasedLineChartData)
    return originalDatasets[0]?.pointBorderColor?.[index] || '#000000'; 
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'sentiment') return '#bbdefb'; // Hover fill (light blue)
    // Default to the color from the original dataset (from mapScoreToColor via processScoreBasedLineChartData)
    return originalDatasets[0]?.pointBackgroundColor?.[index] || 'rgba(0, 0, 0, 0.1)'; 
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

  // Use original dataset colors as default
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    return originalDatasets[0]?.pointBorderColor?.[index] || '#000000';
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'peerFeedback') return '#bbdefb'; // Hover fill (light blue)
    return originalDatasets[0]?.pointBackgroundColor?.[index] || 'rgba(0, 0, 0, 0.1)';
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

  // Use original dataset colors as default
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Highlight color
    return originalDatasets[0]?.pointBorderColor?.[index] || '#000000';
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'workProduct') return '#bbdefb'; // Hover fill (light blue)
    return originalDatasets[0]?.pointBackgroundColor?.[index] || 'rgba(0, 0, 0, 0.1)';
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

const ComprehensionChart = ({ data, onPointClick, highlightedRowKey, highlightedRowType, onPointHover, hoveredPointIndex, hoveredChartType, dateRange }) => {
  const chartRef = React.useRef();
  // Process data specifically for comprehension
  const { labels, datasets: originalDatasets, keys } = processScoreBasedLineChartData(
      data, 'date', null /* valueField not used directly */, 'task_id', 'Comprehension Score', dateRange[0], dateRange[1], 'comprehension'
  );

  // Calculate highlighted index
  let highlightedIndex = -1;
  if (highlightedRowType === 'comprehension' && highlightedRowKey) {
    highlightedIndex = keys.findIndex(key => key?.toString() === highlightedRowKey?.toString());
  }

  // Generate dynamic point styles based on hover AND highlight
  const pointRadius = labels.map((_, index) => {
    if (index === highlightedIndex) return 8;
    if (index === hoveredPointIndex && hoveredChartType === 'comprehension') return 10;
    return 3;
  });
  const pointBorderWidth = labels.map((_, index) => {
    if (index === highlightedIndex) return 3;
    return 1;
  });

  // Use original dataset colors as default
  const pointBorderColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#e65100'; // Use same highlight color
    return originalDatasets[0]?.pointBorderColor?.[index] || '#000000';
  });
  const pointBackgroundColor = labels.map((_, index) => {
    if (index === highlightedIndex) return '#ffb74d'; // Use same highlight fill
    if (index === hoveredPointIndex && hoveredChartType === 'comprehension') return '#bbdefb';
    return originalDatasets[0]?.pointBackgroundColor?.[index] || 'rgba(0, 0, 0, 0.1)';
  });

  // Create the final dataset with dynamic styles
  const datasets = originalDatasets.map(dataset => ({
    ...dataset,
    pointRadius,
    pointBorderWidth,
    pointBorderColor,
    pointBackgroundColor,
    hoverRadius: pointRadius,
    hoverBorderWidth: pointBorderWidth,
    hoverBorderColor: pointBorderColor,
    hoverBackgroundColor: pointBackgroundColor
  }));

  const chartData = { labels, datasets };

  const handleChartClick = (event) => {
      const elements = getElementAtEvent(chartRef.current, event);
      if (elements.length > 0) {
          const index = elements[0].index;
          const key = keys[index];
          if (key && onPointClick) {
              onPointClick(key, 'comprehension');
              event.stopPropagation();
          }
      }
  };

  const options = { 
    ...baseChartOptions, 
    plugins: { 
        ...baseChartOptions.plugins, 
        title: { display: true, text: 'Comprehension Score Over Time', color: chartColors.text },
        legend: { display: false },
        tooltip: { enabled: false }
      },
      onHover: (event, chartElement, chart) => {
        const canvas = chart.canvas;
        if (chartElement.length > 0) {
          canvas.style.cursor = 'pointer';
          onPointHover(chartElement[0].index, 'comprehension');
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
          },
          color: chartColors.text // Ensure X-axis ticks are white
        },
        grid: {
          display: false 
        },
        title: {
          // No x-axis title for this chart by default, can be added if needed
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Prompts',
          color: chartColors.text // Ensure Y-axis title is white
        },
        grid: {
          color: chartColors.grid 
        },
        ticks: {
          color: chartColors.text // Ensure Y-axis ticks are white
        }
      }
    },
    plugins: {
      title: { 
        display: true, 
        text: 'Prompts Sent Over Time (Daily)', 
        color: chartColors.text 
      },
      legend: {
        display: false // Remove the legend
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems) {
            return dayjs(tooltipItems[0].label, 'MM-DD').format('MM-DD');
          },
          label: function(context) {
            return `Prompts: ${context.parsed.y}`;
          }
        }
      }
    }
  };

  // Change back to Line chart
  return <div style={chartContainer}><Line ref={chartRef} options={options} data={chartData} /></div>;
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
  const [videoAnalysesData, setVideoAnalysesData] = useState([]);
  // const [sentimentData, setSentimentData] = useState([]);

  // Need state for the modals
  const [isWorkProductModalVisible, setWorkProductModalVisible] = useState(false);
  const [selectedWorkProduct, setSelectedWorkProduct] = useState(null);
  const [isComprehensionModalVisible, setComprehensionModalVisible] = useState(false); // State for Comprehension modal
  const [selectedComprehension, setSelectedComprehension] = useState(null); // State for selected Comprehension item
  // const [selectedVideoAnalysis, setSelectedVideoAnalysis] = useState(null);
  // const [videoAnalysisModalVisible, setVideoAnalysisModalVisible] = useState(false);

  const [highlightedRowKey, setHighlightedRowKey] = useState(null);
  const [highlightedRowType, setHighlightedRowType] = useState(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [hoveredChartType, setHoveredChartType] = useState(null);

  // Chart Refs
  // const sentimentChartRef = useRef(null);
  const peerFeedbackChartRef = useRef(null);
  const workProductChartRef = useRef(null);
  const comprehensionChartRef = useRef(null); // Add ref for Comprehension chart
  // ADD Table Refs
  // const sentimentTableRef = useRef(null);
  const peerFeedbackTableRef = useRef(null);
  const workProductTableRef = useRef(null);
  const comprehensionTableRef = useRef(null); // Add ref for Comprehension table

  // Updated useMemo calls to pass dataType
  // const sentimentChartData = useMemo(() => processScoreBasedLineChartData(
  //   sentimentData, 'date', 'sentiment_score', 'date', 'Sentiment Score', dateRange[0], dateRange[1], 'sentiment'
  // ), [sentimentData, dateRange]);

  const peerFeedbackChartData = useMemo(() => processScoreBasedLineChartData(
    peerFeedbackData, 'timestamp', 'sentiment_score', 'feedback_id', 'Peer Feedback Score', dateRange[0], dateRange[1], 'peerFeedback'
  ), [peerFeedbackData, dateRange]);

  const workProductChartData = useMemo(() => processScoreBasedLineChartData(
    workProductData, 'date', null /* valueField not used directly */, 'task_id', 'Work Product Score', dateRange[0], dateRange[1], 'workProduct'
  ), [workProductData, dateRange]);

  const comprehensionChartData = useMemo(() => processScoreBasedLineChartData(
    comprehensionData, 'date', null, 'task_id', 'Comprehension Score', dateRange[0], dateRange[1], 'comprehension'
  ), [comprehensionData, dateRange]);

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
      case 'video_analyses': dataExists = videoAnalysesData.length > 0; break;
      // case 'sentiment': dataExists = sentimentData.length > 0; break;
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
        case 'video_analyses': setVideoAnalysesData(data); break;
        // case 'sentiment': setSentimentData(data); break;
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
      setVideoAnalysesData([]); // Clear video analyses data
      // setSentimentData([]);
      
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch video analyses first
        const videoData = await fetchVideoAnalyses(startDate, endDate, selectedBuilderId, null).catch(e => {
          console.error('Video analyses fetch error:', e);
          return [];
        });
        
        // Process video data to match the format of workProduct data
        const processedVideoData = videoData.map(video => {
          // Calculate average score
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
          
          // Create an analysis object that matches the format expected by the work product table
          const analysisObj = {
            completion_score: (avgScore / 5) * 100, // Convert score out of 5 to percentage
            feedback: `Technical: ${technicalExplanation}\n\nBusiness: ${businessExplanation}\n\nProfessional: ${professionalExplanation}`,
            criteria_met: [],
            areas_for_improvement: []
          };
          
          return {
            auto_id: `video-${video.video_id}`, // Create a unique ID with prefix
            task_title: video.task_title || 'Video Demo Analysis', // Use the joined task_title or fallback to default
            date: video.submission_date || new Date().toISOString(), // Use the joined submission_date or fallback
            analysis: JSON.stringify(analysisObj),
            user_id: video.user_id,
            isVideoAnalysis: true, // Flag to distinguish videos from regular work products
            videoData: video // Store the original video data
          };
        });
        
        setVideoAnalysesData(processedVideoData);
        
        // Fetch all other data types sequentially
        const wpData = await fetchBuilderDetails(selectedBuilderId, 'workProduct', startDate, endDate).catch(e => { console.error('WP fetch error:', e); return []; });
        // Combine work product data with processed video data
        setWorkProductData([...wpData, ...processedVideoData]);

        const compData = await fetchBuilderDetails(selectedBuilderId, 'comprehension', startDate, endDate).catch(e => { console.error('Comp fetch error:', e); return []; });
        setComprehensionData(compData);

        const pfData = await fetchBuilderDetails(selectedBuilderId, 'peer_feedback', startDate, endDate).catch(e => { console.error('PF fetch error:', e); return []; });
        setPeerFeedbackData(pfData);

        const pData = await fetchBuilderDetails(selectedBuilderId, 'prompts', startDate, endDate).catch(e => { console.error('Prompts fetch error:', e); return []; });
        setPromptsData(pData);

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
    const handleClickOutside = (event) => { 
      // Check if the click is outside ALL chart refs and ALL table refs
      const isOutsideCharts = ![peerFeedbackChartRef, workProductChartRef, comprehensionChartRef].some(
        ref => ref.current && ref.current.contains(event.target)
      );
      const isOutsideTables = ![peerFeedbackTableRef, workProductTableRef, comprehensionTableRef].some(
        ref => ref.current && ref.current.contains(event.target)
      );

      if (isOutsideCharts && isOutsideTables && (highlightedRowKey !== null || highlightedRowType !== null)) {
        setHighlightedRowKey(null);
        setHighlightedRowType(null);
        setHoveredPointIndex(null);
        setHoveredChartType(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // Add new refs to dependency array
  }, [highlightedRowKey, highlightedRowType, peerFeedbackChartRef, workProductChartRef, comprehensionChartRef, peerFeedbackTableRef, workProductTableRef, comprehensionTableRef]);

  // Define columns for each table
  const workProductColumns = [
    { title: 'Task Title', dataIndex: 'task_title', key: 'task_title', width: '25%' },
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
      title: 'Grade', 
      key: 'grade', 
      width: '10%', 
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        if (!analysis) return null; // Handle case where analysis is null

        const score = analysis.completion_score;
        const criteria = analysis.criteria_met;

        // Check for Tech Issue condition FIRST
        if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
          return null; // Return nothing for tech issue
        }

        // Check for Document Access Error (score is 0)
        if (score === 0) {
           return null; // Return nothing for Document Access Error
        }

        // If score is null/undefined/NaN, getLetterGrade returns 'F', which is fine to display.
        const grade = getLetterGrade(score);

        // Only return the Tag if it's not a special case handled above
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>; 
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
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => d ? dayjs(d?.value || d).format('MMMM D') : 'N/A', // Use Month Day format
      width: '15%' 
    }, 
    { 
      title: 'Grade', 
      key: 'grade', 
      width: '10%', 
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>; 
      }
    },
    { 
      title: 'Feedback', 
      key: 'feedback', 
      width: '35%', 
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
      title: 'Actions',
      key: 'actions',
      width: '15%', 
      render: (_, record) => (
        <Button size="small" onClick={() => showComprehensionDetails(record)}>
          View Details
        </Button>
      ),
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
        const sentimentClass = sentimentClassMap[label] || 'sentiment-tag-neutral';
        return (
          <Tag className={sentimentClass}>
            {label || 'N/A'}
          </Tag>
        );
      }
    },
  ].map(col => ({ ...col, className: 'peer-feedback-col' }));
  
  // Define promptColumns for the prompts table
  const promptColumns = [
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      render: (d) => d ? dayjs(d?.value || d).format('MMMM D') : 'N/A', 
      width: '30%',
      sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
      sortDirections: ['descend', 'ascend']
    },
    { 
      title: 'Prompts Sent', 
      dataIndex: 'count', 
      key: 'count', 
      width: '70%',
      sorter: (a, b) => (a.count || 0) - (b.count || 0),
      sortDirections: ['descend', 'ascend']
    }
  ].map(col => ({ ...col, className: 'prompt-col' }));
  
  // const sentimentColumns = [
  //     { 
  //       title: 'Date', 
  //       dataIndex: 'date', 
  //       key: 'date', 
  //       render: (d) => d ? dayjs(d?.value || d).format('MMMM D') : 'N/A', 
  //       width: '15%', // Adjusted width
  //       sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
  //       sortDirections: ['descend', 'ascend']
  //     },
  //     {
  //       title: 'Category', // Shortened title
  //       dataIndex: 'sentiment_score', // Still sorting/coloring by score
  //       key: 'sentiment_score', 
  //       width: '15%', // Adjusted width
  //       sorter: (a, b) => (a.sentiment_score ?? -Infinity) - (b.sentiment_score ?? -Infinity),
  //       sortDirections: ['descend', 'ascend'],
  //       render: (score, record) => {
  //         const label = record.sentiment_category || mapScoreToLabel(score); // Use category from record, fallback to score mapping
  //         const sentimentClassMap = {
  //           'Very Positive': 'sentiment-tag-very-positive',
  //           'Positive': 'sentiment-tag-positive',
  //           'Neutral': 'sentiment-tag-neutral',
  //           'Negative': 'sentiment-tag-negative',
  //           'Very Negative': 'sentiment-tag-very-negative'
  //         };
  //         const sentimentClass = sentimentClassMap[label] || 'sentiment-tag-neutral';
  //         return (
  //           <Tag className={sentimentClass}>
  //             {label}
  //           </Tag>
  //         );
  //       }
  //     },
  //     { 
  //       title: 'Sentiment Reason (Outlier Sentence)', 
  //       dataIndex: 'sentiment_reason', // Use the new field from backend
  //       key: 'sentiment_reason', 
  //       width: '70%', // Adjusted width
  //       render: (text) => text || '-' // Display text or dash if null
  //     },
  // ].map(col => ({ ...col, className: 'sentiment-col' }));

  // Function to show modal
  const showWorkProductDetails = (record) => {
    // All entries (including video analyses) are now shown in the work product modal
    setSelectedWorkProduct(record);
    setWorkProductModalVisible(true);
  };

  // Function to hide modal
  const hideWorkProductDetails = () => {
    setWorkProductModalVisible(false);
    setSelectedWorkProduct(null); // Clear selected record
  };

  // Functions to show/hide Comprehension modal
  const showComprehensionDetails = (record) => {
    setSelectedComprehension(record);
    setComprehensionModalVisible(true);
  };

  const hideComprehensionDetails = () => {
    setComprehensionModalVisible(false);
    setSelectedComprehension(null); // Clear selected record
  };

  // Helper function to render analyzed content (outside the main component)
  const renderAnalyzedContent = (content) => {
    if (!content) return '-';

    // Regex to check if the string is likely a URL
    const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

    // Attempt to parse as JSON link structure first
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].type === 'link' && typeof parsed[0].content === 'string') {
        const url = parsed[0].content;
         // Additional check if the extracted content is actually a URL
         if (urlRegex.test(url)) { 
           return <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
         } else {
           // If JSON structure is there but content isn't a URL, display raw JSON
           return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(parsed, null, 2)}</pre></Text>;
         }
      }
    } catch (e) {
      // Not JSON or wrong format, proceed to check if it's a plain URL
    }

    // Check if the plain text content is a URL
    if (typeof content === 'string' && urlRegex.test(content)) {
      return <a href={content} target="_blank" rel="noopener noreferrer">{content}</a>;
    }

    // Fallback: Render as plain text (use pre for potential formatting)
    return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{content}</pre></Text>;
  };

  // Helper function to parse video analysis rationale
  const parseRationale = (jsonString) => {
    if (!jsonString) return { formattedText: 'No rationale available' };
    
    try {
      const parsedJson = JSON.parse(jsonString);
      
      // Create a neatly formatted component for displaying the rationale
      const formattedContent = (
        <div>
          {parsedJson.overall_explanation && (
            <div style={{ marginBottom: '15px' }}>
              <Text style={{ display: 'block', color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>
                {parsedJson.overall_explanation}
              </Text>
            </div>
          )}
          
          {parsedJson.overall_supporting_evidence && (
            <div style={{ marginBottom: '15px' }}>

              <Text style={{ display: 'block', color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>
                {parsedJson.overall_supporting_evidence}
              </Text>
            </div>
          )}
          
          {parsedJson.sub_criteria && Object.keys(parsedJson.sub_criteria).length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <Text strong style={{ display: 'block', marginBottom: '10px', color: "var(--color-text-main)" }}>
                Criteria Details:
              </Text>
              {Object.entries(parsedJson.sub_criteria).map(([criteriaName, criteriaData], index) => (
                <div key={`criteria-${index}`} style={{ marginBottom: '15px', marginLeft: '10px', borderLeft: '2px solid var(--color-border-light)', paddingLeft: '10px' }}>
                  <Text strong style={{ display: 'block', marginBottom: '5px', color: "var(--color-text-main)" }}>
                    {criteriaName}:
                  </Text>
                  {criteriaData.score !== undefined && (
                    <div style={{ marginBottom: '5px' }}>
                      <Text style={{ color: "var(--color-text-main)" }}>
                        Score: {criteriaData.score}/5
                      </Text>
                    </div>
                  )}
                  {criteriaData.explanation && (
                    <div style={{ marginBottom: '5px' }}>
                      <Text style={{ display: 'block', color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>
                        {criteriaData.explanation}
                      </Text>
                    </div>
                  )}
                  {criteriaData.supporting_evidence && (
                    <div style={{ marginTop: '5px' }}>
                      <Text style={{ color: "var(--color-text-secondary)", fontSize: '12px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                        {criteriaData.supporting_evidence}
                      </Text>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* If there are strengths/weaknesses, display them */}
          {(parsedJson.strengths || parsedJson.weaknesses) && (
            <div style={{ marginTop: '15px' }}>
              {parsedJson.strengths && parsedJson.strengths.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <Text strong style={{ color: "var(--color-text-main)", display: 'block', marginBottom: '5px' }}>Strengths:</Text>
                  <ul style={{ marginTop: '5px', paddingLeft: '20px', color: "var(--color-text-main)" }}>
                    {parsedJson.strengths.map((item, i) => (
                      <li key={`strength-${i}`} style={{ color: "var(--color-text-main)" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {parsedJson.weaknesses && parsedJson.weaknesses.length > 0 && (
                <div>
                  <Text strong style={{ color: "var(--color-text-main)", display: 'block', marginBottom: '5px' }}>Weaknesses:</Text>
                  <ul style={{ marginTop: '5px', paddingLeft: '20px', color: "var(--color-text-main)" }}>
                    {parsedJson.weaknesses.map((item, i) => (
                      <li key={`weakness-${i}`} style={{ color: "var(--color-text-main)" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      );
      
      return { formattedContent, rawJson: parsedJson };
    } catch (error) {
      console.error("Failed to parse rationale JSON:", error);
      
      // Try to display as plain text if it's not valid JSON
      return { formattedText: jsonString };
    }
  };

  // Render tabs
  return (
    <div className="builder-details-page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="builder-select-card" style={{ borderRadius: '8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>Builder Details</Title>
              <Text type="secondary">View performance metrics for a specific builder</Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
              <Select
                value={selectedBuilderId}
                onChange={handleBuilderChange}
                placeholder="Select Builder"
                loading={loading}
                style={{ width: 250, marginRight: '0' }}
                filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                showSearch
              >
                {allBuilders && allBuilders.map(builder => (
                  <Select.Option key={builder.user_id} value={builder.user_id.toString()}>
                    {builder.name}
                  </Select.Option>
                ))}
              </Select>
              <RangePicker 
                value={dateRange} 
                onChange={handleDateRangeChange} 
                style={{ width: 280 }}
              />
            </div>
          </div>
        </Card>

        {!selectedBuilderId && (
          <Alert
            message="Please select a builder"
            description="Choose a builder from the dropdown above to view their details."
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}

        {selectedBuilderId && (
          <div>
            <Spin spinning={loading}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Row 2: Work Product - MOVED TO FIRST */}
                 <Row gutter={[24, 24]}>
                   <Col span={24}> 
                     <Card title="Work Product Trend & Details" bordered={true} style={{ borderRadius: '8px' }}>
                      <Row gutter={[24, 24]}> 
                        <Col xs={24} md={8}> {/* Chart: 1/3 width */}
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
                        <Col xs={24} md={16}> {/* Table: 2/3 width */}
                           <div ref={workProductTableRef} style={{ height: '290px', overflow: 'hidden', borderRadius: '8px' }}>
                             <Table 
                                dataSource={                                  
                                  highlightedRowType === 'workProduct' && highlightedRowKey
                                    ? workProductData.filter(record => record.task_id?.toString() === highlightedRowKey?.toString())
                                    : workProductData
                                } 
                                columns={workProductColumns} 
                                rowKey={(record) => record.task_id?.toString()} 
                                size="small" 
                                scroll={{ y: 240 }} 
                                rowClassName={(record) => {
                                  const recordKey = record.task_id?.toString();
                                  const highlightKey = highlightedRowKey?.toString();
                                  const shouldHighlight = highlightedRowType === 'workProduct' && recordKey === highlightKey;
                                  return shouldHighlight ? 'highlighted-row' : '';
                                }}
                                style={{ borderRadius: '8px' }}
                             />
                           </div>
                        </Col>
                       </Row>
              </Card>
                  </Col>
                </Row>
                
                {/* Row 3: Comprehension - MOVED TO SECOND */}
                 <Row gutter={[24, 24]}>
                   <Col span={24}> 
                     <Card title="Comprehension Trend & Details" bordered={true} style={{ borderRadius: '8px' }}>
                      <Row gutter={[24, 24]}> 
                        <Col xs={24} md={8}> {/* Chart: 1/3 width */}
                          <ComprehensionChart 
                            ref={comprehensionChartRef} // Assign ref
                            data={comprehensionData} 
                            onPointClick={handlePointClick} 
                            highlightedRowKey={highlightedRowKey} 
                            highlightedRowType={highlightedRowType}
                            onPointHover={handlePointHover}
                            hoveredPointIndex={hoveredPointIndex}
                            hoveredChartType={hoveredChartType}
                            dateRange={dateRange}
                          /> 
                        </Col>
                        <Col xs={24} md={16}> {/* Table: 2/3 width */}
                           <div ref={comprehensionTableRef} style={{ height: '290px', overflow: 'hidden', borderRadius: '8px' }}> 
                             <Table 
                                dataSource={ 
                                  highlightedRowType === 'comprehension' && highlightedRowKey
                                    ? comprehensionData.filter(record => record.task_id?.toString() === highlightedRowKey?.toString())
                                    : comprehensionData
                                } 
                                columns={comprehensionColumns} 
                                rowKey={(record) => record.task_id?.toString()} 
                                size="small" 
                                scroll={{ y: 240 }} 
                                rowClassName={(record) => {
                                  const recordKey = record.task_id?.toString();
                                  const highlightKey = highlightedRowKey?.toString();
                                  const shouldHighlight = highlightedRowType === 'comprehension' && recordKey === highlightKey;
                                  return shouldHighlight ? 'highlighted-row' : '';
                                }}
                                style={{ borderRadius: '8px' }}
                             />
                           </div>
                        </Col>
                       </Row>
                     </Card>
                  </Col>
                </Row>

                {/* Row 4: Peer Feedback - MOVED TO THIRD */}
                <Row gutter={[24, 24]}>
                   <Col span={24}> 
                     <Card title="Peer Feedback Trend & Details" bordered={true} style={{ borderRadius: '8px' }}>
                      <Row gutter={[24, 24]}> 
                  <Col xs={24} md={8}> {/* Chart: 1/3 width */}
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
                  <Col xs={24} md={16}> {/* Table: 2/3 width */}
                          <div ref={peerFeedbackTableRef} style={{ height: '290px', overflow: 'hidden', borderRadius: '8px' }}>
                            <Table
                              dataSource={                                
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
                                return shouldHighlight ? 'highlighted-row' : '';
                              }}
                              style={{ borderRadius: '8px' }}
                            />
                          </div>
                  </Col>
                </Row>
             </Card>
                  </Col>
                </Row>
                
                {/* Row 5: Prompts */}
                <Row gutter={[24, 24]}>
                  <Col span={24}> 
                    <Card title="Prompts Sent Over Time (Daily)" bordered={true} style={{ borderRadius: '8px' }}>
                      <Row gutter={[24, 24]}> 
                         <Col xs={24} md={8}> {/* Chart: 1/3 width */}
                           <PromptsChart 
                             data={promptsData}
                             dateRange={dateRange} 
                           /> 
                         </Col>
                         <Col xs={24} md={16}> {/* Table: 2/3 width (placeholder) */}
                           <div style={{ height: '290px', overflow: 'hidden', borderRadius: '8px' }}>
                              <Table
                                dataSource={promptsData}
                                columns={promptColumns}
                                rowKey={(record) => `prompt-${record.date}-${record.count}`}
                                size="small"
                                scroll={{ y: 240 }}
                                style={{ borderRadius: '8px' }}
                              />
                           </div>
                         </Col>
                       </Row>
                     </Card>
                  </Col>
                </Row>
              </Space>
            </Spin>
          </div>
        )}
      </Space>

      {/* Work Product Details Modal */}
      <Modal
        title={<Typography.Text style={{ color: 'var(--color-text-main)' }}>{`Work Product Details - ${selectedWorkProduct?.task_title || 'Task'}`}</Typography.Text>}
        open={isWorkProductModalVisible}
        onCancel={hideWorkProductDetails}
        footer={[
           <Button key="back" onClick={hideWorkProductDetails}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {selectedWorkProduct && (
           (() => {
             const analysis = parseAnalysis(selectedWorkProduct.analysis);
             if (!analysis || analysis.feedback === 'Error parsing analysis data.') {
                 return <Alert message="Error" description="Could not parse analysis data for this record." type="error" showIcon />;
             }
             return (
              <Space direction="vertical" style={{ width: '100%' }}>
                 <Title level={4} style={{ marginBottom: 0 }}>{selectedWorkProduct.task_title || 'Task Details'}</Title>
                 <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Date: {selectedWorkProduct.date ? dayjs(selectedWorkProduct.date?.value || selectedWorkProduct.date).format('MMMM D, YYYY') : 'N/A'}
                 </Text>

                 {/* Score */}
                 {analysis?.completion_score !== null && analysis?.completion_score !== undefined && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong>Score:</Text> <Text>{analysis.completion_score} ({getLetterGrade(analysis.completion_score)})</Text>
          </div>
                 )}

                 {/* Analyzed Content */}
                 {selectedWorkProduct.analyzed_content && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong style={{ display: 'block' }}>Analyzed Content:</Text>
                        <div style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                           {renderAnalyzedContent(selectedWorkProduct.analyzed_content)}
                        </div>
                    </div>
                 )}

                 {/* Submission Summary */}
                 {analysis?.submission_summary && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong style={{ display: 'block' }}>Submission Summary:</Text>
                     <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                       {analysis.submission_summary}
                     </Paragraph>
                   </div>
                 )}

                 {/* Feedback */}
                 {analysis?.feedback && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong style={{ display: 'block' }}>Feedback:</Text>
                     <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                       {analysis.feedback}
                     </Paragraph>
                   </div>
                 )}

                 {/* Criteria Met */}
                 {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong style={{ display: 'block' }}>Criteria Met:</Text>
                     <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                       {analysis.criteria_met.map((item, index) => <Tag className="criteria-met-tag" key={`wp-crit-${index}`}>{item}</Tag>)}
                     </Space>
                   </div>
                 )}

                 {/* Areas for Improvement */}
                 {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong style={{ display: 'block' }}>Areas for Improvement:</Text>
                     <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                       {analysis.areas_for_improvement.map((item, index) => <Tag className="areas-for-improvement-tag" key={`wp-area-${index}`}>{item}</Tag>)}
                     </Space>
                   </div>
                 )}

                 {/* Specific Findings */}
                 {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <Title level={5} style={{ marginBottom: '8px' }}>Specific Findings:</Title>
                      {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                        <div key={`wp-find-cat-${catIndex}`} style={{ marginBottom: '12px', paddingLeft: '10px', borderLeft: '2px solid var(--color-border-light)' }}>
                          <Text strong>{category}:</Text>
                          {findings?.strengths && findings.strengths.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <Text>Strengths:</Text>
                              <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                                {findings.strengths.map((item, index) => <li key={`wp-str-${catIndex}-${index}`}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                          {findings?.weaknesses && findings.weaknesses.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <Text>Weaknesses:</Text>
                              <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                                {findings.weaknesses.map((item, index) => <li key={`wp-weak-${catIndex}-${index}`}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                 )}
               </Space>
             );
           })()
        )}
      </Modal>

      {/* Comprehension Details Modal */}
      <Modal
        title={<Typography.Text style={{ color: 'var(--color-text-main)' }}>{`Comprehension Details - ${selectedComprehension?.task_title || 'Task'}`}</Typography.Text>}
        open={isComprehensionModalVisible}
        onCancel={hideComprehensionDetails}
        footer={[
           <Button key="back" onClick={hideComprehensionDetails}>
             Close
           </Button>,
         ]}
        width={800}
      >
        {selectedComprehension && (
           (() => {
             const analysis = parseAnalysis(selectedComprehension.analysis);
             if (!analysis || analysis.feedback === 'Error parsing analysis data.') {
                 return <Alert message="Error" description="Could not parse analysis data for this record." type="error" showIcon />;
             }
             return (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={4} style={{ marginBottom: 0 }}>{selectedComprehension.task_title || 'Task Details'}</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                   Date: {selectedComprehension.date ? dayjs(selectedComprehension.date?.value || selectedComprehension.date).format('MMMM D, YYYY') : 'N/A'}
                </Text>

                {/* Score */}
                {analysis?.completion_score !== null && analysis?.completion_score !== undefined && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong>Score:</Text> <Text>{analysis.completion_score} ({getLetterGrade(analysis.completion_score)})</Text>
                   </div>
                )}

                 {/* Analyzed Content - Assuming it might exist for comprehension too */}
                 {selectedComprehension.analyzed_content && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong style={{ display: 'block' }}>Analyzed Content:</Text>
                        <div style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                           {renderAnalyzedContent(selectedComprehension.analyzed_content)}
                        </div>
                    </div>
                 )}

                {/* Submission Summary */}
                {analysis?.submission_summary && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Submission Summary:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                      {analysis.submission_summary}
                    </Paragraph>
                  </div>
                )}

                {/* Feedback */}
                {analysis?.feedback && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Feedback:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-hover)', color: 'var(--color-text-main)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                      {analysis.feedback}
                    </Paragraph>
                  </div>
                )}

                {/* Criteria Met */}
                {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Criteria Met:</Text>
                    <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                      {analysis.criteria_met.map((item, index) => <Tag className="criteria-met-tag" key={`comp-crit-${index}`}>{item}</Tag>)}
                    </Space>
                  </div>
                )}

                {/* Areas for Improvement */}
                {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Areas for Improvement:</Text>
                    <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                      {analysis.areas_for_improvement.map((item, index) => <Tag className="areas-for-improvement-tag" key={`comp-area-${index}`}>{item}</Tag>)}
                    </Space>
                  </div>
                )}

                {/* Specific Findings */}
                {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                   <div style={{ marginTop: '16px' }}>
                     <Title level={5} style={{ marginBottom: '8px' }}>Specific Findings:</Title>
                     {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                       <div key={`comp-find-cat-${catIndex}`} style={{ marginBottom: '12px', paddingLeft: '10px', borderLeft: '2px solid var(--color-border-light)' }}>
                         <Text strong>{category}:</Text>
                         {findings?.strengths && findings.strengths.length > 0 && (
                           <div style={{ marginTop: '4px' }}>
                             <Text>Strengths:</Text>
                             <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                               {findings.strengths.map((item, index) => <li key={`comp-str-${catIndex}-${index}`}>{item}</li>)}
                             </ul>
                           </div>
                         )}
                         {findings?.weaknesses && findings.weaknesses.length > 0 && (
                           <div style={{ marginTop: '4px' }}>
                             <Text>Weaknesses:</Text>
                             <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                               {findings.weaknesses.map((item, index) => <li key={`comp-weak-${catIndex}-${index}`}>{item}</li>)}
                             </ul>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                )}
              </Space>
            );
          })()
        )}
      </Modal>
    </div>
  );
};

export default BuilderDetailsPage; 
