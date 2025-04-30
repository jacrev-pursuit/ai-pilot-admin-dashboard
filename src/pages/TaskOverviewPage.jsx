import React, { useState, useEffect } from 'react';
import { Table, DatePicker, Spin, Alert, Typography, Card, Space } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { fetchTaskSummary } from '../services/builderService'; // Adjust path if needed

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const TaskOverviewPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);

  useEffect(() => {
    const loadTasks = async () => {
      if (!dateRange || dateRange.length !== 2) return;

      setLoading(true);
      setError(null);
      try {
        const summaryData = await fetchTaskSummary(
          dateRange[0].format('YYYY-MM-DD'),
          dateRange[1].format('YYYY-MM-DD')
        );
        setTasks(summaryData);
      } catch (err) {
        console.error('Failed to fetch task summary:', err);
        setError(err.message || 'Failed to load task summary data.');
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [dateRange]);

  const handleDateChange = (dates) => {
    if (dates) {
      setDateRange(dates);
    } else {
      // Handle clear event if needed, e.g., set to default range or null
      // setDateRange(null); 
      setDateRange([dayjs().subtract(30, 'days'), dayjs()]); // Reset to default
    }
  };

  const columns = [
    {
      title: 'Task Title',
      dataIndex: 'task_title',
      key: 'task_title',
      sorter: (a, b) => (a.task_title || '').localeCompare(b.task_title || ''),
      render: (text, record) => <Link to={`/tasks/${record.task_id}`}>{text || 'Untitled Task'}</Link>,
    },
    {
      title: 'Date',
      dataIndex: 'day_date',
      key: 'day_date',
      render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
      sorter: (a, b) => dayjs(a.day_date?.value || a.day_date).unix() - dayjs(b.day_date?.value || b.day_date).unix(),
      width: '15%',
    },
    {
      title: 'Type',
      dataIndex: 'learning_type',
      key: 'learning_type',
      sorter: (a, b) => (a.learning_type || '').localeCompare(b.learning_type || ''),
      width: '15%',
    },
    {
      title: 'Submissions Count',
      dataIndex: 'submission_count',
      key: 'submission_count',
      sorter: (a, b) => a.submission_count - b.submission_count,
      align: 'right',
    },
    {
      title: 'Analysis Count',
      dataIndex: 'analysis_count',
      key: 'analysis_count',
      sorter: (a, b) => a.analysis_count - b.analysis_count,
      align: 'right',
    },
    // Add more columns later (Completion %, Avg Grade, etc.)
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Tasks Overview</Title>
      
      <Card style={{ marginBottom: '20px' }}>
        <Space>
          <Text>Date Range:</Text>
          <RangePicker 
            value={dateRange} 
            onChange={handleDateChange} 
            allowClear={true} 
          />
        </Space>
      </Card>

      {error && (
        <Alert 
          message="Error Loading Tasks" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginBottom: '20px' }} 
        />
      )}

      <Table 
        columns={columns}
        dataSource={tasks}
        loading={loading}
        rowKey="task_id"
        pagination={{ pageSize: 15, position: ['bottomCenter'] }}
        scroll={{ y: 500 }} // Add vertical scroll
      />
    </div>
  );
};

export default TaskOverviewPage; 