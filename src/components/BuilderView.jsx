import React, { useState, useEffect } from 'react';
import { Table, DatePicker, Space, Card, Button, Typography, message, Spin, Tag, Select } from 'antd';
import { ExpandOutlined, ArrowUpOutlined, ArrowDownOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import BuilderDetailsModal from './BuilderDetailsModal';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Helper function to convert numeric score to letter grade
const getLetterGrade = (score) => {
  if (score === null || score === undefined) return 'F';
  
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'F';
  
  // Any valid submission gets at least a C
  if (numScore >= 0.9) return 'A+';
  if (numScore >= 0.8) return 'A';
  if (numScore >= 0.75) return 'A-';
  if (numScore >= 0.7) return 'B+';
  if (numScore >= 0.6) return 'B';
  if (numScore >= 0.55) return 'B-';
  if (numScore >= 0.5) return 'C+';
  return 'C'; // Minimum grade for any submission
};

// Helper function to get color for letter grade
const getGradeColor = (grade) => {
  if (grade === 'N/A') return 'default';
  
  const firstChar = grade.charAt(0);
  if (firstChar === 'A') return 'green';
  if (firstChar === 'B') return 'cyan';
  if (firstChar === 'C') return 'orange';
  if (firstChar === 'D' || firstChar === 'F') return 'red';
  
  return 'default';
};

const BuilderView = () => {
  const [dateRange, setDateRange] = useState(null);
  const [builders, setBuilders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [builderFilter, setBuilderFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Function to handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Function to get sort icon based on current sort state
  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <DownOutlined style={{ color: '#888', fontSize: '12px', marginLeft: '8px', opacity: 0.8 }} />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUpOutlined style={{ color: '#4f46e5', fontSize: '14px', marginLeft: '8px' }} /> 
      : <ArrowDownOutlined style={{ color: '#4f46e5', fontSize: '14px', marginLeft: '8px' }} />;
  };

  // Sort the data based on the current sort configuration
  const sortedBuilders = [...builders].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    
    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortConfig.direction === 'asc' 
      ? aValue - bValue
      : bValue - aValue;
  });

  const columns = [
    {
      title: (
        <div onClick={() => handleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'name' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Builder Name {getSortIcon('name')}
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text) => text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
    },
    {
      title: (
        <div onClick={() => handleSort('tasks_completed_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'tasks_completed_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Tasks Completed {getSortIcon('tasks_completed_percentage')}
        </div>
      ),
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      width: '15%',
      render: (text) => text === null ? '-' : `${text}%`,
    },
    {
      title: (
        <div onClick={() => handleSort('prompts_sent')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'prompts_sent' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Prompts Sent {getSortIcon('prompts_sent')}
        </div>
      ),
      dataIndex: 'prompts_sent',
      key: 'prompts_sent',
      width: '12%',
    },
    {
      title: (
        <div onClick={() => handleSort('daily_sentiment')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'daily_sentiment' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Daily Sentiment {getSortIcon('daily_sentiment')}
        </div>
      ),
      dataIndex: 'daily_sentiment',
      key: 'daily_sentiment',
      width: '15%',
      render: (text, record) => renderDailySentiment(text, record),
    },
    {
      title: (
        <div onClick={() => handleSort('peer_feedback_sentiment')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'peer_feedback_sentiment' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Peer Feedback Sentiment {getSortIcon('peer_feedback_sentiment')}
        </div>
      ),
      dataIndex: 'peer_feedback_sentiment',
      key: 'peer_feedback_sentiment',
      width: '18%',
      render: (text, record) => (
        <Button 
          type="link" 
          icon={<ExpandOutlined />}
          onClick={() => handleExpand('peerFeedback', record)}
        >
          {renderPeerFeedbackSentiment(text, record)}
        </Button>
      ),
    },
    {
      title: (
        <div onClick={() => handleSort('work_product_score')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'work_product_score' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Work Product Score {getSortIcon('work_product_score')}
        </div>
      ),
      dataIndex: 'work_product_score',
      key: 'work_product_score',
      width: '15%',
      render: (text, record) => {
        return (
          <Button 
            type="link" 
            icon={<ExpandOutlined />}
            onClick={() => handleExpand('workProduct', record)}
          >
            {renderWorkProductScore(text)}
          </Button>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('comprehension_score')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'comprehension_score' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Comprehension Score {getSortIcon('comprehension_score')}
        </div>
      ),
      dataIndex: 'comprehension_score',
      key: 'comprehension_score',
      width: '15%',
      render: (text, record) => {
        const grade = getLetterGrade(text);
        return (
          <Button 
            type="link" 
            icon={<ExpandOutlined />}
            onClick={() => handleExpand('comprehension', record)}
          >
            <Tag color={getGradeColor(grade)}>{grade}</Tag>
          </Button>
        );
      },
    },
  ];

  const handleExpand = async (type, record) => {
    setSelectedBuilder(record);
    setModalType(type);
    setModalVisible(true);
    setDetailsLoading(true);
    setError(null);

    try {
      const details = await fetchBuilderDetails(
        record.user_id,
        type,
        dateRange ? dateRange[0].format('YYYY-MM-DD') : '2000-01-01',
        dateRange ? dateRange[1].format('YYYY-MM-DD') : '2100-12-31'
      );
      setDetailsData(details);
    } catch (error) {
      console.error('Error fetching details:', error);
      setError('Failed to fetch builder details. Please try again later.');
      message.error('Failed to fetch details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDateRangeChange = async (dates) => {
    setDateRange(dates);
    if (dates) {
      await fetchData(dates[0], dates[1]);
    } else {
      await fetchData(null, null);
    }
  };

  const handleBuilderFilterChange = (value) => {
    setBuilderFilter(value);
  };

  const fetchData = async (startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBuilderData(
        startDate ? startDate.format('YYYY-MM-DD') : '2000-01-01',
        endDate ? endDate.format('YYYY-MM-DD') : '2100-12-31'
      );
      setBuilders(data);
    } catch (error) {
      console.error('Error fetching builder data:', error);
      setError('Failed to fetch builder data. Please try again later.');
      message.error('Failed to fetch builder data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(null, null);
  }, []);

  const renderDailySentiment = (sentiment, record) => {
    if (!record.prompts_sent || record.prompts_sent === 0) return <span>No data</span>;
    if (!sentiment || sentiment === 'null' || sentiment === 'undefined' || sentiment === '') return <span>No data</span>;
    
    const sentimentMap = {
      'Very Positive': { color: 'green', text: 'Very Positive' },
      'Positive': { color: 'green', text: 'Positive' },
      'Neutral': { color: 'blue', text: 'Neutral' },
      'Negative': { color: 'orange', text: 'Negative' },
      'Very Negative': { color: 'red', text: 'Very Negative' }
    };
    const sentimentInfo = sentimentMap[sentiment] || { color: 'default', text: sentiment };
    return <Tag color={sentimentInfo.color}>{sentimentInfo.text}</Tag>;
  };

  const renderPeerFeedbackSentiment = (sentiment, record) => {
    if (!sentiment || sentiment === 'null' || sentiment === 'undefined' || sentiment === '') return <span>No data</span>;
    
    const sentimentMap = {
      'Very Positive': { color: 'green', text: 'Very Positive' },
      'Positive': { color: 'green', text: 'Positive' },
      'Neutral': { color: 'blue', text: 'Neutral' },
      'Negative': { color: 'orange', text: 'Negative' },
      'Very Negative': { color: 'red', text: 'Very Negative' }
    };
    const sentimentInfo = sentimentMap[sentiment] || { color: 'default', text: sentiment };
    return <Tag color={sentimentInfo.color}>{sentimentInfo.text}</Tag>;
  };

  const renderWorkProductScore = (score) => {
    if (!score) return <span>No data</span>;
    const grade = getLetterGrade(score);
    const color = getGradeColor(grade);
    return <Tag color={color}>{grade}</Tag>;
  };

  // Filter builders based on the selected builder filter
  const filteredBuilders = builderFilter === 'all' 
    ? sortedBuilders 
    : sortedBuilders.filter(builder => builder.user_id.toString() === builderFilter);

  return (
    <div className="builder-view-container">
      <div className="builder-view-header">
        <Title level={2}>Builder Performance Overview</Title>
      </div>
      
      <div className="builder-view-content">
        <Card className="filter-card">
          <Space className="filter-space">
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              allowClear={true}
              className="date-range-picker"
            />
            <Select
              defaultValue="all"
              style={{ width: 200 }}
              onChange={handleBuilderFilterChange}
              placeholder="Filter by Builder"
              className="builder-select"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              <Option value="all">All Builders</Option>
              {builders
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(builder => (
                  <Option key={builder.user_id} value={builder.user_id.toString()}>
                    {builder.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                  </Option>
                ))}
            </Select>
          </Space>
        </Card>

        {error && (
          <Card className="error-card">
            <Typography.Text type="danger">{error}</Typography.Text>
          </Card>
        )}

        <Table
          columns={columns}
          dataSource={filteredBuilders}
          loading={loading}
          rowKey="user_id"
          scroll={{ x: 'max-content' }}
          className="builder-table"
          pagination={{ 
            pageSize: 10,
            position: ['bottomCenter'],
            style: { color: 'white' }
          }}
          rowClassName={() => 'table-row'}
        />
      </div>

      <BuilderDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
        data={detailsData}
        loading={detailsLoading}
        builder={selectedBuilder}
      />
    </div>
  );
};

export default BuilderView; 