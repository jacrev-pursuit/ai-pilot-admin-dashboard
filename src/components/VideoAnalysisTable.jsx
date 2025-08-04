import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Spin, message, Alert, Modal, Typography, Card, Row, Col, Divider } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { fetchVideoAnalyses } from '../services/builderService';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';

const { Title, Text, Paragraph } = Typography;

const VideoAnalysisTable = ({ userId = null, dateRange = null, level = null }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Convert numerical score to letter grade
  const getScoreGrade = (score) => {
    if (score === null || score === undefined) return 'N/A';
    // Convert score out of 5 to a percentage (e.g., 3/5 = 60%)
    const percentage = (score / 5) * 100;
    return getLetterGrade(percentage);
  };
  
  // Parse and format rationale JSON 
  const parseRationale = (jsonString) => {
    if (!jsonString) return { formattedText: 'No rationale provided.' };
    
    try {
      // Try to parse the JSON
      const parsed = JSON.parse(jsonString);
      
      // Create a structured output
      const sections = [];
      
      // Add overall explanation
      if (parsed.overall_explanation) {
        sections.push(
          <div key="explanation">
            <Text strong style={{ color: 'var(--color-text-main)' }}>Overall Assessment:</Text>
            <Paragraph style={{ color: 'var(--color-text-main)', marginLeft: '10px' }}>{parsed.overall_explanation}</Paragraph>
          </div>
        );
      }
      
      // Add supporting evidence without the label
      if (parsed.overall_supporting_evidence) {
        sections.push(
          <div key="evidence">
            <Paragraph style={{ color: 'var(--color-text-main)', marginLeft: '10px' }}>{parsed.overall_supporting_evidence}</Paragraph>
          </div>
        );
      }
      
      // Add subcriteria if available
      if (parsed.sub_criteria && typeof parsed.sub_criteria === 'object') {
        const criteriaList = [];
        
        Object.entries(parsed.sub_criteria).forEach(([key, value], index) => {
          if (value && typeof value === 'object' && value.score !== undefined) {
            criteriaList.push(
              <div key={`criteria-${index}`} style={{ marginBottom: '8px' }}>
                <Text style={{ color: 'var(--color-text-main)' }}>
                  <Text strong>{key}:</Text> {value.explanation}
                </Text>
                <div style={{ marginLeft: '10px' }}>
                  <Text type="secondary" style={{ color: '#cccccc' }}>Score: {value.score}/5</Text>
                  {value.supporting_evidence && (
                    <div>
                      <Text type="secondary" style={{ color: '#cccccc', fontSize: '12px' }}>{value.supporting_evidence}</Text>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        });
        
        if (criteriaList.length > 0) {
          sections.push(
            <div key="subcriteria">
              <Divider style={{ margin: '10px 0', borderColor: '#555555' }} />
              <Text strong style={{ color: 'var(--color-text-main)' }}>Detailed Criteria:</Text>
              <div style={{ marginTop: '8px', marginLeft: '10px' }}>{criteriaList}</div>
            </div>
          );
        }
      }
      
      // If we successfully parsed but didn't find expected fields
      if (sections.length === 0) {
        return { 
          formattedText: null,
          rawJson: parsed
        };
      }
      
      return { 
        formattedContent: <div>{sections}</div>,
        parsed: parsed
      };
    } catch (e) {
      console.error("Failed to parse rationale JSON:", e);
      return { formattedText: jsonString };
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
        const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
        
        const videoData = await fetchVideoAnalyses(startDate, endDate, userId, level);
        setData(videoData);
      } catch (err) {
        console.error('Error fetching video analyses:', err);
        setError('Failed to load video analyses. Please try again.');
        message.error('Failed to load video analyses');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId, dateRange, level]);

  const handleViewDetails = (record) => {
    setSelectedVideo(record);
    setModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const columns = [
    {
      title: 'Video ID',
      dataIndex: 'video_id',
      key: 'video_id',
    },
    {
      title: 'Demo Video',
      key: 'loom_url',
      render: (_, record) => (
        record.loom_url ? (
          <a href={record.loom_url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> View Demo
          </a>
        ) : 'No link available'
      ),
    },
    {
      title: 'Technical',
      dataIndex: 'technical_score',
      key: 'technical_score',
      render: (score) => {
        const grade = getScoreGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Business',
      dataIndex: 'business_score',
      key: 'business_score',
      render: (score) => {
        const grade = getScoreGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Professional',
      dataIndex: 'professional_skills_score',
      key: 'professional_skills_score',
      render: (score) => {
        const grade = getScoreGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: 'Average',
      dataIndex: 'average_score',
      key: 'average_score',
      render: (score) => {
        const grade = getScoreGrade(score);
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
      sorter: (a, b) => a.average_score - b.average_score,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => handleViewDetails(record)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert message="Error" description={error} type="error" showIcon />
      ) : data.length === 0 ? (
        <Alert message="No video analyses found" type="info" showIcon />
      ) : (
        <Table 
          dataSource={data} 
          columns={columns} 
          rowKey="video_id"
          pagination={{ 
            pageSize: 10, 
            showSizeChanger: false,
            showQuickJumper: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} videos`,
            size: 'default',
            showLessItems: false
          }}
        />
      )}

      <Modal
        title={<span style={{ color: "var(--color-text-main)" }}>Video Analysis Details</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedVideo && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {selectedVideo.loom_url && (
              <div>
                <Title level={5} style={{ color: "var(--color-text-main)" }}>Video Link</Title>
                <a 
                  href={selectedVideo.loom_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-primary)" }}
                >
                  <LinkOutlined /> Open Video Demo
                </a>
              </div>
            )}
            
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Technical</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.technical_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.technical_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.technical_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.technical_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Business</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.business_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.business_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.business_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.business_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
              
              <Col span={8}>
                <Card title={<Text style={{ color: "var(--color-text-main)" }}>Professional Skills</Text>}>
                  <div style={{ textAlign: 'center' }}>
                    <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.professional_skills_score))} style={{ fontSize: '18px', padding: '5px 15px' }}>
                      {getScoreGrade(selectedVideo.professional_skills_score)}
                    </Tag>
                    <Text style={{ display: 'block', marginTop: '10px', color: "var(--color-text-main)" }}>
                      Score: {selectedVideo.professional_skills_score}/5
                    </Text>
                  </div>
                  
                  <div style={{ marginTop: '15px' }}>
                    {(() => {
                      const { formattedContent, formattedText, rawJson } = parseRationale(selectedVideo.professional_skills_score_rationale);
                      
                      if (formattedContent) {
                        return formattedContent;
                      } else if (formattedText) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap' }}>{formattedText}</Text>;
                      } else if (rawJson) {
                        return <Text style={{ color: "var(--color-text-main)", whiteSpace: 'pre-wrap', fontSize: '12px' }}><pre>{JSON.stringify(rawJson, null, 2)}</pre></Text>;
                      } else {
                        return <Text style={{ color: "var(--color-text-main)" }}>No rationale available</Text>;
                      }
                    })()}
                  </div>
                </Card>
              </Col>
            </Row>
            
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Text style={{ color: "var(--color-text-main)", fontSize: '16px' }}>
                Overall Average: 
              </Text>
              <Tag className={getGradeTagClass(getScoreGrade(selectedVideo.average_score))} style={{ fontSize: '18px', padding: '5px 15px', marginLeft: '10px' }}>
                {getScoreGrade(selectedVideo.average_score)}
              </Tag>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default VideoAnalysisTable; 