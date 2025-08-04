import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Rate, Button, Typography, Space, message } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DemoRatingModal = ({ visible, onClose, builder, rating, onSave, existingFeedback }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentRating, setCurrentRating] = useState(rating);

    useEffect(() => {
    if (visible && builder && rating) {
      setCurrentRating(rating);
      
      // If there's existing feedback, prefill the form
      const latestFeedback = existingFeedback && existingFeedback.length > 0 ? existingFeedback[0] : null;
      
      form.setFieldsValue({
        score: rating,
        technical_feedback: latestFeedback?.technical_feedback || '',
        business_feedback: latestFeedback?.business_feedback || '',
        professional_feedback: latestFeedback?.professional_feedback || '',
        overall_notes: latestFeedback?.overall_notes || ''
      });
    }
  }, [visible, builder, rating, form, existingFeedback]);

  const handleSave = async (values) => {
    setLoading(true);
    try {
              const feedbackData = {
          builder_id: builder.user_id,
          task_id: builder.latest_task_id || null,
          submission_id: builder.latest_submission_id || null,
          score: currentRating, // Use current rating from state
          technical_feedback: values.technical_feedback,
          business_feedback: values.business_feedback,
          professional_feedback: values.professional_feedback,
          overall_notes: values.overall_notes
        };

      await onSave(feedbackData);
      message.success('Demo feedback saved successfully!');
      onClose();
      form.resetFields();
    } catch (error) {
      console.error('Error saving demo feedback:', error);
      message.error('Failed to save demo feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setCurrentRating(rating); // Reset to original rating
    onClose();
  };

  if (!builder) return null;

  const loomUrl = builder.latest_loom_url;
  const hasExistingFeedback = existingFeedback && existingFeedback.length > 0;
  const latestFeedback = hasExistingFeedback ? existingFeedback[0] : null;

  return (
    <Modal
      title={
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            {hasExistingFeedback ? 'Edit Demo Rating & Notes' : 'Demo Rating & Feedback'}
          </Title>
          <Text type="secondary">
            {builder.name ? builder.name.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 'Builder'}
          </Text>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ padding: '20px 0' }}>
        {/* Video Link Section */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Title level={5}>Latest Demo Video</Title>
          {loomUrl && loomUrl.includes('loom.com') ? (
            <Button 
              type="primary" 
              icon={<LinkOutlined />}
              href={loomUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="large"
            >
              View Demo Video
            </Button>
          ) : (
            <Text type="secondary">No demo video available</Text>
          )}
        </div>

        {/* Rating Display */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Title level={5}>Demo Rating</Title>
          <Rate 
            value={currentRating} 
            onChange={(value) => {
              setCurrentRating(value);
              form.setFieldValue('score', value);
            }}
            style={{ fontSize: '24px' }} 
          />
          <div style={{ marginTop: '8px' }}>
            <Text strong>{currentRating} out of 5 stars</Text>
          </div>
        </div>

        {/* Feedback Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
        >
          <Form.Item
            name="technical_feedback"
            label={<Text strong>Technical Feedback</Text>}
          >
            <TextArea
              rows={4}
              placeholder="Provide detailed technical feedback about the implementation, code quality, architecture decisions, etc."
            />
          </Form.Item>

          <Form.Item
            name="business_feedback"
            label={<Text strong>Business Feedback</Text>}
          >
            <TextArea
              rows={4}
              placeholder="Provide feedback on business understanding, problem-solving approach, user experience considerations, etc."
            />
          </Form.Item>

          <Form.Item
            name="professional_feedback"
            label={<Text strong>Professional Feedback</Text>}
          >
            <TextArea
              rows={4}
              placeholder="Provide feedback on communication skills, presentation quality, professionalism, etc."
            />
          </Form.Item>

          <Form.Item
            name="overall_notes"
            label={<Text strong>Overall Notes</Text>}
          >
            <TextArea
              rows={3}
              placeholder="Any additional overall notes, summary, or general comments about the demo..."
            />
          </Form.Item>

          <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
            <Space size="large">
              <Button size="large" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                size="large"
              >
                Save Feedback
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default DemoRatingModal; 