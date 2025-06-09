import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Typography, Spin, Alert, Table, Tag, Progress, Divider, Space, Button, Statistic } from 'antd';
import { Pie, Bar } from 'react-chartjs-2';
import { CalendarOutlined, UserOutlined, FileTextOutlined, AlertOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { chartContainer, baseChartOptions, chartColors } from './ChartStyles';
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
  const [weekStartDate, setWeekStartDate] = useState(
    // Default to most recent Monday
    dayjs().day(1).subtract(dayjs().day() === 0 ? 6 : dayjs().day() - 1, 'days')
  );
  const [selectedLevel, setSelectedLevel] = useState('March 2025 - L2');
  const [availableLevels, setAvailableLevels] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Fetch summary data when date or level changes
  useEffect(() => {
    fetchWeeklySummary();
  }, [weekStartDate, selectedLevel]);

  const fetchWeeklySummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        weekStartDate: weekStartDate.format('YYYY-MM-DD'),
        ...(selectedLevel && { level: selectedLevel })
      });
      
      const response = await fetch(`/api/weekly-summary?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process grade distribution for pie chart
  const getGradeDistributionChart = (taskDetails) => {
    const totalGrades = taskDetails.reduce((acc, task) => {
      acc['A+'] += task.grade_aplus_count || 0;
      acc.A += task.grade_a_count || 0;
      acc['A-'] += task.grade_aminus_count || 0;
      acc['B+'] += task.grade_bplus_count || 0;
      acc.B += task.grade_b_count || 0;
      acc['B-'] += task.grade_bminus_count || 0;  
      acc['C+'] += task.grade_cplus_count || 0;
      acc.C += task.grade_c_count || 0;
      return acc;
    }, { 'A+': 0, A: 0, 'A-': 0, 'B+': 0, B: 0, 'B-': 0, 'C+': 0, C: 0 });

    return {
      labels: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'],
      datasets: [{
        data: [totalGrades['A+'], totalGrades.A, totalGrades['A-'], totalGrades['B+'], totalGrades.B, totalGrades['B-'], totalGrades['C+'], totalGrades.C],
        backgroundColor: [
          gradeColors['A+'], gradeColors.A, gradeColors['A-'], 
          gradeColors['B+'], gradeColors.B, gradeColors['B-'], 
          gradeColors['C+'], gradeColors.C
        ],
        borderWidth: 0
      }]
    };
  };

  // Get submission rate chart
  const getSubmissionRateChart = (taskDetails) => {
    return {
      labels: taskDetails.map(task => task.task_title?.substring(0, 20) + '...'),
      datasets: [{
        label: 'Submission Rate (%)',
        data: taskDetails.map(task => task.submission_rate || 0),
        backgroundColor: taskDetails.map(task => {
          const rate = task.submission_rate || 0;
          if (rate >= 80) return '#38761d'; // Green
          if (rate >= 60) return '#bf9002'; // Yellow
          if (rate >= 40) return '#b45f06'; // Orange
          return '#990000'; // Red
        }),
        borderWidth: 0
      }]
    };
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

  // Render grade distribution as horizontal bar chart
  const renderGradeDistribution = (task) => {
    const grades = {
      'A+': task.grade_aplus_count || 0,
      'A': task.grade_a_count || 0,
      'A-': task.grade_aminus_count || 0,
      'B+': task.grade_bplus_count || 0,
      'B': task.grade_b_count || 0,
      'B-': task.grade_bminus_count || 0,
      'C+': task.grade_cplus_count || 0,
      'C': task.grade_c_count || 0
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
          <span>A+</span>
          <span>Total: {total}</span>
          <span>C</span>
        </div>
      </div>
    );
  };

  const taskColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '12%',
    },
    {
      title: 'Date',
      dataIndex: 'assigned_date',
      key: 'assigned_date',
      width: '8%',
      render: (date) => {
        if (!date) return <Text type="secondary">-</Text>;
        
        // Handle different date formats that might come from BigQuery
        let parsedDate;
        if (date.value) {
          // Handle BigQuery timestamp format
          parsedDate = dayjs(date.value);
        } else if (typeof date === 'string') {
          // Handle string date
          parsedDate = dayjs(date);
        } else {
          // Handle other formats
          parsedDate = dayjs(date);
        }
        
        // Check if date is valid
        if (!parsedDate.isValid()) {
          console.log('Invalid date received:', date);
          return <Text type="secondary">-</Text>;
        }
        
        return <Text style={{ fontSize: '11px' }}>{parsedDate.format('MM/DD')}</Text>;
      }
    },
    {
      title: 'Submission Rate',
      dataIndex: 'submission_rate',
      key: 'submission_rate',
      width: '12%',
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
      width: '5%',
      render: (score) => {
        const grade = getLetterGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      }
    },
    {
      title: 'Grade Distribution',
      key: 'grade_distribution',
      width: '13%',
      render: (_, record) => renderGradeDistribution(record)
    },
    {
      title: 'Effectiveness',
      key: 'effectiveness',
      width: '22%',
      render: (_, record) => {
        const { effectiveness, color } = generateTaskEffectivenessSummary(record);
        return <Tag style={{ color: 'white', backgroundColor: color }}>{effectiveness}</Tag>;
      }
    },
    {
      title: 'Struggle Areas',
      key: 'struggles',
      width: '28%',
      render: (_, record) => (
        <Text style={{ fontSize: '12px' }}>
          {getStruggleAreas(record.all_feedback)}
        </Text>
      )
    }
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
        <Title level={2}>Weekly Summary Analysis</Title>
        <Space>
          <DatePicker
            value={weekStartDate}
            onChange={setWeekStartDate}
            placeholder="Select Week Start"
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
          <Button onClick={fetchWeeklySummary}>Refresh</Button>
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
          {/* Week Range Display */}
          <Card style={{ marginBottom: '24px' }}>
            <Title level={4}>
              Week of {dayjs(summaryData.weekStart).format('MMMM D')} - {dayjs(summaryData.weekEnd).format('MMMM D, YYYY')}
              {summaryData.level !== 'all' && ` (${summaryData.level})`}
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
                  title="Active Builders"
                  value={summaryData.summary.activeBuilders}
                  prefix={<UserOutlined />}
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

          {/* Charts Row */}
          {summaryData.taskDetails.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} md={12}>
                <Card title="Overall Grade Distribution">
                  <div style={{ ...chartContainer, height: '300px' }}>
                    <Pie 
                      data={getGradeDistributionChart(summaryData.taskDetails)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { 
                            position: 'right',
                            labels: { color: chartColors.text }
                          }
                        }
                      }}
                    />
                  </div>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Task Submission Rates">
                  <div style={{ ...chartContainer, height: '300px' }}>
                    <Bar
                      data={getSubmissionRateChart(summaryData.taskDetails)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color: chartColors.text }
                          },
                          x: { ticks: { color: chartColors.text } }
                        },
                        plugins: {
                          legend: { display: false }
                        }
                      }}
                    />
                  </div>
                </Card>
              </Col>
            </Row>
          )}

          {/* Task Details Table */}
          <Card title="Task Analysis" style={{ marginBottom: '24px' }}>
            <Table
              columns={taskColumns}
              dataSource={summaryData.taskDetails}
              rowKey="task_id"
              pagination={false}
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
    </div>
  );
};

export default WeeklySummary; 