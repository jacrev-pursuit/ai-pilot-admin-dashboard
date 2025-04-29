import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Alert, Typography, Space, Tag, Button, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade } from '../utils/gradingUtils'; // Assuming gradingUtils is in utils folder

const { Title, Text, Paragraph } = Typography;

// Helper function to parse the 'analysis' JSON string
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    const cleanedString = analysisString
      .replace(/\n/g, '\n')
      .replace(/\t/g, '\t')
      .replace(/\\"/g, '\"');
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
         return <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>;
       } else {
         return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(parsed, null, 2)}</pre></Text>;
       }
    }
  } catch (e) {}
  if (typeof content === 'string' && urlRegex.test(content)) {
    return <a href={content} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{content}</pre></Text>;
};

const TaskSubmissionDetailPage = () => {
  const { autoId } = useParams(); // Use autoId from URL
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubmissionDetails = async () => {
      if (!autoId) { // Check for autoId
        setError('No submission ID provided.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/submission/${autoId}`); // Use autoId in API call
        if (!response.ok) {
          if (response.status === 404) {
             throw new Error('Submission not found.');
          } else {
             const errorData = await response.json();
             throw new Error(errorData.error || 'Failed to fetch submission details');
          }
        }
        const data = await response.json();
        setSubmission(data);
      } catch (err) {
        console.error('Error fetching submission details:', err);
        setError(err.message || 'Failed to load submission details');
        message.error(err.message || 'Failed to load submission details');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissionDetails();
  }, [autoId]); // Depend on autoId

  const analysis = submission ? parseAnalysis(submission.analysis) : null;
  const analysisError = !analysis || analysis.feedback === 'Error parsing analysis data.';

  return (
    <div style={{ padding: '20px' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} // Go back to previous page
        style={{ marginBottom: '20px' }}
      >
        Back
      </Button>

      <Title level={2}>Task Submission Details</Title>

      {loading && <Spin size="large" style={{ display: 'block', marginTop: '50px' }} />}
      {error && <Alert message="Error" description={error} type="error" showIcon style={{ marginTop: '20px'}} />}
      
      {submission && !loading && !error && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4} style={{ marginBottom: 0 }}>{submission.task_title || 'Task'}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Submitted: {submission.date ? dayjs(submission.date?.value || submission.date).format('MMMM D, YYYY') : 'N/A'}
            </Text>

            <Text strong>Builder:</Text> <Text>{submission.user_name || 'Unknown'}</Text>

            {analysisError ? (
               <Alert message="Error parsing analysis data" type="warning" showIcon style={{marginTop: '16px'}}/>
            ) : (
              <>
                {analysis?.completion_score !== null && analysis?.completion_score !== undefined && (
                   <div style={{ marginTop: '16px' }}>
                     <Text strong>Score:</Text> <Text>{analysis.completion_score} ({getLetterGrade(analysis.completion_score)})</Text>
                   </div>
                )}

                {submission.analyzed_content && (
                    <div style={{ marginTop: '16px' }}>
                        <Text strong style={{ display: 'block' }}>Analyzed Content:</Text>
                        <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                           {renderAnalyzedContent(submission.analyzed_content)}
                        </div>
                    </div>
                 )}

                {analysis?.submission_summary && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Submission Summary:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                      {analysis.submission_summary}
                    </Paragraph>
                  </div>
                )}

                {analysis?.feedback && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Feedback:</Text>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                      {analysis.feedback}
                    </Paragraph>
                  </div>
                )}

                {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Criteria Met:</Text>
                    <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                      {analysis.criteria_met.map((item, index) => <Tag color="green" key={`crit-${index}`}>{item}</Tag>)}
                    </Space>
                  </div>
                )}

                {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong style={{ display: 'block' }}>Areas for Improvement:</Text>
                    <Space wrap size={[4, 8]} style={{ marginTop: '4px' }}>
                      {analysis.areas_for_improvement.map((item, index) => <Tag color="orange" key={`area-${index}`}>{item}</Tag>)}
                    </Space>
                  </div>
                )}

                {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                   <div style={{ marginTop: '16px' }}>
                     <Title level={5} style={{ marginBottom: '8px' }}>Specific Findings:</Title>
                     {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                       <div key={`find-cat-${catIndex}`} style={{ marginBottom: '12px', paddingLeft: '10px', borderLeft: '2px solid #eee' }}>
                         <Text strong>{category}:</Text>
                         {findings?.strengths && findings.strengths.length > 0 && (
                           <div style={{ marginTop: '4px' }}>
                             <Text>Strengths:</Text>
                             <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                               {findings.strengths.map((item, index) => <li key={`str-${catIndex}-${index}`}>{item}</li>)}
                             </ul>
                           </div>
                         )}
                         {findings?.weaknesses && findings.weaknesses.length > 0 && (
                           <div style={{ marginTop: '4px' }}>
                             <Text>Weaknesses:</Text>
                             <ul style={{ margin: '4px 0 8px 20px', padding: 0, listStyleType: 'disc' }}>
                               {findings.weaknesses.map((item, index) => <li key={`weak-${catIndex}-${index}`}>{item}</li>)}
                             </ul>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                )}
              </>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default TaskSubmissionDetailPage; 