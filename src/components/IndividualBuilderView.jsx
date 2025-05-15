import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  DatePicker, 
  Space, 
  Table, 
  Tag, 
  Spin, 
  Button, 
  Tabs,
  Divider,
  message,
  Empty
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import CompletionRateChart from './CompletionRateChart';
import UserPromptsChart from './UserPromptsChart';
import SentimentChart from './SentimentChart';
import './IndividualBuilderView.css';
import { getGradeTagClass } from '../utils/gradingUtils';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// Helper function to convert numeric score to letter grade
const getLetterGrade = (score) => {
  if (score === null || score === undefined) return 'F';
  
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'F';
  
  // Any valid submission gets at least a C
  if (numScore >= 0.9) return 'A+';
  if (numScore >= 0.8) return 'A';
  if (numScore >= 0.75) return 'A-';
  if (numScore >= 0.7) return 'B+';
  if (numScore >= 0.6) return 'B';
  if (numScore >= 0.55) return 'B-';
  if (numScore >= 0.5) return 'C+';
  return 'C'; // Minimum grade for any submission
};

// Helper function to get color for letter grade
const getGradeColor = (grade) => {
  if (grade === 'N/A') return 'default';
  
  const firstChar = grade.charAt(0);
  if (firstChar === 'A') return 'green';
  if (firstChar === 'B') return 'cyan';
  if (firstChar === 'C') return 'orange';
  if (firstChar === 'D' || firstChar === 'F') return 'red';
  
  return 'default';
};

// Helper function to get sentiment color
const getSentimentColor = (sentiment) => {
  if (!sentiment) return 'default';
  
  const sentimentMap = {
    'Very Positive': 'green',
    'Positive': 'cyan',
    'Neutral': 'blue',
    'Negative': 'orange',
    'Very Negative': 'red'
  };
  
  return sentimentMap[sentiment] || 'default';
};

const IndividualBuilderView = () => {
  const { builderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [peerFeedback, setPeerFeedback] = useState([]);
  const [workProduct, setWorkProduct] = useState([]);
  const [comprehension, setComprehension] = useState([]);
  const [weeklyData, setWeeklyData] = useState(null);
  const [promptsData, setPromptsData] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);

  useEffect(() => {
    const fetchBuilderInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBuilderData(
          dateRange[0].format('YYYY-MM-DD'),
          dateRange[1].format('YYYY-MM-DD')
        );
        const builderInfo = data.find(b => b.user_id.toString() === builderId);
        if (!builderInfo) {
          throw new Error('Builder not found');
        }
        setBuilder(builderInfo);
      } catch (error) {
        console.error('Error fetching builder info:', error);
        setError('Failed to fetch builder information');
        message.error('Failed to fetch builder information');
      } finally {
        setLoading(false);
      }
    };

    fetchBuilderInfo();
  }, [builderId]);

  useEffect(() => {
    if (builder) {
      fetchBuilderDetails();
    }
  }, [builder, dateRange]);

  const fetchBuilderDetails = async () => {
    if (!builder) return;
    
    try {
      // Fetch peer feedback
      const peerFeedbackData = await fetchBuilderDetails(
        builder.user_id,
        'peerFeedback',
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      setPeerFeedback(peerFeedbackData);
      
      // Fetch work product
      const workProductData = await fetchBuilderDetails(
        builder.user_id,
        'workProduct',
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      setWorkProduct(workProductData);
      
      // Fetch comprehension
      const comprehensionData = await fetchBuilderDetails(
        builder.user_id,
        'comprehension',
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      setComprehension(comprehensionData);
      
      // TODO: Fetch weekly data for charts
      // This would require new API endpoints or modifying existing ones
      // For now, we'll use mock data
      setWeeklyData({
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Tasks Completed',
            data: [5, 8, 12, 10],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          },
          {
            label: 'Completion Rate (%)',
            data: [60, 75, 85, 80],
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          }
        ]
      });
      
      setPromptsData({
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Prompts Sent',
            data: [25, 30, 45, 35],
            backgroundColor: 'rgba(54, 162, 235, 0.5)'
          }
        ]
      });
      
      setSentimentData({
        datasets: [
          {
            label: 'Daily Sentiment',
            data: [
              { x: '2023-01-01', y: 0.8 },
              { x: '2023-01-02', y: 0.6 },
              { x: '2023-01-03', y: 0.3 },
              { x: '2023-01-04', y: 0.7 },
              { x: '2023-01-05', y: 0.9 }
            ],
            backgroundColor: 'rgba(255, 99, 132, 0.5)'
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching builder details:', error);
      message.error('Failed to fetch builder details');
    }
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleBack = () => {
    navigate('/builders');
  };

  const peerFeedbackColumns = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => dayjs(text).format('MMM D, YYYY'),
    },
    {
      title: 'Sentiment',
      dataIndex: 'sentiment',
      key: 'sentiment',
      render: (text) => (
        <Tag color={getSentimentColor(text)}>{text}</Tag>
      ),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
    },
    {
      title: 'Raw Feedback',
      dataIndex: 'feedback_text',
      key: 'feedback_text',
    },
    {
      title: 'Reviewer',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
    },
  ];

  const workProductColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
    },
    {
      title: 'Score',
      dataIndex: 'scores',
      key: 'scores',
      render: (text) => {
        const grade = getLetterGrade(text);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Feedback',
      dataIndex: 'feedback',
      key: 'feedback',
    },
    {
      title: 'Date',
      dataIndex: 'grading_timestamp',
      key: 'grading_timestamp',
      render: (text) => dayjs(text).format('MMM D, YYYY'),
    },
  ];

  const comprehensionColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (text) => {
        const grade = getLetterGrade(text);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'grading_timestamp',
      key: 'grading_timestamp',
      render: (text) => dayjs(text).format('MMM D, YYYY'),
    },
  ];

  return (
    <div className="individual-builder-view">
      <Button 
        type="link" 
        icon={<ArrowLeftOutlined />} 
        onClick={handleBack}
        style={{ marginBottom: '16px' }}
      >
        Back to Builders
      </Button>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <p>Loading builder information...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Title level={3}>Error</Title>
          <Paragraph>{error}</Paragraph>
          <Button type="primary" onClick={handleBack}>
            <ArrowLeftOutlined /> Back to Builders
          </Button>
        </div>
      ) : !builder ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Empty description="Builder not found" />
          <Button type="primary" onClick={handleBack}>
            <ArrowLeftOutlined /> Back to Builders
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Title level={2}>{builder.name}</Title>
              </Col>
              <Col span={24}>
                <Space>
                  <Text>Date Range:</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    allowClear={false}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
          
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col span={24}>
              <Card title="Weekly Task Completion">
                {weeklyData ? (
                  <CompletionRateChart timeRange="30d" data={weeklyData} />
                ) : (
                  <Spin />
                )}
              </Card>
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col span={24}>
              <Card title="Weekly Prompts Sent">
                {promptsData ? (
                  <UserPromptsChart timeRange="30d" data={promptsData} />
                ) : (
                  <Spin />
                )}
              </Card>
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col span={24}>
              <Card title="Daily Sentiment">
                {sentimentData ? (
                  <SentimentChart timeRange="30d" data={sentimentData} />
                ) : (
                  <Spin />
                )}
              </Card>
            </Col>
          </Row>
          
          <Divider />
          
          <Tabs defaultActiveKey="1">
            <TabPane tab="Peer Feedback" key="1">
              <Card>
                <Table 
                  dataSource={peerFeedback} 
                  columns={peerFeedbackColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  locale={{ emptyText: 'No peer feedback available' }}
                />
              </Card>
            </TabPane>
            
            <TabPane tab="Work Product" key="2">
              <Card>
                <Table 
                  dataSource={workProduct} 
                  columns={workProductColumns} 
                  rowKey="task_id"
                  pagination={{ pageSize: 5 }}
                  locale={{ emptyText: 'No work product data available' }}
                />
              </Card>
            </TabPane>
            
            <TabPane tab="Comprehension" key="3">
              <Card>
                <Table 
                  dataSource={comprehension} 
                  columns={comprehensionColumns} 
                  rowKey="task_id"
                  pagination={{ pageSize: 5 }}
                  locale={{ emptyText: 'No comprehension data available' }}
                />
              </Card>
            </TabPane>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default IndividualBuilderView; 