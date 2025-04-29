import React, { useState, useEffect } from 'react';
import { Table, Spin, Alert, Tag, Space, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { getLetterGrade, getGradeColor } from '../utils/gradingUtils';

const { Text } = Typography;

// Helper function to parse the 'analysis' JSON string
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    // Replace escaped newlines and tabs, handle potential extra escapes
    const cleanedString = analysisString
      .replace(/\n/g, '\n')
      .replace(/\t/g, '\t')
      .replace(/\\"/g, '\"'); // Handle double escapes if present
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    // Return a default object or null to prevent crashing the component
    return {
        completion_score: null,
        criteria_met: [],
        areas_for_improvement: [],
        feedback: 'Error parsing analysis data.'
    };
  }
};


const AllTaskAnalysisView = () => {
  const [analysisData, setAnalysisData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 }); // Added total

  const fetchData = async (page = 1, pageSize = 15) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Add pagination query parameters later: ?page=${page}&pageSize=${pageSize}
      const response = await fetch(`/api/tasks/all-analysis`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch task analysis data');
      }
      const data = await response.json();
      setAnalysisData(data);
      // Update total count for pagination (assuming API might provide it later)
      // For now, use the length of the fetched data for the current page
      setPagination(prev => ({ ...prev, current: page, pageSize: pageSize, total: data.length })); // Simplified total for now
    } catch (err) {
      console.error('Error fetching task analysis data:', err);
      setError(err.message || 'Failed to load data');
      message.error('Failed to load task analysis data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Fetch initial data on component mount
  }, []);

  const handleTableChange = (newPagination) => {
     // fetchData(newPagination.current, newPagination.pageSize);
     // For now, just update the pagination state as we load all data at once
     setPagination(prev => ({
        ...prev,
        current: newPagination.current,
        pageSize: newPagination.pageSize
     }));
  };


  const columns = [
    {
      title: 'Builder',
      dataIndex: 'user_name',
      key: 'user_name',
      width: '12%',
       render: (name, record) => (
        record.user_id ? <Link to={`/builders/${record.user_id}`}>{name || 'Unknown'}</Link> : name || 'Unknown'
      ),
      sorter: (a, b) => (a.user_name || '').localeCompare(b.user_name || ''),
    },
    {
      title: 'Task Title',
      dataIndex: 'task_title',
      key: 'task_title',
      width: '15%',
      sorter: (a, b) => (a.task_title || '').localeCompare(b.task_title || ''),
    },
     {
      title: 'Type',
      dataIndex: 'learning_type',
      key: 'learning_type',
      width: '8%',
      sorter: (a, b) => (a.learning_type || '').localeCompare(b.learning_type || ''),
    },
    {
      title: 'Date',
      dataIndex: 'grading_timestamp', // Using grading_timestamp for sorting
      key: 'date',
      width: '10%',
      render: (_, record) => {
          const dateToShow = record.grading_timestamp || record.date; // Prefer grading_timestamp
          return dateToShow ? dayjs(dateToShow?.value || dateToShow).format('MMM D, YYYY HH:mm') : 'N/A';
      },
       sorter: (a, b) => dayjs(a.grading_timestamp?.value || a.grading_timestamp).unix() - dayjs(b.grading_timestamp?.value || b.grading_timestamp).unix(),
       defaultSortOrder: 'descend',
    },
    {
      title: 'Score',
      key: 'score',
      width: '8%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        // Special handling for 'Submission received' or 'Document Access Error'
        if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
          return '-'; // Don't show a grade tag
        }
        return <Tag color={getGradeColor(grade)}>{grade}</Tag>;
      },
       sorter: (a, b) => {
           const scoreA = parseAnalysis(a.analysis)?.completion_score ?? -Infinity;
           const scoreB = parseAnalysis(b.analysis)?.completion_score ?? -Infinity;
           return scoreA - scoreB;
       },
    },
    {
      title: 'Assessment',
      key: 'assessment',
      width: '22%',
      render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const score = analysis?.completion_score;
        const grade = getLetterGrade(score);
        const criteria = analysis?.criteria_met;
        const areas = analysis?.areas_for_improvement;

        // Handle special cases first
        if (grade === 'Document Access Error') {
            return <Tag color="red">Document Access Error</Tag>;
        }
         if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
           return <Tag color="orange">Tech issue</Tag>; // Show as tech issue tag
        }

        // Render criteria and areas tags
        const criteriaTags = (Array.isArray(criteria) && criteria.length > 0)
          ? criteria.map(c => <Tag key={`crit-${record.analysis_id}-${c}`} color="green">{c}</Tag>)
          : null;
        const areaTags = (Array.isArray(areas) && areas.length > 0)
          ? areas.map(a => {
              const label = a === "technical issue with analysis - please try again" ? "Tech Issue" : a;
              return <Tag key={`area-${record.analysis_id}-${a}`} color="red">{label}</Tag>;
            })
          : null;

        if (!criteriaTags && !areaTags) return '-'; // Return dash if no tags

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
      width: '25%',
       render: (_, record) => {
        const analysis = parseAnalysis(record.analysis);
        const feedback = analysis?.feedback;
        // Check for special cases based on grade/criteria from analysis
         const score = analysis?.completion_score;
         const grade = getLetterGrade(score);
         const criteria = analysis?.criteria_met;
         if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
             return '-'; // No feedback text needed for these cases
         }
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{feedback || '-'}</Text>;
      },
       ellipsis: true, // Add ellipsis for potentially long feedback
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Typography.Title level={2} style={{ marginBottom: '20px' }}>All Task Analyses</Typography.Title>
      {error && (
        <Alert message="Error" description={error} type="error" showIcon style={{ marginBottom: '16px'}} />
      )}
      <Table
        columns={columns}
        dataSource={analysisData}
        loading={loading}
        rowKey="analysis_id" // Use the unique analysis ID as the key
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }} // Enable horizontal scroll
        size="small"
      />
    </div>
  );
};

export default AllTaskAnalysisView; 