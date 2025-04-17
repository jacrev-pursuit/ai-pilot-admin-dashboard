import React, { useState, useEffect } from 'react';
import { Table, DatePicker, Space, Card, Button, Typography, message, Spin, Tag } from 'antd';
import { ExpandOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import BuilderDetailsModal from './BuilderDetailsModal';

const { Title } = Typography;
const { RangePicker } = DatePicker;

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

const BuilderView = () => {
  const [dateRange, setDateRange] = useState(null);
  const [builders, setBuilders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Tasks Completed',
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      render: (text) => `${text}%`,
    },
    {
      title: 'Prompts Sent',
      dataIndex: 'prompts_sent',
      key: 'prompts_sent',
    },
    {
      title: 'Daily Sentiment',
      dataIndex: 'daily_sentiment',
      key: 'daily_sentiment',
      render: (text, record) => renderDailySentiment(text, record),
    },
    {
      title: 'Peer Feedback Sentiment',
      dataIndex: 'peer_feedback_sentiment',
      key: 'peer_feedback_sentiment',
      render: (text, record) => (
        <Button 
          type="link" 
          icon={<ExpandOutlined />}
          onClick={() => handleExpand('peerFeedback', record)}
        >
          {renderPeerFeedbackSentiment(text, record)}
        </Button>
      ),
    },
    {
      title: 'Work Product Score',
      dataIndex: 'work_product_score',
      key: 'work_product_score',
      render: (text, record) => {
        return (
          <Button 
            type="link" 
            icon={<ExpandOutlined />}
            onClick={() => handleExpand('workProduct', record)}
          >
            {renderWorkProductScore(text)}
          </Button>
        );
      },
    },
    {
      title: 'Comprehension Score',
      dataIndex: 'comprehension_score',
      key: 'comprehension_score',
      render: (text, record) => {
        const grade = getLetterGrade(text);
        return (
          <Button 
            type="link" 
            icon={<ExpandOutlined />}
            onClick={() => handleExpand('comprehension', record)}
          >
            <Tag color={getGradeColor(grade)}>{grade}</Tag>
          </Button>
        );
      },
    },
  ];

  const handleExpand = async (type, record) => {
    setSelectedBuilder(record);
    setModalType(type);
    setModalVisible(true);
    setDetailsLoading(true);
    setError(null);

    try {
      const details = await fetchBuilderDetails(
        record.user_id,
        type,
        dateRange ? dateRange[0].format('YYYY-MM-DD') : '2000-01-01',
        dateRange ? dateRange[1].format('YYYY-MM-DD') : '2100-12-31'
      );
      setDetailsData(details);
    } catch (error) {
      console.error('Error fetching details:', error);
      setError('Failed to fetch builder details. Please try again later.');
      message.error('Failed to fetch details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDateRangeChange = async (dates) => {
    setDateRange(dates);
    if (dates) {
      await fetchData(dates[0], dates[1]);
    } else {
      await fetchData(null, null);
    }
  };

  const fetchData = async (startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBuilderData(
        startDate ? startDate.format('YYYY-MM-DD') : '2000-01-01',
        endDate ? endDate.format('YYYY-MM-DD') : '2100-12-31'
      );
      setBuilders(data);
    } catch (error) {
      console.error('Error fetching builder data:', error);
      setError('Failed to fetch builder data. Please try again later.');
      message.error('Failed to fetch builder data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(null, null);
  }, []);

  const renderDailySentiment = (sentiment, record) => {
    if (!record.prompts_sent || record.prompts_sent === 0) return <span>No data</span>;
    if (!sentiment || sentiment === 'null' || sentiment === 'undefined' || sentiment === '') return <span>No data</span>;
    
    const sentimentMap = {
      'Very Positive': { color: 'green', text: 'Very Positive' },
      'Positive': { color: 'green', text: 'Positive' },
      'Neutral': { color: 'blue', text: 'Neutral' },
      'Negative': { color: 'orange', text: 'Negative' },
      'Very Negative': { color: 'red', text: 'Very Negative' }
    };
    const sentimentInfo = sentimentMap[sentiment] || { color: 'default', text: sentiment };
    return <Tag color={sentimentInfo.color}>{sentimentInfo.text}</Tag>;
  };

  const renderPeerFeedbackSentiment = (sentiment, record) => {
    if (!sentiment || sentiment === 'null' || sentiment === 'undefined' || sentiment === '') return <span>No data</span>;
    
    const sentimentMap = {
      'Very Positive': { color: 'green', text: 'Very Positive' },
      'Positive': { color: 'green', text: 'Positive' },
      'Neutral': { color: 'blue', text: 'Neutral' },
      'Negative': { color: 'orange', text: 'Negative' },
      'Very Negative': { color: 'red', text: 'Very Negative' }
    };
    const sentimentInfo = sentimentMap[sentiment] || { color: 'default', text: sentiment };
    return <Tag color={sentimentInfo.color}>{sentimentInfo.text}</Tag>;
  };

  const renderWorkProductScore = (score) => {
    if (!score) return <span>No data</span>;
    const grade = getLetterGrade(score);
    const color = getGradeColor(grade);
    return <Tag color={color}>{grade}</Tag>;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Builder Performance Overview</Title>
      
      <Card style={{ marginBottom: '24px' }}>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            allowClear={true}
          />
        </Space>
      </Card>

      {error && (
        <Card style={{ marginBottom: '24px' }}>
          <Typography.Text type="danger">{error}</Typography.Text>
        </Card>
      )}

      <Table
        columns={columns}
        dataSource={builders}
        loading={loading}
        rowKey="user_id"
      />

      <BuilderDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
        data={detailsData}
        loading={detailsLoading}
        builder={selectedBuilder}
      />
    </div>
  );
};

export default BuilderView; 