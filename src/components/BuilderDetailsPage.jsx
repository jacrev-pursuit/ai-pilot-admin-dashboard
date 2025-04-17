import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, DatePicker, Table, Tabs, Spin, message, Button, Select, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchBuilderData, fetchBuilderDetails } from '../services/builderService';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle, // Renamed to avoid conflict with Typography.Title
  Tooltip,
  Legend,
} from 'chart.js';
import { baseChartOptions, chartContainer, chartColors } from './ChartStyles';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

// --- Data Processing Functions for Charts ---

// Generic function for simple line charts (Score over Time)
const processLineChartData = (data, dateField, valueField, label) => {
  if (!data || data.length === 0) {
    return { labels: [], datasets: [] };
  }
  
  // Sort data by date
  const sortedData = [...data].sort((a, b) => dayjs(a[dateField]?.value || a[dateField]).diff(dayjs(b[dateField]?.value || b[dateField])));
  
  const labels = sortedData.map(item => dayjs(item[dateField]?.value || item[dateField]).format('YYYY-MM-DD'));
  const values = sortedData.map(item => {
      // Attempt to parse score if it's a string representing a number
      const score = parseFloat(item[valueField]);
      return isNaN(score) ? null : score;
  });

  return {
    labels,
    datasets: [
      {
        label: label,
        data: values,
        borderColor: chartColors.primary,
        backgroundColor: chartColors.primaryLight,
        tension: 0.1,
        fill: false,
      },
    ],
  };
};

// Function for processing prompt counts over time
const processPromptCountData = (data) => {
  if (!data || data.length === 0) {
    return { labels: [], datasets: [] };
  }

  // Aggregate counts by day
  const countsByDay = data.reduce((acc, item) => {
    const day = dayjs(item.created_at?.value || item.created_at).format('YYYY-MM-DD');
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  // Sort days
  const sortedDays = Object.keys(countsByDay).sort((a, b) => dayjs(a).diff(dayjs(b)));

  const labels = sortedDays;
  const values = sortedDays.map(day => countsByDay[day]);

  return {
    labels,
    datasets: [
      {
        label: 'Prompts Sent',
        data: values,
        borderColor: chartColors.tertiary,
        backgroundColor: chartColors.tertiaryLight,
        tension: 0.1,
        fill: false,
      },
    ],
  };
};

// --- Chart Components ---

const SentimentChart = ({ data }) => {
  const chartData = processLineChartData(data, 'created_at', 'sentiment_score', 'Sentiment Score');
  const options = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Sentiment Score Over Time', color: chartColors.text } } };
  return <div style={chartContainer}><Line options={options} data={chartData} /></div>;
};

const PeerFeedbackChart = ({ data }) => {
  const chartData = processLineChartData(data, 'timestamp', 'sentiment_score', 'Peer Feedback Sentiment');
  const options = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Peer Feedback Sentiment Over Time', color: chartColors.text } } };
  return <div style={chartContainer}><Line options={options} data={chartData} /></div>;
};

const WorkProductChart = ({ data }) => {
  const chartData = processLineChartData(data, 'grading_timestamp', 'scores', 'Work Product Score');
  const options = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Work Product Score Over Time', color: chartColors.text } } };
  return <div style={chartContainer}><Line options={options} data={chartData} /></div>;
};

const PromptsChart = ({ data }) => {
  const chartData = processPromptCountData(data);
  const options = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { display: true, text: 'Prompts Sent Over Time (Daily)', color: chartColors.text } } };
  return <div style={chartContainer}><Line options={options} data={chartData} /></div>;
};

const BuilderDetailsPage = () => {
  const { builderId: urlBuilderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [allBuilders, setAllBuilders] = useState([]);
  const [selectedBuilderId, setSelectedBuilderId] = useState(urlBuilderId || null);
  const [selectedBuilderName, setSelectedBuilderName] = useState('');
  
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [activeTab, setActiveTab] = useState('workProduct');
  
  const [workProductData, setWorkProductData] = useState([]);
  const [comprehensionData, setComprehensionData] = useState([]);
  const [peerFeedbackData, setPeerFeedbackData] = useState([]);
  const [promptsData, setPromptsData] = useState([]);
  const [sentimentData, setSentimentData] = useState([]);

  // Fetch all builders for the filter dropdown
  useEffect(() => {
    const loadAllBuilders = async () => {
      try {
        // Use very broad dates to get all builders initially
        const builders = await fetchBuilderData('2000-01-01', '2100-12-31');
        // Capitalize names
        const formattedBuilders = builders.map(b => ({
            ...b,
            name: b.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
        })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        setAllBuilders(formattedBuilders);
        
        if (selectedBuilderId) {
            const builder = formattedBuilders.find(b => b.user_id.toString() === selectedBuilderId);
            setSelectedBuilderName(builder ? builder.name : 'Unknown Builder');
        } else if (formattedBuilders.length > 0) {
            // Optionally select the first builder if none is specified
            // handleBuilderChange(formattedBuilders[0].user_id.toString()); 
        }
      } catch (error) {
        message.error('Failed to load builder list');
        console.error('Error fetching all builders:', error);
      }
    };
    loadAllBuilders();
  }, []); // Run only once on mount

  // Fetch details when builder, tab, or date range changes
  useEffect(() => {
    const loadBuilderDetails = async (dataType) => {
      if (!selectedBuilderId || !dateRange) return;

      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      try {
        // Fetch all data types needed for charts regardless of active tab
        const [wpData, compData, pfData, pData, sentData] = await Promise.all([
           fetchBuilderDetails(selectedBuilderId, 'workProduct', startDate, endDate).catch(e => { console.error('WP fetch error:', e); return []; }),
           fetchBuilderDetails(selectedBuilderId, 'comprehension', startDate, endDate).catch(e => { console.error('Comp fetch error:', e); return []; }),
           fetchBuilderDetails(selectedBuilderId, 'peer_feedback', startDate, endDate).catch(e => { console.error('PF fetch error:', e); return []; }),
           fetchBuilderDetails(selectedBuilderId, 'prompts', startDate, endDate).catch(e => { console.error('Prompts fetch error:', e); return []; }),
           fetchBuilderDetails(selectedBuilderId, 'sentiment', startDate, endDate).catch(e => { console.error('Sent fetch error:', e); return []; })
        ]);
        
        setWorkProductData(wpData);
        setComprehensionData(compData);
        setPeerFeedbackData(pfData);
        setPromptsData(pData);
        setSentimentData(sentData);

      } catch (error) {
        message.error(`Failed to load builder details`);
        console.error(`Error fetching details:`, error);
        // Clear all data on general error
        setWorkProductData([]); 
        setComprehensionData([]); 
        setPeerFeedbackData([]); 
        setPromptsData([]); 
        setSentimentData([]); 
      } finally {
        setLoading(false);
      }
    };

    loadBuilderDetails();
    // Note: Removing activeTab from dependency array as we now fetch all data for charts
  }, [selectedBuilderId, dateRange]); 
  
  // Update selected builder name when ID changes
  useEffect(() => {
      if (selectedBuilderId) {
          const builder = allBuilders.find(b => b.user_id.toString() === selectedBuilderId);
          setSelectedBuilderName(builder ? builder.name : 'Unknown Builder');
          // Update URL if changed via dropdown, not just initial load
          if(urlBuilderId !== selectedBuilderId) {
              navigate(`/builders/${selectedBuilderId}`);
          }
      } else {
          setSelectedBuilderName('');
          // Optionally navigate back to base page if builder is deselected
          // navigate('/builder-details');
      }
  }, [selectedBuilderId, allBuilders, navigate, urlBuilderId]);

  const handleBuilderChange = (value) => {
    setSelectedBuilderId(value);
     // Clear existing data when builder changes to avoid showing old data briefly
    setWorkProductData([]); 
    setComprehensionData([]); 
    setPeerFeedbackData([]); 
    setPromptsData([]); 
    setSentimentData([]); 
  };

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    } else {
      // Handle clear or invalid selection, maybe revert to default?
       setDateRange([dayjs().subtract(30, 'day'), dayjs()]); 
    }
  };
  
  const handleTabChange = (key) => {
    setActiveTab(key);
    // Data for the selected tab should already be fetched by the main useEffect
  };

  // Define columns for each table
  const workProductColumns = [
    { title: 'Task Title', dataIndex: 'task_title', key: 'task_title' },
    { title: 'Response Content', dataIndex: 'response_content', key: 'response_content', ellipsis: true },
    { title: 'Feedback', dataIndex: 'feedback', key: 'feedback', ellipsis: true },
    { title: 'Scores', dataIndex: 'scores', key: 'scores' },
    { title: 'Graded At', dataIndex: 'grading_timestamp', key: 'grading_timestamp', render: (ts) => ts ? dayjs(ts?.value || ts).format('YYYY-MM-DD HH:mm') : 'N/A' },
  ];

  const comprehensionColumns = [
    { title: 'Task Title', dataIndex: 'task_title', key: 'task_title' },
    { title: 'Score', dataIndex: 'score', key: 'score' },
    { title: 'Graded At', dataIndex: 'grading_timestamp', key: 'grading_timestamp', render: (ts) => ts ? dayjs(ts?.value || ts).format('YYYY-MM-DD HH:mm') : 'N/A' },
  ];

  const peerFeedbackColumns = [
    { title: 'Reviewer Name', dataIndex: 'reviewer_name', key: 'reviewer_name' },
    { title: 'Feedback', dataIndex: 'feedback', key: 'feedback', ellipsis: true },
    { title: 'Sentiment Score', dataIndex: 'sentiment_score', key: 'sentiment_score' },
    { title: 'Sentiment Label', dataIndex: 'sentiment_label', key: 'sentiment_label' },
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', render: (ts) => ts ? dayjs(ts?.value || ts).format('YYYY-MM-DD HH:mm') : 'N/A' },
  ];
  
  const promptsColumns = [
    { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', render: (ts) => ts ? dayjs(ts?.value || ts).format('YYYY-MM-DD HH:mm') : 'N/A' },
    { title: 'Content', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: 'Message ID', dataIndex: 'message_id', key: 'message_id' },
  ];
  
  const sentimentColumns = [
      { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', render: (ts) => ts ? dayjs(ts?.value || ts).format('YYYY-MM-DD HH:mm') : 'N/A' },
      { title: 'Sentiment Score', dataIndex: 'sentiment_score', key: 'sentiment_score' },
      { title: 'Sentiment Category', dataIndex: 'sentiment_category', key: 'sentiment_category' },
      { title: 'Summary', dataIndex: 'summary', key: 'summary', ellipsis: true },
      { title: 'ID', dataIndex: 'id', key: 'id' },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/builders')} 
        style={{ marginBottom: '20px' }}
      >
        Back to Builders List
      </Button>
      
      <Title level={2}>Builder Details</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
              <Space wrap>
                  <Select
                    showSearch
                    style={{ width: 300 }}
                    placeholder="Select a Builder"
                    optionFilterProp="children"
                    onChange={handleBuilderChange}
                    value={selectedBuilderId}
                    filterOption={(input, option) =>
                      (option?.children ?? '').toLowerCase().includes(input.toLowerCase()) // Safe access
                    }
                    allowClear
                  >
                    {allBuilders.map(builder => (
                      <Option key={builder.user_id} value={builder.user_id.toString()}>
                        {builder.name}
                      </Option>
                    ))}
                  </Select>
                  <RangePicker 
                      value={dateRange} 
                      onChange={handleDateRangeChange} 
                      allowClear={false} // Usually you want a date range
                  />
              </Space>
               {selectedBuilderName && (
                  <Title level={3} style={{ marginTop: '16px' }}>{selectedBuilderName}</Title>
              )}
          </Card>
          
          {!selectedBuilderId ? (
              <Text>Please select a builder to view details.</Text>
          ) : (
            <Spin spinning={loading}>
             {/* Chart Section */}
             <Card title="Metrics Over Time" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {/* Only render charts if data exists to avoid errors */}
                    {sentimentData.length > 0 && <SentimentChart data={sentimentData} />}
                    {peerFeedbackData.length > 0 && <PeerFeedbackChart data={peerFeedbackData} />}
                    {workProductData.length > 0 && <WorkProductChart data={workProductData} />}
                    {promptsData.length > 0 && <PromptsChart data={promptsData} />}
                 </Space>
             </Card>
             
              {/* Details Section */}
              <Card>
                  <Tabs activeKey={activeTab} onChange={handleTabChange}>
                    <TabPane tab="Work Product" key="workProduct">
                      <Table dataSource={workProductData} columns={workProductColumns} rowKey="task_id" size="small" />
                    </TabPane>
                    <TabPane tab="Comprehension" key="comprehension">
                      <Table dataSource={comprehensionData} columns={comprehensionColumns} rowKey="task_id" size="small" />
                    </TabPane>
                    <TabPane tab="Peer Feedback" key="peer_feedback">
                      <Table dataSource={peerFeedbackData} columns={peerFeedbackColumns} rowKey="feedback_id" size="small" />
                    </TabPane>
                    <TabPane tab="Prompts" key="prompts">
                        <Table dataSource={promptsData} columns={promptsColumns} rowKey="message_id" size="small" />
                    </TabPane>
                    <TabPane tab="Sentiment" key="sentiment">
                        <Table dataSource={sentimentData} columns={sentimentColumns} rowKey="id" size="small" />
                    </TabPane>
                  </Tabs>
              </Card>
            </Spin>
          )}
      </Space>
    </div>
  );
};

export default BuilderDetailsPage; 