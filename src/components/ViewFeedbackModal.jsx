import React from 'react';
import { Modal, Typography, Card, Rate, Divider, Empty, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const ViewFeedbackModal = ({ visible, onClose, feedbackData, builderName, onAddNote, builder }) => {
  
  if (!feedbackData || feedbackData.length === 0) {
    return (
      <Modal
        title="Demo Feedback Notes"
        open={visible}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>Close</Button>
            {onAddNote && builder && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => {
                  onAddNote(builder);
                  onClose();
                }}
              >
                Add Note
              </Button>
            )}
          </Space>
        }
        width={700}
      >
        <Empty description="No feedback notes found for this builder" />
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            Demo Feedback Notes
          </Title>
          <Text type="secondary">
            {builderName || 'Builder'} - {feedbackData.length} feedback note{feedbackData.length > 1 ? 's' : ''}
          </Text>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          {onAddNote && builder && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                onAddNote(builder);
                onClose();
              }}
            >
              Add Note
            </Button>
          )}
        </Space>
      }
      width={800}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '20px 0' }}>
        {feedbackData.map((feedback, index) => (
          <Card
            key={index}
            style={{ 
              marginBottom: index < feedbackData.length - 1 ? '20px' : '0',
              border: '1px solid #f0f0f0'
            }}
            size="small"
          >
            {/* Header with rating and date */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <Text strong style={{ marginRight: '12px' }}>Demo Rating:</Text>
                  <Rate value={feedback.score} disabled style={{ fontSize: '16px' }} />
                  <Text style={{ marginLeft: '8px' }}>({feedback.score}/5)</Text>
                </div>
                {feedback.selection_status && (
                  <div>
                    <Text strong style={{ marginRight: '8px' }}>Selection:</Text>
                    <span style={{ fontSize: '16px' }}>
                      {feedback.selection_status === 'strong' && '✅ Strong'}
                      {feedback.selection_status === 'maybe' && '❓ Maybe'}
                      {feedback.selection_status === 'drop' && '❌ Drop'}
                      {feedback.selection_status === 'pending' && '⚫ Pending'}
                    </span>
                  </div>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {dayjs(feedback.created_at).format('MMM D, YYYY at h:mm A')}
              </Text>
            </div>

            {/* Feedback sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Technical Feedback */}
              {feedback.technical_feedback && (
                <div>
                  <Title level={5} style={{ margin: '0 0 8px 0', color: '#1890ff' }}>
                    Technical Feedback
                  </Title>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {feedback.technical_feedback}
                  </Paragraph>
                </div>
              )}

              {/* Business Feedback */}
              {feedback.business_feedback && (
                <div>
                  <Title level={5} style={{ margin: '0 0 8px 0', color: '#52c41a' }}>
                    Business Feedback
                  </Title>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {feedback.business_feedback}
                  </Paragraph>
                </div>
              )}

              {/* Professional Feedback */}
              {feedback.professional_feedback && (
                <div>
                  <Title level={5} style={{ margin: '0 0 8px 0', color: '#fa8c16' }}>
                    Professional Feedback
                  </Title>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {feedback.professional_feedback}
                  </Paragraph>
                </div>
              )}

              {/* Overall Notes */}
              {feedback.overall_notes && (
                <div>
                  <Title level={5} style={{ margin: '0 0 8px 0', color: '#722ed1' }}>
                    Overall Notes
                  </Title>
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {feedback.overall_notes}
                  </Paragraph>
                </div>
              )}

              {/* Show empty state if no feedback text */}
              {!feedback.technical_feedback && !feedback.business_feedback && !feedback.professional_feedback && !feedback.overall_notes && (
                <Text type="secondary" style={{ fontStyle: 'italic' }}>
                  No detailed feedback provided - rating only.
                </Text>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Modal>
  );
};

export default ViewFeedbackModal; 