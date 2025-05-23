import { useState, useEffect } from 'react';
import { Table, Input, DatePicker, Spin, Alert, Tag, Space } from 'antd';
import dayjs from 'dayjs';
import { executeQuery } from '../services/bigqueryService';

const { RangePicker } = DatePicker;
const { Search } = Input;

const formatBuilderName = (name) => {
  if (!name) return '';
  return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const getSentimentTag = (score) => {
  let color = 'default';
  let text = 'N/A';
  if (score === null || score === undefined) {
    return <Tag color={color}>{text}</Tag>;
  }

  if (score > 0.2) { color = 'green'; text = 'Positive'; }
  else if (score < -0.2) { color = 'red'; text = 'Negative'; }
  else { color = 'blue'; text = 'Neutral'; }

  return <Tag color={color} title={`Score: ${score}`}>{text}</Tag>;
};

const BuilderMetricsTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [sorter, setSorter] = useState({});

  const fetchData = async (currentPagination = pagination, currentSorter = sorter, currentSearch = searchTerm, currentDates = dateRange) => {
    setLoading(true);
    setError(null);
    try {
      const startDate = currentDates ? currentDates[0].format('YYYY-MM-DD') : dayjs().subtract(30, 'days').format('YYYY-MM-DD');
      const endDate = currentDates ? currentDates[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      
      const result = await executeQuery({ startDate, endDate });

      let filteredData = result.filter(row =>
        row.name && row.name.toLowerCase().includes(currentSearch.toLowerCase())
      );

      if (currentSorter.field && currentSorter.order) {
        const { field, order } = currentSorter;
        filteredData.sort((a, b) => {
          const aValue = a[field];
          const bValue = b[field];
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          
          const comparison = typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue;
          return order === 'ascend' ? comparison : -comparison;
        });
      }

      setData(filteredData);
    } catch (err) {
      console.error('Error fetching/processing builder metrics:', err);
      setError(err.message || 'Failed to load builder metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTableChange = (newPagination, filters, newSorter) => {
    setPagination(newPagination);
    setSorter(newSorter);
    fetchData(newPagination, newSorter, searchTerm, dateRange);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    const newPagination = { ...pagination, current: 1 };
    setPagination(newPagination);
    fetchData(newPagination, sorter, value, dateRange);
  };

  const handleDateChange = (dates) => {
    setDateRange(dates);
    const newPagination = { ...pagination, current: 1 };
    setPagination(newPagination);
    if (dates && dates.length === 2) {
        fetchData(newPagination, sorter, searchTerm, dates);
    } else if (!dates) {
        fetchData(newPagination, sorter, searchTerm, [dayjs().subtract(30, 'days'), dayjs()]);
    }
  };

  const columns = [
    {
      title: 'Builder Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name) => formatBuilderName(name),
    },
    {
      title: 'Task Completion Rate',
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      sorter: true,
      render: (rate) => (rate !== null ? `${rate.toFixed(1)}%` : 'N/A'),
      align: 'right',
    },
    {
      title: 'Total Prompts',
      dataIndex: 'prompts_sent',
      key: 'prompts_sent',
      sorter: true,
      align: 'right',
    },
    {
      title: 'Avg. Sentiment',
      dataIndex: 'daily_sentiment',
      key: 'daily_sentiment',
      render: (text, record) => (
          <Tag color={{
              'Very Positive': 'green',
              'Positive': 'cyan',
              'Neutral': 'blue',
              'Negative': 'orange',
              'Very Negative': 'red'
          }[text] || 'default'}>
              {text || 'N/A'}
          </Tag>
      )
    },
    {
      title: 'Peer Feedback Sentiment',
      dataIndex: 'peer_feedback_sentiment',
      key: 'peer_feedback_sentiment',
      render: (text) => (
          <Tag color={{
              'Very Positive': 'green',
              'Positive': 'cyan',
              'Neutral': 'blue',
              'Negative': 'orange',
              'Very Negative': 'red'
          }[text] || 'default'}>
              {text || 'N/A'}
          </Tag>
      )
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Search
          placeholder="Search builders..."
          allowClear
          onSearch={handleSearch}
          onChange={(e) => !e.target.value && handleSearch('')}
          style={{ width: 250 }}
        />
        <RangePicker
          value={dateRange}
          onChange={handleDateChange}
          allowClear={true}
        />
      </Space>

      {error && (
        <Alert message="Error" description={error} type="error" showIcon />
      )}

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="user_id"
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }}
      />
    </Space>
  );
};

export default BuilderMetricsTable; 