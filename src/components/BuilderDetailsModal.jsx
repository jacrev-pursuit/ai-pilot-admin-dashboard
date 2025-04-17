import React, { useEffect, useState } from 'react';
import { Modal, Table, Typography, Card, Space, Tag, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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

const BuilderDetailsModal = ({ visible, onClose, type, data, loading, builder }) => {
  console.log('BuilderDetailsModal rendering:', { visible, type, dataLength: data?.length });
  
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
      render: (score) => {
        const grade = getLetterGrade(score);
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Feedback',
      dataIndex: 'feedback',
      key: 'feedback',
      render: (text) => (
        <Text>
          {text || 'No feedback provided'}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'grading_timestamp',
      key: 'grading_timestamp',
      render: (date) => {
        if (!date) return 'N/A';
        try {
          // Handle different date formats
          if (typeof date === 'string') {
            // If it's a string, try to parse it
            return dayjs(date).format('MMM D, YYYY');
          } else if (date.value) {
            // If it's a BigQuery timestamp object
            return dayjs(date.value).format('MMM D, YYYY');
          } else {
            // Fallback to standard Date parsing
            return new Date(date).toLocaleDateString();
          }
        } catch (error) {
          console.error('Error parsing date:', date, error);
          return 'Invalid Date';
        }
      },
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
      render: (score) => {
        const grade = getLetterGrade(score);
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'grading_timestamp',
      key: 'grading_timestamp',
      render: (date) => {
        if (!date) return 'N/A';
        try {
          // Handle different date formats
          if (typeof date === 'string') {
            // If it's a string, try to parse it
            return dayjs(date).format('MMM D, YYYY');
          } else if (date.value) {
            // If it's a BigQuery timestamp object
            return dayjs(date.value).format('MMM D, YYYY');
          } else {
            // Fallback to standard Date parsing
            return new Date(date).toLocaleDateString();
          }
        } catch (error) {
          console.error('Error parsing date:', date, error);
          return 'Invalid Date';
        }
      },
    },
  ];

  const peerFeedbackColumns = [
    {
      title: 'Reviewer',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
    },
    {
      title: 'Feedback',
      dataIndex: 'feedback_text',
      key: 'feedback_text',
      render: (text) => (
        <Text>
          {text || 'No feedback provided'}
        </Text>
      ),
    },
    {
      title: 'Sentiment',
      dataIndex: 'sentiment',
      key: 'sentiment',
      render: (sentiment) => (
        <Tag color={
          sentiment === 'Very Positive' ? 'green' :
          sentiment === 'Positive' ? 'cyan' :
          sentiment === 'Neutral' ? 'default' :
          sentiment === 'Negative' ? 'orange' :
          sentiment === 'Very Negative' ? 'red' :
          'default'
        }>
          {sentiment || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => {
        if (!date) return 'N/A';
        try {
          // Handle different date formats
          if (typeof date === 'string') {
            // If it's a string, try to parse it
            return dayjs(date).format('MMM D, YYYY');
          } else if (date.value) {
            // If it's a BigQuery timestamp object
            return dayjs(date.value).format('MMM D, YYYY');
          } else {
            // Fallback to standard Date parsing
            return new Date(date).toLocaleDateString();
          }
        } catch (error) {
          console.error('Error parsing date:', date, error);
          return 'Invalid Date';
        }
      },
    },
  ];

  const [selectedBuilder, setSelectedBuilder] = useState(builder);
  const [detailsType, setDetailsType] = useState(type);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [detailsData, setDetailsData] = useState(data);
  const [loadingDetails, setLoadingDetails] = useState(loading);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelectedBuilder(builder);
    setDetailsType(type);
    setDetailsData(data);
    setLoadingDetails(loading);
  }, [builder, type, data, loading]);

  // Calculate average grade
  const getAverageGrade = () => {
    if (!data || data.length === 0) return 'N/A';
    
    const totalScore = data.reduce((acc, curr) => {
      const score = type === 'workProduct' ? parseFloat(curr.scores || 0) : parseFloat(curr.score || 0);
      return acc + (isNaN(score) ? 0 : score);
    }, 0);
    
    const avgScore = totalScore / data.length;
    return getLetterGrade(avgScore);
  };

  return (
    <Modal
      title={`${type === 'workProduct' ? 'Work Product' : type === 'comprehension' ? 'Comprehension' : 'Peer Feedback'} Details for ${builder?.name || 'Builder'}`}
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={null}
    >
      {loadingDetails ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <p>Loading details...</p>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card>
            <Title level={4}>Summary</Title>
            <Space direction="vertical">
              <Text>
                Total {type === 'workProduct' ? 'Tasks' : type === 'comprehension' ? 'Questions' : 'Feedback Items'}: {data?.length || 0}
              </Text>
              <Text>
                Average Grade: <Tag color={getGradeColor(getAverageGrade())}>{getAverageGrade()}</Tag>
              </Text>
            </Space>
          </Card>

          <Table
            columns={type === 'workProduct' ? workProductColumns : type === 'comprehension' ? comprehensionColumns : peerFeedbackColumns}
            dataSource={data}
            rowKey={type === 'peerFeedback' ? 'id' : 'task_id'}
            pagination={{ pageSize: 5 }}
          />
        </Space>
      )}
    </Modal>
  );
};

export default BuilderDetailsModal; 