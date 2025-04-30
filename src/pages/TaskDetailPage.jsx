import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Alert, Typography, Button, Card } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const TaskDetailPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [taskDetails, setTaskDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: Fetch task details from backend using taskId
    console.log('Task ID from URL:', taskId);
    // Simulating fetch for now
    setLoading(true);
    setTimeout(() => {
        // Placeholder data - replace with actual fetch
        setTaskDetails({ task_id: taskId, task_title: `Task Title for ID ${taskId}` }); 
        setLoading(false);
    }, 500);
  }, [taskId]);

  return (
    <div style={{ padding: '20px' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/tasks')} // Navigate back to overview
        style={{ marginBottom: '20px' }}
      >
        Back to Tasks Overview
      </Button>

      {loading && <Spin size="large" style={{ display: 'block', marginTop: '50px' }} />}
      
      {error && (
        <Alert 
          message="Error Loading Task Details" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginTop: '20px'}} 
        />
      )}

      {taskDetails && !loading && !error && (
        <Card>
          <Title level={2}>{taskDetails.task_title}</Title>
          <Text>Task ID: {taskDetails.task_id}</Text>
          {/* More details will go here */} 
        </Card>
      )}

      {!loading && !error && !taskDetails && (
        <Alert message="Task not found" type="warning" showIcon />
      )}
    </div>
  );
};

export default TaskDetailPage; 