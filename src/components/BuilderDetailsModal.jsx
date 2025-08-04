import React, { useEffect, useState } from 'react';
import { Modal, Table, Typography, Card, Space, Tag, Spin, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeColor, getGradeTagClass } from '../utils/gradingUtils';
import { Link, useNavigate } from 'react-router-dom';
import { parseAnalysis } from '../utils/parsingUtils';

const { Title, Text } = Typography;

const BuilderDetailsModal = ({ visible, onClose, type, data, loading, builder }) => {
  const navigate = useNavigate();

  console.log('BuilderDetailsModal rendering:', { visible, type, dataLength: data?.length });
  
  // Restore Work Product Columns to use parseAnalysis
  const workProductColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '20%',
      ellipsis: true, 
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
      width: '8%',
      render: (_, record) => { 
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-';
        }
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      }
    },
    {
      title: 'Feedback',
      key: 'feedback',
      width: '25%',
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
        return <Text style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-main)' }}>{feedback || '-'}</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '12%',
      render: (_, record) => {
        const handleViewDetails = () => {
          if (record.isVideoAnalysis && record.videoData?.video_id) {
            // Navigate to video analysis detail page
            navigate(`/video-analysis/${record.videoData.video_id}`);
          } else if (record.auto_id) {
            // Check if this is a fake auto_id for video analysis (starts with "video-")
            if (record.auto_id.startsWith('video-')) {
              const videoId = record.auto_id.replace('video-', '');
              navigate(`/video-analysis/${videoId}`);
            } else {
              // Navigate to regular submission detail page
              navigate(`/submission/${record.auto_id}`);
            }
          }
        };

        const isDisabled = !record.auto_id && !(record.isVideoAnalysis && record.videoData?.video_id);

        return (
          <Button 
            size="small" 
            onClick={handleViewDetails}
            disabled={isDisabled}
          >
            View Details
          </Button>
        );
      },
    },
  ];

  // Restore Comprehension Columns to use parseAnalysis
  const comprehensionColumns = [
    {
      title: 'Task',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '20%',
      ellipsis: true, 
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
      width: '8%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis); // Parse analysis field
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-';
        }
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      }
    },
    {
      title: 'Feedback', // Restore Feedback column
      key: 'feedback',
      width: '25%',
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
        return <Text style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-main)' }}>{feedback || '-'}</Text>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '12%',
      render: (_, record) => {
        const handleViewDetails = () => {
          if (record.isVideoAnalysis && record.videoData?.video_id) {
            // Navigate to video analysis detail page
            navigate(`/video-analysis/${record.videoData.video_id}`);
          } else if (record.auto_id) {
            // Check if this is a fake auto_id for video analysis (starts with "video-")
            if (record.auto_id.startsWith('video-')) {
              const videoId = record.auto_id.replace('video-', '');
              navigate(`/video-analysis/${videoId}`);
            } else {
              // Navigate to regular submission detail page
              navigate(`/submission/${record.auto_id}`);
            }
          }
        };

        const isDisabled = !record.auto_id && !(record.isVideoAnalysis && record.videoData?.video_id);

        return (
          <Button 
            size="small" 
            onClick={handleViewDetails}
            disabled={isDisabled}
          >
            View Details
          </Button>
        );
      },
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
            style={{ color: 'var(--color-primary)' }}
          >
            {text || 'Unknown'}
          </Link>
        ) : (
          <Text style={{ color: 'var(--color-text-main)' }}>{text || 'Unknown'}</Text>
        );
      }
    },
    {
      title: 'Feedback',
      dataIndex: 'feedback',
      key: 'feedback',
      width: '30%',
      render: (text) => (
        <Text style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-main)' }}>
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
        <Text style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-main)' }}>
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
  } else if (type === 'allTasks') {
    columnsToRender = workProductColumns; // Use same columns as work product for all tasks
  } else if (type === 'videoTasks') {
    // Create special columns for video tasks that include the video link
    const videoTaskColumns = [
      ...workProductColumns.slice(0, 2), // Task and Date columns
      {
        title: 'Video Link',
        key: 'video_link',
        width: '15%',
        render: (_, record) => {
          const analysis = parseAnalysis(record.analysis);
          const loomUrl = analysis?.loom_url;
          if (loomUrl) {
            return (
              <a href={loomUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                <span>🎥 View Video</span>
              </a>
            );
          }
          return '-';
        }
      },
      workProductColumns[2], // Score column
      workProductColumns[3], // Feedback column
      workProductColumns[4], // Actions column with "View Details" button
    ];
    columnsToRender = videoTaskColumns;
  } else {
    columnsToRender = peerFeedbackColumns;
  }

  return (
    <Modal
      title={<Typography.Text style={{ color: 'var(--color-text-main)' }}>{`${type === 'workProduct' ? 'Work Product' : type === 'comprehension' ? 'Comprehension' : type === 'allTasks' ? 'All Task Assessments' : type === 'videoTasks' ? 'Video Task Assessments' : 'Peer Feedback'} Details for ${selectedBuilder?.name || 'Builder'}`}</Typography.Text>}
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
    >
      {loadingDetails ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <p style={{ color: 'var(--color-text-main)' }}>Loading details...</p>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card>
            <Title level={4} style={{ color: 'var(--color-text-main)' }}>Summary</Title>
            <Space direction="vertical">
              <Text style={{ color: 'var(--color-text-main)' }}>
                Total Items: {detailsData?.length || 0}
              </Text>
            </Space>
          </Card>

          <Table
            columns={columnsToRender}
            dataSource={detailsData}
            rowKey={type === 'peer_feedback' ? 'feedback_id' : 'auto_id'}
            pagination={{ 
              pageSize: 5, 
              showSizeChanger: false,
              showQuickJumper: false,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              size: 'default',
              showLessItems: false
            }}
            tableLayout="fixed"
          />
        </Space>
      )}
    </Modal>
  );
};

export default BuilderDetailsModal; 