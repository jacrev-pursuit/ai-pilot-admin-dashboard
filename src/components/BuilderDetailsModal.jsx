import React, { useEffect, useState } from 'react';
import { Modal, Table, Typography, Card, Space, Tag, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

// Function to safely parse analysis JSON
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    return JSON.parse(analysisString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    return null;
  }
};

const BuilderDetailsModal = ({ visible, onClose, type, data, loading, builder }) => {
  console.log('BuilderDetailsModal rendering:', { visible, type, dataLength: data?.length });
  
  const workProductColumns = [
    { 
      title: 'Task', 
      dataIndex: 'task_title', 
      key: 'task_title', 
      width: '15%',
    },
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      width: '10%',
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A', 
    },
    { 
      title: 'Score', 
      key: 'score', 
      width: '10%',
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;

        // Check error conditions
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-'; // Show dash instead of tag
        }
        
        // Default: Render normal grade
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      }
    },
    {
      title: 'Assessment',
      key: 'assessment',
      width: '25%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const areas = analysis?.areas_for_improvement;
        
        // Check conditions to render blank
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
            return '-';
        }
        
        const criteriaTags = (Array.isArray(criteria) && criteria.length > 0) 
          ? criteria.map(c => <Tag key={`crit-${c}`} color="green">{c}</Tag>) 
          : null;
        
        const areaTags = (Array.isArray(areas) && areas.length > 0)
          ? areas.map(a => {
              const label = a === "technical issue with analysis - please try again" ? "tech issue" : a;
              return <Tag key={`area-${a}`} color="red">{label}</Tag>;
            }) 
          : null;

        if (!criteriaTags && !areaTags) return '-';

        return (
          <Space wrap size={[0, 8]}>
            {criteriaTags}
            {areaTags}
          </Space>
        );
      }
    },
    { 
      title: 'Feedback', 
      key: 'feedback', 
      width: '40%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const feedback = analysis?.feedback;
        
        // Check special conditions first
        if (grade === 'Document Access Error') {
          return <Tag color="red">Document Access Error</Tag>; // Show tag here
        }
        if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
           return <Tag color="red">Tech issue</Tag>; // Show tag here
        }

        // Default rendering
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{feedback || '-'}</Text>;
      }
    },
  ];

  const comprehensionColumns = [
    { 
      title: 'Task', 
      dataIndex: 'task_title', 
      key: 'task_title', 
      width: '20%',
    },
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      width: '10%',
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A', 
    },
    { 
      title: 'Score', 
      key: 'score', 
      width: '10%',
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;

        // Check error conditions
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-'; // Show dash instead of tag
        }

        // Default: Render normal grade
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      }
    },
     {
      title: 'Assessment',
      key: 'assessment',
      width: '30%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const areas = analysis?.areas_for_improvement;

        // Check conditions to render blank
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
            return '-';
        }

        const criteriaTags = (Array.isArray(criteria) && criteria.length > 0) 
          ? criteria.map(c => <Tag key={`crit-${c}`} color="green">{c}</Tag>) 
          : null;
        
        const areaTags = (Array.isArray(areas) && areas.length > 0)
          ? areas.map(a => <Tag key={`area-${a}`} color="red">{a}</Tag>)
          : null;

        if (!criteriaTags && !areaTags) return '-';

        return (
          <Space wrap size={[0, 8]}>
            {criteriaTags}
            {areaTags}
          </Space>
        );
      }
    },
    { 
      title: 'Feedback', 
      key: 'feedback', 
      width: '30%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const feedback = analysis?.feedback;
        
        // Check special conditions first
        if (grade === 'Document Access Error') {
          return <Tag color="red">Document Access Error</Tag>; // Show tag here
        }
         if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
           return <Tag color="red">Tech issue</Tag>; // Show tag here
        }

        // Default rendering
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{feedback || '-'}</Text>;
      }
    },
  ];

  const peerFeedbackColumns = [
    {
      title: 'Reviewer',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
      width: '15%',
      render: (text, record) => {
        // NO onClick handler here
        return record.from_user_id ? (
          <Link
            to={`/builders/${record.from_user_id}`}
          >
            {text || 'Unknown'}
          </Link>
        ) : (
          text || 'Unknown' // Fallback if no ID
        );
      }
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
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (text) => (
        <Text style={{ whiteSpace: 'pre-wrap' }}> 
          {text || 'No summary available'}
        </Text>
      ),
    },
    {
      title: 'Sentiment',
      dataIndex: 'sentiment_label',
      key: 'sentiment_label',
      render: (label) => {
        const sentimentMap = {
          'Very Positive': 'green',
          'Positive': 'cyan',
          'Neutral': 'default',
          'Negative': 'orange',
          'Very Negative': 'red'
        };
        return (
          <Tag color={sentimentMap[label] || 'default'}>
            {label || 'N/A'}
          </Tag>
        )
      },
    },
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
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

  return (
    <Modal
      title={`${type === 'workProduct' ? 'Work Product' : type === 'comprehension' ? 'Comprehension' : 'Peer Feedback'} Details for ${builder?.name || 'Builder'}`}
      open={visible}
      onCancel={onClose}
      width={1200}
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
            </Space>
          </Card>

          <Table
            columns={type === 'workProduct' ? workProductColumns : type === 'comprehension' ? comprehensionColumns : peerFeedbackColumns}
            dataSource={data}
            rowKey={type === 'peerFeedback' ? 'id' : 'task_id'}
            pagination={{ pageSize: 5 }}
            tableLayout="fixed"
          />
        </Space>
      )}
    </Modal>
  );
};

export default BuilderDetailsModal; 