import React, { useState, useEffect } from 'react';
import { Table, DatePicker, Space, Card, Button, Typography, message, Spin, Tag, Select } from 'antd';
import { ExpandOutlined, ArrowUpOutlined, ArrowDownOutlined, DownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import BuilderDetailsModal from './BuilderDetailsModal';
import { getLetterGrade, getGradeColor, getGradeTagClass } from '../utils/gradingUtils';
import PeerFeedbackChart from './PeerFeedbackChart';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Utility to fetch data from API endpoints
const fetchFromAPI = async (endpoint, params) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`/api/${endpoint}?${queryString}`);
  if (!response.ok) {
    console.error(`HTTP error! status: ${response.status}, url: ${response.url}`)
    const errorBody = await response.text();
    console.error('Error body:', errorBody);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const BuilderView = () => {
  const [dateRange, setDateRange] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('March 2025 - L2'); // Level filter state - default to March 2025 L2
  const [availableLevels, setAvailableLevels] = useState([]); // Available levels
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [builders, setBuilders] = useState([]); // Initialize as empty array
  const [loading, setLoading] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [builderFilter, setBuilderFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Fetch available levels on component mount
  useEffect(() => {
    const fetchLevels = async () => {
      setLevelsLoading(true);
      try {
        const levels = await fetchFromAPI('levels', {});
        setAvailableLevels(levels || []); // Ensure it's always an array
      } catch (error) {
        console.error("Failed to fetch available levels:", error);
        setAvailableLevels([]); // Set to empty array on error
      } finally {
        setLevelsLoading(false);
      }
    };

    fetchLevels();
  }, []);

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
  const sortedBuilders = Array.isArray(builders) ? [...builders].sort((a, b) => {
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
  }) : []; // Fallback to empty array

  // Calculate max feedback count for scaling
  const maxFeedbackCount = builders && builders.length > 0 
    ? Math.max(...builders.map(builder => builder.total_peer_feedback_count || 0))
    : 100;

  const columns = [
    {
      title: (
        <div onClick={() => handleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'name' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Builder Name {getSortIcon('name')}
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      width: '10%',
      render: (text, record) => (
        <Link to={`/builders/${record.user_id}`}>
          {text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
        </Link>
      ),
    },
    {
      title: (
        <div onClick={() => handleSort('tasks_completed_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'tasks_completed_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Tasks Completed {getSortIcon('tasks_completed_percentage')}
        </div>
      ),
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      width: '10%',
      render: (text) => text === null ? '-' : `${text}%`,
    },
    {
      title: (
        <div onClick={() => handleSort('total_peer_feedback_count')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'total_peer_feedback_count' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Peer Feedback {getSortIcon('total_peer_feedback_count')}
        </div>
      ),
      dataIndex: 'total_peer_feedback_count',
      key: 'total_peer_feedback_count',
      width: '20%',
      render: (text, record) => {
        return (
          <div onClick={() => handleExpand('peer_feedback', record)} style={{ cursor: 'pointer' }}>
            <PeerFeedbackChart 
              total_peer_feedback_count={record.total_peer_feedback_count}
              positive_feedback_count={record.positive_feedback_count}
              neutral_feedback_count={record.neutral_feedback_count}
              negative_feedback_count={record.negative_feedback_count}
              maxFeedbackCount={maxFeedbackCount}
            />
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('work_product_score')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: sortConfig.key === 'work_product_score' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Work Product Score {getSortIcon('work_product_score')}
        </div>
      ),
      dataIndex: 'work_product_score',
      key: 'work_product_score',
      width: '20%',
      render: (text, record) => {
        if (text === null || text === undefined) {
          return <span>No task assessments</span>;
        }
        const grade = getLetterGrade(text);
        return (
          <Tag 
            className={getGradeTagClass(grade)} 
            onClick={() => handleExpand('workProduct', record)}
            style={{ cursor: 'pointer' }}
          >
            {grade}
          </Tag>
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
      width: '20%',
      render: (text, record) => {
        if (text === null || text === undefined) {
          return <span>No task assessments</span>;
        }
        const grade = getLetterGrade(text);
        return (
          <Tag 
            className={getGradeTagClass(grade)} 
            onClick={() => handleExpand('comprehension', record)}
            style={{ cursor: 'pointer' }}
          >
            {grade}
          </Tag>
        );
      },
    },
  ];

  const handleExpand = async (type, record) => {
    setSelectedBuilder(record);
    setModalType(type);
    setModalVisible(true);
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDetailsLoading(true);
    setError(null);

    try {
      const details = await fetchBuilderDetails(
        record.user_id,
        type,
        dateRange && dateRange[0] && dateRange[0].format ? dateRange[0].format('YYYY-MM-DD') : '2000-01-01',
        dateRange && dateRange[1] && dateRange[1].format ? dateRange[1].format('YYYY-MM-DD') : '2100-12-31'
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
      await fetchBuilderData2(dates[0], dates[1]);
    } else {
      await fetchBuilderData2(null, null);
    }
  };

  const handleBuilderFilterChange = (value) => {
    setBuilderFilter(value);
  };

  const handleLevelFilterChange = (value) => {
    setSelectedLevel(value === 'all' ? null : value);
  };

  // Re-fetch data when level filter changes
  useEffect(() => {
    fetchBuilderData2(
      dateRange ? dateRange[0] : null,
      dateRange ? dateRange[1] : null
    );
  }, [selectedLevel]); // Will trigger when selectedLevel changes

  const fetchBuilderData2 = async (startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      // Build params object with proper date handling
      const params = {
        startDate: startDate && startDate.format ? startDate.format('YYYY-MM-DD') : '2000-01-01',
        endDate: endDate && endDate.format ? endDate.format('YYYY-MM-DD') : '2100-12-31'
      };
      
      // Add level filter if selected
      if (selectedLevel) {
        params.level = selectedLevel;
      }

      const data = await fetchBuilderData(
        params.startDate,
        params.endDate,
        params.level // Pass level parameter
      );
      setBuilders(Array.isArray(data) ? data : []); // Ensure it's always an array
    } catch (error) {
      console.error('Error fetching builder data:', error);
      setError('Failed to fetch builder data. Please try again later.');
      setBuilders([]); // Set to empty array on error
      message.error('Failed to fetch builder data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuilderData2(null, null);
  }, []);

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
        <Card className="filter-card" style={{ borderRadius: '8px', marginBottom: '20px' }}>
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
              {Array.isArray(builders) && builders
                .sort((a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0)
                .map(builder => (
                  <Option key={builder.user_id} value={builder.user_id.toString()}>
                    {builder.name ? builder.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 'Unknown'}
                  </Option>
                ))}
            </Select>
            <Select
              value={selectedLevel || 'all'}
              style={{ width: 240 }}
              onChange={handleLevelFilterChange}
              placeholder="Cohort + Level"
              className="level-select"
              loading={levelsLoading}
              allowClear={false}
            >
              <Option value="all">All Levels</Option>
              {Array.isArray(availableLevels) && availableLevels.map(level => (
                <Option key={level} value={level}>{level}</Option>
              ))}
            </Select>
          </Space>
        </Card>

        {error && (
          <Card className="error-card" style={{ borderRadius: '8px', marginBottom: '20px' }}>
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
            showSizeChanger: false,
            showQuickJumper: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} builders`,
            size: 'default',
            showLessItems: false
          }}
          rowClassName={() => 'table-row'}
          style={{ borderRadius: '8px' }}
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