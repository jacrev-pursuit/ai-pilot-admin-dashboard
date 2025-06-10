import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Typography, Spin, Alert, Table, Tag, Progress, Divider, Space, Button, Statistic, Modal } from 'antd';
import { CalendarOutlined, UserOutlined, FileTextOutlined, AlertOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

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

const WeeklySummary = () => {
  const [startDate, setStartDate] = useState(
    // Default to 7 days ago
    dayjs().subtract(6, 'days').startOf('day')
  );
  const [endDate, setEndDate] = useState(
    // Default to today
    dayjs().endOf('day')
  );
  const [selectedLevel, setSelectedLevel] = useState('March 2025 - L2');
  const [availableLevels, setAvailableLevels] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [loadingTaskDetails, setLoadingTaskDetails] = useState(false);

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

  const fetchDateRangeSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        weekStartDate: startDate.format('YYYY-MM-DD'),
        weekEndDate: endDate.format('YYYY-MM-DD'),
        ...(selectedLevel && { level: selectedLevel })
      });
      
      const response = await fetch(`/api/weekly-summary?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching date range summary:', error);
      setError(error.message);
    } finally {
      setLoading(false);
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
    
    try {
      const response = await fetch(`/api/task-details/${taskRecord.task_id}?startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`);
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>
          <Text>Generating weekly summary...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Date Range Analysis</Title>
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

          {/* Negative Feedback Section */}
          {summaryData.negativeFeedbackDetails.length > 0 && (
            <Card 
              title={
                <span style={{ color: '#ffffff' }}>
                  <AlertOutlined /> Negative Feedback This Week
                </span>
              }
            >
              {summaryData.negativeFeedbackDetails.map((feedback, index) => (
                <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #808080', borderRadius: '6px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Tag className="sentiment-tag-negative">{feedback.sentiment_category}</Tag>
                    <Text strong>{feedback.reviewer_name}</Text> → <Text strong>{feedback.recipient_name}</Text>
                    <Text type="secondary" style={{ float: 'right' }}>
                      {dayjs(feedback.created_at?.value || feedback.created_at).format('MMM D, HH:mm')}
                    </Text>
                  </div>
                  <Text>{feedback.feedback_text}</Text>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <Modal
        title={
          <div style={{ color: '#ffffff' }}>
            {selectedTaskDetails ? (
              <span>
                {selectedTaskDetails.task_title}
                {selectedTaskDetails.assigned_date && (
                  <span style={{ 
                    marginLeft: '12px', 
                    fontSize: '14px', 
                    fontWeight: 'normal',
                    color: '#bfc9d1' 
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
          </div>
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
                    width: '25%',
                    sorter: (a, b) => (a.builder_name || '').localeCompare(b.builder_name || ''),
                  },
                  {
                    title: 'Score',
                    dataIndex: 'score',
                    key: 'score',
                    width: '15%',
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
                    width: '60%',
                    ellipsis: true,
                    render: (response) => (
                      <div style={{ 
                        maxHeight: '100px', 
                        overflow: 'auto',
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {response || 'No response provided'}
                      </div>
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
    </div>
  );
};

export default WeeklySummary; 