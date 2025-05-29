import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Alert, Typography, Space, Tag, Button, message, Descriptions, Row, Col } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils'; // Assuming gradingUtils is in utils folder

const { Title, Text, Paragraph } = Typography;

// Helper function to parse the 'analysis' JSON string
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    const cleanedString = analysisString
      .replace(/\n/g, '\n')
      .replace(/\t/g, '\t')
      .replace(/\\"/g, '"');
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
         return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{url}</a>;
       } else {
         return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}><pre>{JSON.stringify(parsed, null, 2)}</pre></Text>;
       }
    }
  } catch (e) {}
  if (typeof content === 'string' && urlRegex.test(content)) {
    return <a href={content} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>{content}</a>;
  }
  return <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}><pre>{content}</pre></Text>;
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
  const grade = analysis?.completion_score !== null && analysis?.completion_score !== undefined ? getLetterGrade(analysis.completion_score) : null;
  const submissionDateFormatted = submission?.date ? dayjs(submission.date?.value || submission.date).format('MMMM D, YYYY') : null;

  return (
    <div style={{ 
      padding: '0', 
      background: 'var(--color-bg-main)', 
      minHeight: 'calc(100vh - 64px)', 
      color: 'var(--color-text-main)'
    }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} // Go back to previous page
        style={{ marginBottom: '24px' }}
      >
        Back
      </Button>

      {loading && <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" /></div>}
      {error && !loading && <Alert message="Error" description={error} type="error" showIcon style={{ marginBottom: '24px'}} />}
      
      {submission && !loading && !error && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
            <div style={{ marginBottom: '8px' }}>
              <Title level={3} style={{ marginBottom: '4px', color: 'var(--color-text-main)' }}>
                {submission.task_title || 'Task Details'}
                {submissionDateFormatted && ` | ${submissionDateFormatted}`}
              </Title>
              <Text type="secondary" style={{ fontSize: '1em', color: 'var(--color-text-secondary)' }}>
                {submission.user_name || 'Unknown'}
                {!analysisError && grade && (
                  <>, <Tag className={getGradeTagClass(grade)}>{grade}</Tag></>
                )}
              </Text>
            </div>
          </Card>

          {analysisError && (
            <Alert message="Error parsing analysis data" description="Some or all of the automated analysis could not be displayed." type="warning" showIcon />
          )}

          {!analysisError && (
            <>
              {submission.analyzed_content && (
                <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Analyzed Content</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                  <div style={{ background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                    {renderAnalyzedContent(submission.analyzed_content)}
                  </div>
                </Card>
              )}

              {analysis?.submission_summary && (
                <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Submission Summary</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                    {analysis.submission_summary}
                  </Paragraph>
                </Card>
              )}

              {analysis?.feedback && (
                <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Feedback</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--color-bg-main)', padding: '12px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                    {analysis.feedback}
                  </Paragraph>
                </Card>
              )}

              <Row gutter={[24, 24]}>
                {analysis?.criteria_met && analysis.criteria_met.length > 0 && (
                  <Col xs={24} md={12}>
                    <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Criteria Met</Title>} bordered={false} style={{ height: '100%', background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                      <Space wrap size={[8, 8]}>
                        {analysis.criteria_met.map((item, index) => <Tag className="criteria-met-tag" key={`crit-${index}`}>{item}</Tag>)}
                      </Space>
                    </Card>
                  </Col>
                )}

                {analysis?.areas_for_improvement && analysis.areas_for_improvement.length > 0 && (
                  <Col xs={24} md={12}>
                    <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Areas for Improvement</Title>} bordered={false} style={{ height: '100%', background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                      <Space wrap size={[8, 8]}>
                        {analysis.areas_for_improvement.map((item, index) => <Tag className="areas-for-improvement-tag" key={`area-${index}`}>{item}</Tag>)}
                      </Space>
                    </Card>
                  </Col>
                )}
              </Row>

              {analysis?.specific_findings && typeof analysis.specific_findings === 'object' && Object.keys(analysis.specific_findings).length > 0 && (
                <Card title={<Title level={5} style={{color: 'var(--color-text-main)'}}>Specific Findings</Title>} bordered={false} style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-main)', borderRadius: '8px' }}>
                  <Row gutter={[24, 24]}>
                    {Object.entries(analysis.specific_findings).map(([category, findings], catIndex) => (
                      <Col xs={24} md={12} key={`find-cat-col-${catIndex}`}>
                        <div key={`find-cat-${catIndex}`} style={{ marginBottom: '20px', paddingLeft: '0', borderLeft: 'none', height: '100%' }}>
                          <Title level={5} style={{ textTransform: 'capitalize', marginBottom: '10px', textDecoration: 'underline', color: 'var(--color-text-main)'}}>{category.replace(/_/g, ' ')}</Title>
                          {findings?.strengths && findings.strengths.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                              <Text strong style={{color: 'var(--color-text-main)'}}>Strengths:</Text>
                              <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc', color: 'var(--color-text-secondary)' }}>
                                {findings.strengths.map((item, index) => <li key={`str-${catIndex}-${index}`} style={{ marginBottom: '4px'}}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                          {findings?.weaknesses && findings.weaknesses.length > 0 && (
                            <div>
                              <Text strong style={{color: 'var(--color-text-main)'}}>Weaknesses:</Text>
                              <ul style={{ margin: '8px 0 0 20px', padding: 0, listStyleType: 'disc', color: 'var(--color-text-secondary)' }}>
                                {findings.weaknesses.map((item, index) => <li key={`weak-${catIndex}-${index}`} style={{ marginBottom: '4px'}}>{item}</li>)}
                              </ul>
                            </div>
                          )}
                          {(!findings?.strengths || findings.strengths.length === 0) && (!findings?.weaknesses || findings.weaknesses.length === 0) && (
                            <Text type="secondary" style={{color: 'var(--color-text-muted)'}}>No specific strengths or weaknesses noted for this category.</Text>
                          )}
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Card>
              )}
            </>
          )}
        </Space>
      )}
       {!submission && !loading && !error && (
        <Alert message="Submission Not Found" description="The requested submission could not be found or is unavailable." type="warning" showIcon />
      )}
    </div>
  );
};

export default TaskSubmissionDetailPage; 