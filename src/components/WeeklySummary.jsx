import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Typography, Spin, Alert, Table, Tag, Progress, Divider, Space, Button, Statistic, Modal, Switch, Pagination, message } from 'antd';
import { CalendarOutlined, UserOutlined, FileTextOutlined, AlertOutlined, EyeOutlined, TrophyOutlined, BookOutlined, LinkOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';
import { Link } from 'react-router-dom';
import PeerFeedbackChart from './PeerFeedbackChart';
import BuilderDetailsModal from './BuilderDetailsModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Grade colors for charts - updated to match detailed grading system
const gradeColors = {
  'A+': '#1e4d28', // Very dark green
  'A': '#38761d',  // Green
  'A-': '#4a9625', // Light green
  'B+': '#bf9002', // Gold
  'B': '#d4a419',  // Light gold
  'B-': '#e6b800', // Lighter gold
  'C+': '#b45f06', // Orange
  'C': '#cc6900'   // Light orange
};

// Helper function to detect if content is a URL
const isURL = (str) => {
  if (!str || typeof str !== 'string') return false;
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  return urlRegex.test(str);
};

// Helper function to parse and render analyzed content (from TaskSubmissionDetailPage)
const parseAnalysisForModal = (analysisString) => {
  if (!analysisString) return null;
  try {
    const cleanedString = analysisString
      .replace(/\n/g, '\n')
      .replace(/\t/g, '\t')
      .replace(/\\"/g, '"');
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    return {
        completion_score: null,
        criteria_met: [],
        areas_for_improvement: [],
        feedback: 'Error parsing analysis data.'
    };
  }
};

// Helper function to render analyzed content
const renderAnalyzedContent = (content) => {
  if (!content) return '-';
  const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].type === 'link' && typeof parsed[0].content === 'string') {
      const url = parsed[0].content;
       if (urlRegex.test(url)) { 
         return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{url}</a>;
       } else {
         return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}><pre>{JSON.stringify(parsed, null, 2)}</pre></Text>;
       }
    }
  } catch (e) {}
  if (typeof content === 'string' && urlRegex.test(content)) {
    return <a href={content} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{content}</a>;
  }
  return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}><pre>{content}</pre></Text>;
};

const WeeklySummary = () => {
  const [startDate, setStartDate] = useState(
    // Default to start of March 2025 to capture cohort activity
    dayjs('2025-03-01').startOf('day')
  );
  const [endDate, setEndDate] = useState(
    // Default to end of August 2025 to capture full cohort period
    dayjs('2025-08-31').endOf('day')
  );
  const [selectedLevel, setSelectedLevel] = useState('March 2025 - L2');
  const [availableLevels, setAvailableLevels] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [loadingTaskDetails, setLoadingTaskDetails] = useState(false);
  const [showNegativeFeedback, setShowNegativeFeedback] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalData, setModalData] = useState(null);
  
  // Add new state for detailed analysis modal
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [selectedAnalysisResponse, setSelectedAnalysisResponse] = useState(null);
  
  // Builders table state
  const [builders, setBuilders] = useState([]);
  const [buildersLoading, setBuildersLoading] = useState(false);
  const [buildersError, setBuildersError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState(null);

  // Fetch available levels
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch('/api/levels');
        const levels = await response.json();
        setAvailableLevels(levels);
      } catch (error) {
        console.error("Failed to fetch levels:", error);
      }
    };
    fetchLevels();
  }, []);

  // Fetch summary data when dates or level changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchDateRangeSummary();
    }
  }, [startDate, endDate, selectedLevel]);

  // Re-fetch data when level filter changes
  useEffect(() => {
    if (summaryData) {
      fetchBuildersData();
    }
  }, [selectedLevel]); // Will trigger when selectedLevel changes

  const fetchDateRangeSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        weekStartDate: startDate.format('YYYY-MM-DD'),
        weekEndDate: endDate.format('YYYY-MM-DD')
      });
      
      // Add level filter if selected
      if (selectedLevel) {
        params.append('level', selectedLevel);
      }

      const response = await fetch(`/api/weekly-summary?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setSummaryData(data);
      } else {
        console.error('Error fetching summary:', data.error);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
    
    // Fetch builders data for the same date range
    await fetchBuildersData();
  };

  // Fetch builders data
  const fetchBuildersData = async () => {
    setBuildersLoading(true);
    setBuildersError(null);
    try {
      const params = new URLSearchParams({
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD')
      });
      
      // Add level filter if selected
      if (selectedLevel) {
        params.append('level', selectedLevel);
      }

      const response = await fetch(`/api/builders?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch builders data');
      }
      const data = await response.json();
      setBuilders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching builders data:', error);
      setBuildersError('Failed to fetch builders data. Please try again later.');
      setBuilders([]);
      message.error('Failed to fetch builders data');
    } finally {
      setBuildersLoading(false);
    }
  };

  // Generate task effectiveness summary
  const generateTaskEffectivenessSummary = (task) => {
    const submissionRate = task.submission_rate || 0;
    const avgScore = task.avg_score || 0;
    const totalSubmissions = task.submissions_count || 0;
    
    let effectiveness = "Moderate";
    let color = "#bf9002";
    
    if (submissionRate >= 80 && avgScore >= 85) {
      effectiveness = "Highly Effective";
      color = "#38761d";
    } else if (submissionRate >= 60 && avgScore >= 75) {
      effectiveness = "Effective";
      color = "#38761d";
    } else if (submissionRate < 50 || avgScore < 70) {
      effectiveness = "Needs Improvement";
      color = "#990000";
    }
    
    return { effectiveness, color };
  };

  // Generate struggle areas based on feedback
  const getStruggleAreas = (feedback) => {
    if (!feedback) return "No specific struggles identified.";
    
    const commonStruggleKeywords = [
      'difficult', 'struggle', 'confused', 'unclear', 'hard', 'challenging',
      'error', 'bug', 'issue', 'problem', 'stuck', 'help', 'understand'
    ];
    
    const feedbackLower = feedback.toLowerCase();
    const foundStruggles = commonStruggleKeywords.filter(keyword => 
      feedbackLower.includes(keyword)
    );
    
    if (foundStruggles.length > 0) {
      return `Common challenges: ${foundStruggles.slice(0, 3).join(', ')}`;
    }
    
    return "No specific struggles identified from feedback.";
  };

  // Helper function to calculate overall grade distribution for all tasks in the week
  const calculateWeeklyGradeDistribution = (taskDetails) => {
    if (!taskDetails || taskDetails.length === 0) return {};
    
    const gradeCount = {};
    
    taskDetails.forEach(task => {
      // Sum up all grade counts from the task
      const grades = {
        'A+': task.grade_aplus_count || 0,
        'A': task.grade_a_count || 0,
        'A-': task.grade_aminus_count || 0,
        'B+': task.grade_bplus_count || 0,
        'B': task.grade_b_count || 0,
        'B-': task.grade_bminus_count || 0,
        'C+': task.grade_cplus_count || 0,
        'C': task.grade_c_count || 0,
      };
      
      Object.entries(grades).forEach(([grade, count]) => {
        gradeCount[grade] = (gradeCount[grade] || 0) + count;
      });
    });
    
    return gradeCount;
  };

  // Render grade distribution from individual response data (for modal)
  const renderGradeDistributionFromResponses = (responses) => {
    if (!responses || responses.length === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    // Count grades from individual responses - using exact same order as main table
    const grades = {
      'C': 0,
      'C+': 0,
      'B-': 0,
      'B': 0,
      'B+': 0,
      'A-': 0,
      'A': 0,
      'A+': 0
    };

    responses.forEach(response => {
      if (response.score !== null && response.score !== undefined && response.score > 0) {
        const grade = getLetterGrade(response.score);
        // Only count grades that exist in our gradeColors object
        if (grades.hasOwnProperty(grade)) {
          grades[grade]++;
        }
      }
    });

    const total = Object.values(grades).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    return (
      <div style={{ width: '120px' }}>
        <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#2d2d2d' }}>
          {Object.entries(grades).map(([grade, count]) => {
            if (count === 0) return null;
            const percentage = (count / total) * 100;
            return (
              <div
                key={grade}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: gradeColors[grade],
                  height: '100%'
                }}
                title={`${grade}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c8c8c', marginTop: '2px' }}>
          <span>C</span>
          <span>Total: {total}</span>
          <span>A+</span>
        </div>
      </div>
    );
  };

  // Render grade distribution as horizontal bar chart for individual tasks
  const renderGradeDistribution = (task) => {
    const grades = {
      'C': task.grade_c_count || 0,
      'C+': task.grade_cplus_count || 0,
      'B-': task.grade_bminus_count || 0,
      'B': task.grade_b_count || 0,
      'B+': task.grade_bplus_count || 0,
      'A-': task.grade_aminus_count || 0,
      'A': task.grade_a_count || 0,
      'A+': task.grade_aplus_count || 0
    };

    const total = Object.values(grades).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    return (
      <div style={{ width: '120px' }}>
        <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#2d2d2d' }}>
          {Object.entries(grades).map(([grade, count]) => {
            if (count === 0) return null;
            const percentage = (count / total) * 100;
            return (
              <div
                key={grade}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: gradeColors[grade],
                  height: '100%'
                }}
                title={`${grade}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c8c8c', marginTop: '2px' }}>
          <span>C</span>
          <span>Total: {total}</span>
          <span>A+</span>
        </div>
      </div>
    );
  };

  // Helper function to render builder grade distribution as horizontal bar
  const renderBuilderGradeDistribution = (record) => {
    const grades = {
      'C': record.grade_c_count || 0,
      'C+': record.grade_cplus_count || 0,
      'B-': record.grade_bminus_count || 0,
      'B': record.grade_b_count || 0,
      'B+': record.grade_bplus_count || 0,
      'A-': record.grade_aminus_count || 0,
      'A': record.grade_a_count || 0,
      'A+': record.grade_aplus_count || 0
    };

    const total = record.total_graded_tasks || 0;
    
    if (total === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    return (
      <div style={{ width: '120px' }}>
        <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#2d2d2d' }}>
          {Object.entries(grades).map(([grade, count]) => {
            if (count === 0) return null;
            const percentage = (count / total) * 100;
            return (
              <div
                key={grade}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: gradeColors[grade],
                  height: '100%'
                }}
                title={`${grade}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c8c8c', marginTop: '2px' }}>
          <span>C</span>
          <span>Total: {total}</span>
          <span>A+</span>
        </div>
      </div>
    );
  };

  // Helper function to render overall grade distribution as horizontal bar (like individual tasks)
  const renderOverallGradeDistribution = (taskDetails) => {
    if (!taskDetails || taskDetails.length === 0) return null;
    
    const grades = {
      'C': 0,
      'C+': 0,
      'B-': 0,
      'B': 0,
      'B+': 0,
      'A-': 0,
      'A': 0,
      'A+': 0
    };
    
    // Sum up all grade counts from all tasks
    taskDetails.forEach(task => {
      grades['C'] += task.grade_c_count || 0;
      grades['C+'] += task.grade_cplus_count || 0;
      grades['B-'] += task.grade_bminus_count || 0;
      grades['B'] += task.grade_b_count || 0;
      grades['B+'] += task.grade_bplus_count || 0;
      grades['A-'] += task.grade_aminus_count || 0;
      grades['A'] += task.grade_a_count || 0;
      grades['A+'] += task.grade_aplus_count || 0;
    });

    const total = Object.values(grades).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    return (
      <div style={{ width: '270px', marginTop: '4px', position: 'relative' }}>
        <div style={{ display: 'flex', height: '20px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#2d2d2d', position: 'relative' }}>
          {Object.entries(grades).map(([grade, count]) => {
            if (count === 0) return null;
            const percentage = (count / total) * 100;
            return (
              <div
                key={grade}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: gradeColors[grade],
                  height: '100%'
                }}
                title={`${grade}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
          
          {/* C label on left edge */}
          <div 
            style={{ 
              position: 'absolute',
              left: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              pointerEvents: 'none'
            }}
          >
            C
          </div>
          
          {/* A+ label on right edge */}
          <div 
            style={{ 
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              pointerEvents: 'none'
            }}
          >
            A+
          </div>
        </div>
      </div>
    );
  };

  // Helper function to get unique filter values
  const getUniqueTaskTitles = (taskDetails) => {
    if (!taskDetails || taskDetails.length === 0) return [];
    const uniqueTitles = [...new Set(taskDetails.map(task => task.task_title).filter(Boolean))];
    return uniqueTitles.sort().map(title => ({ text: title, value: title }));
  };

  const getUniqueDates = (taskDetails) => {
    if (!taskDetails || taskDetails.length === 0) return [];
    const uniqueDates = [...new Set(taskDetails.map(task => {
      const date = task.assigned_date?.value ? task.assigned_date.value : task.assigned_date;
      return dayjs(date).format('YYYY-MM-DD');
    }).filter(Boolean))];
    return uniqueDates.sort().map(date => ({ 
      text: dayjs(date).format('MMM DD, YYYY'), 
      value: date 
    }));
  };

  const getUniqueGrades = (taskDetails) => {
    if (!taskDetails || taskDetails.length === 0) return [];
    const uniqueGrades = [...new Set(taskDetails.map(task => {
      return getLetterGrade(task.avg_score);
    }).filter(Boolean))];
    // Sort grades in logical order
    const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'];
    return uniqueGrades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))
      .map(grade => ({ text: grade, value: grade }));
  };

  const handleViewDetails = async (taskRecord) => {
    setLoadingTaskDetails(true);
    setDetailsModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
      const params = new URLSearchParams({
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD')
      });
      
      // Add level filter if selected
      if (selectedLevel) {
        params.append('level', selectedLevel);
      }

      const response = await fetch(`/api/task-details/${taskRecord.task_id}?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch task details');
      }
      const taskDetails = await response.json();
      setSelectedTaskDetails(taskDetails);
    } catch (error) {
      console.error('Error fetching task details:', error);
      setSelectedTaskDetails(null);
    } finally {
      setLoadingTaskDetails(false);
    }
  };

  const taskColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '20%',
      sorter: (a, b) => (a.task_title || '').localeCompare(b.task_title || ''),
      filters: summaryData ? getUniqueTaskTitles(summaryData.taskDetails) : [],
      onFilter: (value, record) => record.task_title === value,
      filterSearch: true,
      ellipsis: true,
    },
    {
      title: 'Date',
      dataIndex: 'assigned_date',
      key: 'assigned_date',
      width: '12%',
      sorter: (a, b) => {
        const dateA = a.assigned_date?.value ? dayjs(a.assigned_date.value) : dayjs(a.assigned_date);
        const dateB = b.assigned_date?.value ? dayjs(b.assigned_date.value) : dayjs(b.assigned_date);
        return dateB.valueOf() - dateA.valueOf(); // Most recent first (descending)
      },
      defaultSortOrder: 'ascend', // Set as default sorted column (ascend because our sorter already reverses the order)
      filters: summaryData ? getUniqueDates(summaryData.taskDetails) : [],
      onFilter: (value, record) => {
        const recordDate = record.assigned_date?.value ? record.assigned_date.value : record.assigned_date;
        return dayjs(recordDate).format('YYYY-MM-DD') === value;
      },
      render: (date) => {
        if (!date) return <Text type="secondary">N/A</Text>;
        const dateValue = date?.value ? date.value : date;
        return <Text>{dayjs(dateValue).format('MMM DD, YYYY')}</Text>;
      },
    },
    {
      title: 'Submission Rate',
      dataIndex: 'submission_rate',
      key: 'submission_rate',
      width: '15%',
      sorter: (a, b) => (a.submission_rate || 0) - (b.submission_rate || 0),
      render: (rate) => (
        <Progress 
          percent={rate || 0} 
          size="small" 
          strokeColor={rate >= 80 ? '#38761d' : rate >= 60 ? '#bf9002' : '#990000'}
          style={{
            '--ant-progress-text-color': '#ffffff',
            '--ant-progress-text-font-size': '12px'
          }}
          format={(percent) => (
            <span style={{ color: '#ffffff', fontSize: '11px', fontWeight: 'bold' }}>
              {`${percent}%`}
            </span>
          )}
        />
      )
    },
    {
      title: 'Avg Score',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: '12%',
      sorter: (a, b) => (a.avg_score || 0) - (b.avg_score || 0),
      filters: [
        { text: 'A+', value: 'A+' },
        { text: 'A', value: 'A' },
        { text: 'A-', value: 'A-' },
        { text: 'B+', value: 'B+' },
        { text: 'B', value: 'B' },
        { text: 'B-', value: 'B-' },
        { text: 'C+', value: 'C+' },
        { text: 'C', value: 'C' },
        { text: 'F', value: 'F' }
      ],
      onFilter: (value, record) => {
        const grade = getLetterGrade(record.avg_score);
        return grade === value;
      },
      render: (score) => {
        const grade = getLetterGrade(score);
        const gradeClass = `grade-tag-${grade.replace(/[+-]/g, grade.includes('+') ? 'plus' : grade.includes('-') ? 'minus' : '')}`;
        return (
          <Tag className={gradeClass} style={{ minWidth: '40px', textAlign: 'center' }}>
            {grade}
          </Tag>
        );
      },
    },
    {
      title: 'Grade Distribution',
      key: 'grade_distribution',
      width: '15%',
      render: (_, record) => renderGradeDistribution(record)
    },
    {
      title: 'Details',
      key: 'details',
      width: '10%',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => handleViewDetails(record)}
        >
          View
        </Button>
      ),
    },
  ];

  const builderResponseColumns = [
    {
      title: 'Builder',
      dataIndex: 'builder_name',
      key: 'builder_name',
      width: '20%',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: '10%',
      render: (score) => {
        const grade = getLetterGrade(score);
        const gradeClass = `grade-tag-${grade.replace(/[+-]/g, grade.includes('+') ? 'plus' : grade.includes('-') ? 'minus' : '')}`;
        return (
          <Tag className={gradeClass} style={{ minWidth: '40px', textAlign: 'center' }}>
            {grade}
          </Tag>
        );
      },
    },
    {
      title: 'Submission Date',
      dataIndex: 'submission_date',
      key: 'submission_date',
      width: '15%',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY HH:mm') : 'N/A',
    },
    {
      title: 'Response',
      dataIndex: 'response',
      key: 'response',
      width: '55%',
      ellipsis: true,
      render: (response) => (
        <div style={{ maxHeight: '100px', overflow: 'auto' }}>
          {response || 'No response provided'}
        </div>
      ),
    },
  ];

  // Builders table sorting and utilities
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '⇅';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Sort builders based on current sort config
  const sortedBuilders = builders && builders.length > 0 ? [...builders].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortConfig.direction === 'asc' 
      ? aValue - bValue
      : bValue - aValue;
  }) : [];

  // Calculate max feedback count for scaling
  const maxFeedbackCount = builders && builders.length > 0 
    ? Math.max(...builders.map(builder => builder.total_peer_feedback_count || 0))
    : 100;

  // Builders table columns
  const buildersColumns = [
    {
      title: (
        <div onClick={() => handleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'name' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Builder Name {getSortIcon('name')}
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      width: '10%',
      render: (text, record) => (
        <Link to={`/builders/${record.user_id}`}>
          {text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
        </Link>
      ),
    },
    {
      title: (
        <div onClick={() => handleSort('attendance_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'attendance_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Attendance {getSortIcon('attendance_percentage')}
        </div>
      ),
      dataIndex: 'attendance_percentage',
      key: 'attendance_percentage',
      width: '10%',
      render: (text, record) => {
        const attendancePercentage = record.attendance_percentage || 0;
        const daysAttended = record.days_attended || 0;
        const totalDays = record.total_curriculum_days || 0;
        
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: attendancePercentage >= 90 ? '#52c41a' : attendancePercentage >= 80 ? '#faad14' : '#ff4d4f' }}>
              {attendancePercentage}%
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
              {daysAttended}/{totalDays} days
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('tasks_completed_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'tasks_completed_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Tasks Completed {getSortIcon('tasks_completed_percentage')}
        </div>
      ),
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      width: '10%',
      render: (text) => text === null ? '-' : `${text}%`,
    },
    {
      title: (
        <div onClick={() => handleSort('total_peer_feedback_count')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'total_peer_feedback_count' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Peer Feedback {getSortIcon('total_peer_feedback_count')}
        </div>
      ),
      dataIndex: 'total_peer_feedback_count',
      key: 'total_peer_feedback_count',
      width: '20%',
      render: (text, record) => {
        return (
          <div onClick={() => handleBuilderExpand('peer_feedback', record)} style={{ cursor: 'pointer' }}>
            <PeerFeedbackChart 
              total_peer_feedback_count={record.total_peer_feedback_count}
              positive_feedback_count={record.positive_feedback_count}
              neutral_feedback_count={record.neutral_feedback_count}
              negative_feedback_count={record.negative_feedback_count}
              maxFeedbackCount={maxFeedbackCount}
            />
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('total_graded_tasks')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'total_graded_tasks' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Overall Task Score {getSortIcon('total_graded_tasks')}
        </div>
      ),
      dataIndex: 'total_graded_tasks',
      key: 'total_graded_tasks',
      width: '20%',
      render: (text, record) => {
        return (
          <div onClick={() => handleBuilderExpand('allTasks', record)} style={{ cursor: 'pointer' }}>
            {renderBuilderGradeDistribution(record)}
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('video_tasks_completed')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'video_tasks_completed' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Video Tasks {getSortIcon('video_tasks_completed')}
        </div>
      ),
      dataIndex: 'video_tasks_completed',
      key: 'video_tasks_completed',
      width: '15%',
      render: (text, record) => {
        const videoCount = record.video_tasks_completed || 0;
        const avgScore = record.avg_video_score;
        
        if (videoCount === 0) {
          return <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', width: '100%', display: 'block' }}>No videos</Text>;
        }
        
        const grade = avgScore ? getLetterGrade(avgScore) : null;
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {videoCount} video{videoCount !== 1 ? 's' : ''}
            </div>
            {grade && (
              <Tag 
                className={getGradeTagClass(grade)} 
                style={{ fontSize: '11px', margin: 0, cursor: 'pointer' }}
                onClick={() => handleBuilderExpand('videoTasks', record)}
              >
                {grade}
              </Tag>
            )}
          </div>
        );
      },
    },
  ];

  // Handle builder modal expansion
  const handleBuilderExpand = async (type, record) => {
    setSelectedBuilder(record);
    setModalType(type);
    setModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDetailsLoading(true);
    setBuildersError(null);

    try {
      const response = await fetch(`/api/builders/${record.user_id}/details?type=${type}&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`);
      if (!response.ok) {
        throw new Error('Failed to fetch builder details');
      }
      const details = await response.json();
      setDetailsData(details);
    } catch (error) {
      console.error('Error fetching details:', error);
      setBuildersError('Failed to fetch builder details. Please try again later.');
      message.error('Failed to fetch details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Helper function to handle detailed analysis view
  const handleViewAnalysisDetails = (response) => {
    setSelectedAnalysisResponse(response);
    setAnalysisModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>
          <Text>Generating summary...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Summary</Title>
        <Space>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Select Start Date"
            format="YYYY-MM-DD"
            allowClear={false}
          />
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="Select End Date"
            format="YYYY-MM-DD"
            allowClear={false}
          />
          <Select
            value={selectedLevel}
            onChange={setSelectedLevel}
            style={{ minWidth: '200px' }}
            placeholder="Select Level"
          >
            {availableLevels.map(level => (
              <Option key={level} value={level}>{level}</Option>
            ))}
          </Select>
          <Button onClick={fetchDateRangeSummary}>Refresh</Button>
        </Space>
      </div>

      {error && (
        <Alert 
          message="Error Loading Summary" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginBottom: '24px' }}
        />
      )}

      {summaryData && (
        <>
          {/* Date Range Display */}
          <Card style={{ marginBottom: '24px' }}>
            <Title level={4}>
              {startDate.format('MMMM D, YYYY')} - {endDate.format('MMMM D, YYYY')}
              {selectedLevel !== 'March 2025 - L2' && ` (${selectedLevel})`} 
              <Text type="secondary" style={{ marginLeft: '12px', fontSize: '14px', fontWeight: 'normal' }}>
                ({endDate.diff(startDate, 'days') + 1} days)
              </Text>
            </Title>
          </Card>

          {/* Overall Summary Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Tasks Graded"
                  value={summaryData.summary.totalTasksAssigned}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Submission Rate"
                  value={(() => {
                    if (!summaryData.taskDetails || summaryData.taskDetails.length === 0) return 0;
                    const totalRate = summaryData.taskDetails.reduce((sum, task) => sum + (task.submission_rate || 0), 0);
                    return Math.round(totalRate / summaryData.taskDetails.length);
                  })()}
                  suffix="%"
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: (() => {
                    if (!summaryData.taskDetails || summaryData.taskDetails.length === 0) return '#8c8c8c';
                    const totalRate = summaryData.taskDetails.reduce((sum, task) => sum + (task.submission_rate || 0), 0);
                    const avgRate = totalRate / summaryData.taskDetails.length;
                    return avgRate >= 80 ? '#3f8600' : avgRate >= 60 ? '#bf9002' : '#cf1322';
                  })() }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Feedback"
                  value={summaryData.summary.totalFeedbackCount}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Negative Feedback"
                  value={summaryData.summary.negativeFeedbackCount}
                  prefix={<AlertOutlined />}
                  valueStyle={{ color: summaryData.summary.negativeFeedbackCount > 0 ? '#cf1322' : '#3f8600' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Task Details Table */}
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Task Analysis</span>
                {summaryData && summaryData.taskDetails && renderOverallGradeDistribution(summaryData.taskDetails)}
              </div>
            } 
            style={{ marginBottom: '24px' }}
          >
            <Table
              columns={taskColumns}
              dataSource={summaryData.taskDetails}
              rowKey="task_id"
              pagination={{
                pageSize: 5,
                showSizeChanger: false,
                showQuickJumper: false,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tasks`,
                size: 'default',
                showLessItems: false
              }}
            />
          </Card>


          {/* Builders Table Section */}
          <Card 
            title={
              <span style={{ color: '#ffffff' }}>
                <UserOutlined /> Builder Performance Overview
              </span>
            }
            style={{ marginBottom: '24px' }}
          >
            {buildersLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}
            {buildersError && <Alert message="Error loading builders data" description={buildersError} type="error" showIcon style={{ marginBottom: '16px'}}/>}
            {!buildersLoading && !buildersError && (
              <Table
                columns={buildersColumns}
                dataSource={sortedBuilders}
                rowKey="user_id"
                scroll={{ x: 'max-content' }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} builders`,
                  size: 'default',
                  showLessItems: false
                }}
                style={{ borderRadius: '8px' }}
              />
            )}
          </Card>

          {/* Peer Feedback Section - Moved to bottom */}
          {summaryData.allFeedbackDetails && summaryData.allFeedbackDetails.length > 0 && (
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ color: '#ffffff' }}>
                    <AlertOutlined /> Peer Feedback
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text style={{ color: '#ffffff', fontSize: '14px' }}>Show negative only</Text>
                    <Switch 
                      checked={showNegativeFeedback}
                      onChange={setShowNegativeFeedback}
                      size="small"
                    />
                  </div>
                </div>
              }
              style={{ marginBottom: '24px' }}
            >
              <Table
                columns={[
                  { 
                    title: 'Date', 
                    dataIndex: 'created_at', 
                    key: 'created_at', 
                    width: '15%',
                    render: (ts) => ts ? dayjs(ts?.value || ts).format('MMM D, YYYY') : 'N/A', 
                    sorter: (a, b) => dayjs(a.created_at?.value || a.created_at).unix() - dayjs(b.created_at?.value || b.created_at).unix(), 
                    sortDirections: ['descend', 'ascend']
                  },
                  { 
                    title: 'Reviewer',
                    dataIndex: 'reviewer_name',
                    key: 'reviewer_name',
                    width: '15%',
                    render: (text) => text || 'Unknown',
                    sorter: (a, b) => (a.reviewer_name || '').localeCompare(b.reviewer_name || ''),
                  },
                   { 
                    title: 'Recipient',
                    dataIndex: 'recipient_name',
                    key: 'recipient_name',
                    width: '15%',
                    render: (text) => text || 'Unknown',
                     sorter: (a, b) => (a.recipient_name || '').localeCompare(b.recipient_name || ''),
                  },
                  { 
                    title: 'Sentiment', 
                    dataIndex: 'sentiment_category',
                    key: 'sentiment_category', 
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
                      return <Tag className={sentimentClass}>{label || 'N/A'}</Tag>;
                    },
                  },
                  { 
                    title: 'Feedback', 
                    dataIndex: 'feedback_text', 
                    key: 'feedback_text', 
                    width: '40%',
                    render: (text) => <div style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</div> 
                  },
                ]}
                dataSource={showNegativeFeedback 
                  ? summaryData.allFeedbackDetails.filter(feedback => 
                      feedback.sentiment_category === 'Negative' || feedback.sentiment_category === 'Very Negative'
                    )
                  : summaryData.allFeedbackDetails
                }
                rowKey={(record) => `feedback-${String(record.created_at)}-${record.reviewer_name}-${record.recipient_name}`}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} feedback entries`,
                  size: 'default',
                  showLessItems: false
                }}
                scroll={{ y: 400 }}
                size="middle"
              />
            </Card>
          )}
        </>
      )}

      <Modal
        title={
          <Typography.Text style={{ color: 'var(--color-text-main)' }}>
            {selectedTaskDetails ? (
              <span>
                {selectedTaskDetails.task_title}
                {selectedTaskDetails.assigned_date && (
                  <span style={{ 
                    marginLeft: '12px', 
                    fontSize: '14px', 
                    fontWeight: 'normal',
                    color: 'var(--color-text-secondary)' 
                  }}>
                    ({(() => {
                      const dateValue = selectedTaskDetails.assigned_date?.value 
                        ? selectedTaskDetails.assigned_date.value 
                        : selectedTaskDetails.assigned_date;
                      return dayjs(dateValue).format('MMM DD, YYYY');
                    })()})
                  </span>
                )}
              </span>
            ) : (
              'Task Details'
            )}
          </Typography.Text>
        }
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedTaskDetails(null);
        }}
        footer={null}
        width={1200}
      >
        {loadingTaskDetails ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : selectedTaskDetails ? (
          <div>
            {/* Task Summary Section */}
            <Card title="Task Summary" style={{ marginBottom: '24px' }}>
              <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                <Col span={6}>
                  <Statistic 
                    title="Total Submissions" 
                    value={selectedTaskDetails.total_submissions || 0}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Submission Rate" 
                    value={`${Math.round(selectedTaskDetails.submission_rate || 0)}%`}
                    prefix={<UserOutlined />}
                    valueStyle={{ 
                      color: (selectedTaskDetails.submission_rate || 0) >= 80 ? '#3f8600' : 
                             (selectedTaskDetails.submission_rate || 0) >= 60 ? '#bf9002' : '#cf1322' 
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Average Score" 
                    value={selectedTaskDetails.avg_score?.toFixed(1) || '0.0'}
                    prefix={<CalendarOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <div>
                    <Statistic 
                      title="Average Grade" 
                      value={getLetterGrade(selectedTaskDetails.avg_score || 0)}
                      render={() => {
                        const grade = getLetterGrade(selectedTaskDetails.avg_score || 0);
                        const gradeClass = `grade-tag-${grade.replace(/[+-]/g, grade.includes('+') ? 'plus' : grade.includes('-') ? 'minus' : '')}`;
                        return (
                          <Tag className={gradeClass} style={{ minWidth: '40px', textAlign: 'center', fontSize: '16px', padding: '4px 8px' }}>
                            {grade}
                          </Tag>
                        );
                      }}
                    />
                    {/* Grade Distribution Visual */}
                    <div style={{ marginTop: '12px' }}>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        Grade Distribution
                      </Text>
                      {renderGradeDistributionFromResponses(selectedTaskDetails.responses || [])}
                    </div>
                  </div>
                </Col>
              </Row>
              
              {/* Task Description */}
              {selectedTaskDetails.task_description && (
                <div style={{ marginTop: '16px' }}>
                  <Text strong>Task Description:</Text>
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '12px', 
                    background: 'var(--color-bg-hover)', 
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <Text>{selectedTaskDetails.task_description}</Text>
                  </div>
                </div>
              )}
            </Card>

            {/* Task Analysis Table matching the main table format */}
            <Card title="Individual Submissions" style={{ marginBottom: '16px' }}>
              <Table
                columns={[
                  {
                    title: 'Builder',
                    dataIndex: 'builder_name',
                    key: 'builder_name',
                    width: '20%',
                    sorter: (a, b) => (a.builder_name || '').localeCompare(b.builder_name || ''),
                  },
                  {
                    title: 'Score',
                    dataIndex: 'score',
                    key: 'score',
                    width: '10%',
                    sorter: (a, b) => (a.score || 0) - (b.score || 0),
                    render: (score) => {
                      const grade = getLetterGrade(score);
                      const gradeClass = `grade-tag-${grade.replace(/[+-]/g, grade.includes('+') ? 'plus' : grade.includes('-') ? 'minus' : '')}`;
                      return (
                        <Tag className={gradeClass} style={{ minWidth: '40px', textAlign: 'center' }}>
                          {grade}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Response',
                    dataIndex: 'response',
                    key: 'response',
                    width: '40%',
                    ellipsis: true,
                    render: (response) => {
                      // Check if response is a URL
                      if (isURL(response)) {
                        return (
                          <a 
                            href={response} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                          >
                            <LinkOutlined style={{ color: 'var(--color-primary)' }} />
                            <Text style={{ color: 'var(--color-primary)' }}>Open Link</Text>
                          </a>
                        );
                      }
                      
                      // Try to parse JSON and check for links
                      try {
                        const parsed = JSON.parse(response);
                        if (Array.isArray(parsed) && parsed.length > 0 && 
                            typeof parsed[0] === 'object' && 
                            parsed[0].type === 'link' && 
                            typeof parsed[0].content === 'string' &&
                            isURL(parsed[0].content)) {
                          return (
                            <a 
                              href={parsed[0].content} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <LinkOutlined style={{ color: 'var(--color-primary)' }} />
                              <Text style={{ color: 'var(--color-primary)' }}>Open Link</Text>
                            </a>
                          );
                        }
                      } catch (e) {
                        // Not JSON, continue with regular rendering
                      }

                      // Regular text response
                      return (
                        <div style={{ 
                          maxHeight: '100px', 
                          overflow: 'auto',
                          wordWrap: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {response || 'No response provided'}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Details',
                    key: 'details',
                    width: '15%',
                    render: (_, record) => (
                      <Button
                        type="primary"
                        icon={<InfoCircleOutlined />}
                        size="small"
                        onClick={() => handleViewAnalysisDetails(record)}
                      >
                        View Analysis
                      </Button>
                    ),
                  },
                ]}
                dataSource={selectedTaskDetails.responses || []}
                rowKey={(record) => `${record.builder_id}_${record.submission_id}`}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: false,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} responses`,
                  size: 'default',
                  showLessItems: false
                }}
                size="middle"
              />
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">Failed to load task details</Text>
          </div>
        )}
      </Modal>

      {/* Builder Details Modal */}
      <BuilderDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
        data={detailsData}
        loading={detailsLoading}
        builder={selectedBuilder}
      />

      {/* Analysis Modal */}
      <Modal
        title={
          <Typography.Text style={{ color: 'var(--color-text-main)' }}>
            {selectedAnalysisResponse ? (
              <>
                {selectedTaskDetails?.task_title || 'Task Analysis'}
                <span style={{ 
                  marginLeft: '12px', 
                  fontSize: '14px', 
                  fontWeight: 'normal',
                  color: 'var(--color-text-secondary)' 
                }}>
                  - {selectedAnalysisResponse.builder_name}
                </span>
                {selectedAnalysisResponse.submission_date && (
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '14px', 
                    fontWeight: 'normal',
                    color: 'var(--color-text-secondary)' 
                  }}>
                    ({dayjs(selectedAnalysisResponse.submission_date).format('MMM DD, YYYY')})
                  </span>
                )}
              </>
            ) : (
              'Task Analysis'
            )}
          </Typography.Text>
        }
        open={analysisModalVisible}
        onCancel={() => setAnalysisModalVisible(false)}
        footer={null}
        width={1200}
      >
        {selectedAnalysisResponse ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Header Card with Score */}
            <Card bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '8px' }}>
                <Title level={4} style={{ marginBottom: '4px', color: 'var(--color-text-main)' }}>
                  {selectedTaskDetails?.task_title || 'Task Analysis'}
                </Title>
                <Text type="secondary" style={{ fontSize: '1em', color: 'var(--color-text-secondary)' }}>
                  {selectedAnalysisResponse.builder_name}
                  {selectedAnalysisResponse.score && (
                    <>
                      {', '}
                      <Tag className={getGradeTagClass(getLetterGrade(selectedAnalysisResponse.score))}>
                        {getLetterGrade(selectedAnalysisResponse.score)}
                      </Tag>
                    </>
                  )}
                </Text>
              </div>
            </Card>

            {/* Analyzed Content */}
            {selectedAnalysisResponse.response && (
              <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Analyzed Content</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                <div style={{ background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                  {renderAnalyzedContent(selectedAnalysisResponse.response)}
                </div>
              </Card>
            )}

            {(() => {
              const analysis = parseAnalysisForModal(selectedAnalysisResponse.analysis);
              const analysisError = !analysis || analysis.feedback === 'Error parsing analysis data.';
              
              if (analysisError) {
                return (
                  <Alert message="Error parsing analysis data" description="Some or all of the automated analysis could not be displayed." type="warning" showIcon />
                );
              }

              return (
                <>
                  {/* Submission Summary */}
                  {analysis?.submission_summary && (
                    <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Submission Summary</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                      <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                        {analysis.submission_summary}
                      </Paragraph>
                    </Card>
                  )}

                  {/* Feedback */}
                  {analysis?.feedback && (
                    <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Feedback</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                      <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                        {analysis.feedback}
                      </Paragraph>
                    </Card>
                  )}

                  {/* Criteria and Areas for Improvement */}
                  <Row gutter={[24, 24]}>
                    {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                      <Col xs={24} md={12}>
                        <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Criteria Met</Title>} bordered={false} style={{ height: '100%', background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                          <Space wrap size={[8, 8]}>
                            {analysis.criteria_met.map((item, index) => <Tag className="criteria-met-tag" key={`crit-${index}`}>{item}</Tag>)}
                          </Space>
                        </Card>
                      </Col>
                    )}

                    {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                      <Col xs={24} md={12}>
                        <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Areas for Improvement</Title>} bordered={false} style={{ height: '100%', background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                          <Space wrap size={[8, 8]}>
                            {analysis.areas_for_improvement.map((item, index) => <Tag className="areas-for-improvement-tag" key={`area-${index}`}>{item}</Tag>)}
                          </Space>
                        </Card>
                      </Col>
                    )}
                  </Row>

                  {/* Specific Findings */}
                  {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                    <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Specific Findings</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                      <Row gutter={[24, 24]}>
                        {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                          <Col xs={24} md={12} key={`find-cat-col-${catIndex}`}>
                            <div key={`find-cat-${catIndex}`} style={{ marginBottom: '20px', paddingLeft: '0', borderLeft: 'none', height: '100%' }}>
                              <Title level={5} style={{ textTransform: 'capitalize', marginBottom: '10px', textDecoration: 'underline', color: 'var(--color-text-main)'}}>{category.replace(/_/g, ' ')}</Title>
                              {findings?.strengths && findings.strengths.length > 0 && (
                                <div style={{ marginBottom: '10px' }}>
                                  <Text strong style={{color: 'var(--color-text-main)'}}>Strengths:</Text>
                                  <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc', color: 'var(--color-text-secondary)' }}>
                                    {findings.strengths.map((item, index) => <li key={`str-${catIndex}-${index}`} style={{ marginBottom: '4px'}}>{item}</li>)}
                                  </ul>
                                </div>
                              )}
                              {findings?.weaknesses && findings.weaknesses.length > 0 && (
                                <div>
                                  <Text strong style={{color: 'var(--color-text-main)'}}>Weaknesses:</Text>
                                  <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc', color: 'var(--color-text-secondary)' }}>
                                    {findings.weaknesses.map((item, index) => <li key={`weak-${catIndex}-${index}`} style={{ marginBottom: '4px'}}>{item}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  )}
                </>
              );
            })()}
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">Failed to load task analysis</Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WeeklySummary; 