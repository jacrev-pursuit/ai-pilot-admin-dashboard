import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Button, Row, Col, Tag, Divider, Space } from 'antd';
import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const VideoAnalysisDetailPage = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/video-analysis/${videoId}`);
        
        if (!response.ok) {
          throw new Error('Video analysis not found');
        }
        
        const data = await response.json();
        setAnalysis(data);
      } catch (err) {
        console.error('Error fetching video analysis:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      fetchAnalysis();
    }
  }, [videoId]);

  const parseRationale = (rationaleString) => {
    try {
      const parsed = JSON.parse(rationaleString);
      return parsed;
    } catch (e) {
      return { overall_explanation: rationaleString || 'No explanation available' };
    }
  };

  const calculateOverallGrade = (technical, business, professional) => {
    const average = (technical + business + professional) / 3;
    const percentage = (average / 5) * 100;
    return getLetterGrade(percentage);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px', color: 'var(--color-text-main)' }}>Loading video analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="No Data"
          description="Video analysis not found."
          type="info"
          showIcon
          action={
            <Button size="small" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  const overallGrade = calculateOverallGrade(
    analysis.technical_score,
    analysis.business_score,
    analysis.professional_skills_score
  );

  const technicalRationale = parseRationale(analysis.technical_score_rationale);
  const businessRationale = parseRationale(analysis.business_score_rationale);
  const professionalRationale = parseRationale(analysis.professional_skills_score_rationale);

  return (
    <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(-1)}
          style={{ marginBottom: '16px' }}
        >
          Back
        </Button>
        <Title level={2} style={{ margin: 0, color: 'var(--color-text-main)' }}>
          Video Analysis Details
        </Title>
        <Text type="secondary">
          {analysis.task_title || `Task ${analysis.video_id}`} • {analysis.user_name}
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* Overview Card */}
        <Col xs={24} lg={8}>
          <Card title="Overview" style={{ height: '100%' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>Overall Grade:</Text>
                <div style={{ marginTop: '8px' }}>
                  <Tag className={getGradeTagClass(overallGrade)} style={{ fontSize: '16px', padding: '8px 16px' }}>
                    {overallGrade}
                  </Tag>
                </div>
              </div>
              
              

              <div>
                <Text strong>Video Link:</Text>
                <div style={{ marginTop: '8px' }}>
                  {analysis.loom_url ? (
                    <a 
                      href={analysis.loom_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <LinkOutlined /> View Video
                    </a>
                  ) : (
                    <Text type="secondary">No video link available</Text>
                  )}
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        {/* Scores Card */}
        <Col xs={24} lg={16}>
          <Card title="Detailed Scores">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                  <Title level={4} style={{ margin: 0, color: 'var(--color-text-main)' }}>Technical</Title>
                  <Title level={2} style={{ margin: '8px 0', color: 'var(--color-primary)' }}>
                    {analysis.technical_score}/5
                  </Title>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                  <Title level={4} style={{ margin: 0, color: 'var(--color-text-main)' }}>Business</Title>
                  <Title level={2} style={{ margin: '8px 0', color: 'var(--color-primary)' }}>
                    {analysis.business_score}/5
                  </Title>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'var(--color-background-secondary)', borderRadius: '8px' }}>
                  <Title level={4} style={{ margin: 0, color: 'var(--color-text-main)' }}>Professional</Title>
                  <Title level={2} style={{ margin: '8px 0', color: 'var(--color-primary)' }}>
                    {analysis.professional_skills_score}/5
                  </Title>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Detailed Feedback */}
      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        <Col xs={24}>
          <Card title="Detailed Feedback">
            {/* Technical Feedback */}
            <div style={{ marginBottom: '24px' }}>
              <Title level={4} style={{ color: 'var(--color-text-main)' }}>
                Technical Analysis ({analysis.technical_score}/5)
              </Title>
              <Paragraph style={{ color: 'var(--color-text-main)' }}>
                {technicalRationale.overall_explanation || 'No technical feedback available'}
              </Paragraph>
              {technicalRationale.overall_supporting_evidence && (
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Supporting Evidence:</Text>
                  <Paragraph style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    {technicalRationale.overall_supporting_evidence}
                  </Paragraph>
                </div>
              )}
            </div>

            <Divider />

            {/* Business Feedback */}
            <div style={{ marginBottom: '24px' }}>
              <Title level={4} style={{ color: 'var(--color-text-main)' }}>
                Business Analysis ({analysis.business_score}/5)
              </Title>
              <Paragraph style={{ color: 'var(--color-text-main)' }}>
                {businessRationale.overall_explanation || 'No business feedback available'}
              </Paragraph>
              {businessRationale.overall_supporting_evidence && (
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Supporting Evidence:</Text>
                  <Paragraph style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    {businessRationale.overall_supporting_evidence}
                  </Paragraph>
                </div>
              )}
            </div>

            <Divider />

            {/* Professional Skills Feedback */}
            <div>
              <Title level={4} style={{ color: 'var(--color-text-main)' }}>
                Professional Skills Analysis ({analysis.professional_skills_score}/5)
              </Title>
              <Paragraph style={{ color: 'var(--color-text-main)' }}>
                {professionalRationale.overall_explanation || 'No professional skills feedback available'}
              </Paragraph>
              {professionalRationale.overall_supporting_evidence && (
                <div style={{ marginTop: '8px' }}>
                  <Text strong>Supporting Evidence:</Text>
                  <Paragraph style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    {professionalRationale.overall_supporting_evidence}
                  </Paragraph>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VideoAnalysisDetailPage; 