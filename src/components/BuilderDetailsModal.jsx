import React, { useEffect, useState } from 'react';
import { Modal, Table, Typography, Card, Space, Tag, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

// Restore parseAnalysis function
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
  
  // Restore Work Product Columns to use parseAnalysis
  const workProductColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '15%',
    },
    {
      title: 'Date',
      dataIndex: 'date', // Use date from API
      key: 'date',
      width: '10%',
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
    },
    {
      title: 'Score',
      key: 'score',
      width: '10%',
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-';
        }
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      }
    },
    {
      title: 'Assessment', // Restore Assessment column
      key: 'assessment',
      width: '25%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const areas = analysis?.areas_for_improvement;
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
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const feedback = analysis?.feedback;
        if (grade === 'Document Access Error') {
          return <Tag color="red">Document Access Error</Tag>;
        }
        if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
           return <Tag color="red">Tech issue</Tag>;
        }
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{feedback || '-'}</Text>;
      }
    },
  ];

  // Restore Comprehension Columns to use parseAnalysis
  const comprehensionColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '20%',
    },
    {
      title: 'Date',
      dataIndex: 'date', // Use date from API
      key: 'date',
      width: '10%',
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
    },
    {
      title: 'Score',
      key: 'score',
      width: '10%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-';
        }
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      }
    },
     {
      title: 'Assessment', // Restore Assessment column
      key: 'assessment',
      width: '30%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const areas = analysis?.areas_for_improvement;
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
      title: 'Feedback', // Restore Feedback column
      key: 'feedback',
      width: '30%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const feedback = analysis?.feedback;
        if (grade === 'Document Access Error') {
          return <Tag color="red">Document Access Error</Tag>;
        }
         if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
           return <Tag color="red">Tech issue</Tag>;
        }
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
    {
      title: 'Feedback',
      dataIndex: 'feedback',
      key: 'feedback',
      width: '30%',
      render: (text) => (
        <Text style={{ whiteSpace: 'pre-wrap' }}>
          {text || '-'}
        </Text>
      ),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      width: '30%',
      render: (text) => (
        <Text style={{ whiteSpace: 'pre-wrap' }}>
          {text || '-'}
        </Text>
      ),
    },
    {
      title: 'Sentiment',
      dataIndex: 'sentiment_label',
      key: 'sentiment_label',
      width: '10%',
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
        );
      },
    },
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: '15%',
      render: (date) => {
        if (!date) return 'N/A';
        try {
          if (typeof date === 'string') {
            return dayjs(date).format('MMM D, YYYY');
          } else if (date.value) {
            return dayjs(date.value).format('MMM D, YYYY');
          } else {
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
  const [detailsData, setDetailsData] = useState(data);
  const [loadingDetails, setLoadingDetails] = useState(loading);

  useEffect(() => {
    setSelectedBuilder(builder);
    setDetailsType(type);
    setDetailsData(data);
    setLoadingDetails(loading);
  }, [builder, type, data, loading]);

  let columnsToRender;
  if (type === 'workProduct') {
    columnsToRender = workProductColumns;
  } else if (type === 'comprehension') {
    columnsToRender = comprehensionColumns;
  } else {
    columnsToRender = peerFeedbackColumns;
  }

  return (
    <Modal
      title={`${type === 'workProduct' ? 'Work Product' : type === 'comprehension' ? 'Comprehension' : 'Peer Feedback'} Details for ${selectedBuilder?.name || 'Builder'}`}
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
                Total Items: {detailsData?.length || 0}
              </Text>
            </Space>
          </Card>

          <Table
            columns={columnsToRender}
            dataSource={detailsData}
            rowKey={type === 'peerFeedback' ? 'feedback_id' : 'task_id'}
            pagination={{ pageSize: 5 }}
            tableLayout="fixed"
          />
        </Space>
      )}
    </Modal>
  );
};

export default BuilderDetailsModal; 