import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, DatePicker, Spin, message, List, Tag, Select, Space, Table, Button, Divider } from 'antd';
import dayjs from 'dayjs';
import { fetchCohortTaskDetails, fetchTaskList, fetchTaskSubmissions } from '../services/taskService';
import { getLetterGrade, getGradeColor, getGradeTagClass } from '../utils/gradingUtils';
// TODO: Import a chart library (e.g., Chart.js with react-chartjs-2) and the chart component

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Helper to parse analysis safely
const parseAnalysis = (analysisString) => {
  if (!analysisString) return null;
  try {
    return JSON.parse(analysisString);
  } catch (error) {
    console.error("Failed to parse analysis JSON:", error, "String:", analysisString);
    return null;
  }
};

const CohortTaskDetailsPage = () => {
  const { taskId: taskIdFromUrl } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [taskListLoading, setTaskListLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cohortDetails, setCohortDetails] = useState(null);
  const [submissionsData, setSubmissionsData] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, totalItems: 0 });
  const [taskList, setTaskList] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(taskIdFromUrl);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  useEffect(() => {
    const loadTaskList = async () => {
      setTaskListLoading(true);
      try {
        const tasks = await fetchTaskList();
        setTaskList(tasks || []);
        if (!taskIdFromUrl && tasks.length > 0) {
          // Optionally select the first task by default
          // setSelectedTaskId(tasks[0].task_id);
          // navigate(`/tasks/${tasks[0].task_id}`, { replace: true });
        } else if (taskIdFromUrl && !tasks.some(task => task.task_id.toString() === taskIdFromUrl)) {
             console.warn(`Task ID ${taskIdFromUrl} from URL not found in fetched list.`);
             // Optionally clear selection or show an error/message
             // setSelectedTaskId(null);
        }
      } catch (err) {
        console.error('Error fetching task list:', err);
        message.error('Failed to load task list.');
        setError('Could not load available tasks.');
      } finally {
        setTaskListLoading(false);
      }
    };
    loadTaskList();
  }, []);

  useEffect(() => {
    const loadCohortDetails = async () => {
      if (!selectedTaskId) {
        setCohortDetails(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const startDate = dateRange[0].format('YYYY-MM-DD');
        const endDate = dateRange[1].format('YYYY-MM-DD');
        console.log(`Fetching cohort details for task ${selectedTaskId} between ${startDate} and ${endDate}`);
        const data = await fetchCohortTaskDetails(selectedTaskId, startDate, endDate);
        setCohortDetails(data);
      } catch (err) {
        console.error('Error fetching cohort task details:', err);
        const errorMsg = err.message || 'Failed to load task details. Please try again.';
        setError(errorMsg);
        message.error(errorMsg);
        setCohortDetails(null);
      } finally {
        setLoading(false);
      }
    };

    loadCohortDetails();
  }, [selectedTaskId, dateRange]);

  useEffect(() => {
    const loadSubmissions = async () => {
      if (!selectedTaskId) {
          setSubmissionsData([]);
          setPagination(prev => ({ ...prev, totalItems: 0, currentPage: 1 }));
          setSubmissionsLoading(false);
          return;
      }
      setSubmissionsLoading(true);
      try {
          const startDate = dateRange[0].format('YYYY-MM-DD');
          const endDate = dateRange[1].format('YYYY-MM-DD');
          const data = await fetchTaskSubmissions(selectedTaskId, startDate, endDate, pagination.currentPage, pagination.pageSize);
          setSubmissionsData(data.submissions || []);
          setPagination(data.pagination || { currentPage: 1, pageSize: 10, totalItems: 0 });
      } catch (err) {
          console.error('Error fetching submissions:', err);
          message.error(err.message || 'Failed to load submissions data.');
          setSubmissionsData([]); // Clear data on error
          setPagination(prev => ({ ...prev, totalItems: 0 })); // Reset total count
      } finally {
          setSubmissionsLoading(false);
      }
    };
    loadSubmissions();
    // Depend on selected task, date range, and current page/page size for pagination
  }, [selectedTaskId, dateRange, pagination.currentPage, pagination.pageSize]); 

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
      setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1 on date change
    } else {
       setDateRange([dayjs().subtract(30, 'days'), dayjs()]);
       setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
    }
  };

  const handleTaskChange = (value) => {
    setSelectedTaskId(value); 
    setCohortDetails(null); 
    setSubmissionsData([]); // Clear submissions
    setPagination(prev => ({ ...prev, currentPage: 1, totalItems: 0 })); // Reset pagination
    setError(null); 
    navigate(`/tasks/${value}`, { replace: true });
  };

  const handleTableChange = (newPagination) => {
    setPagination(prev => ({
        ...prev,
        currentPage: newPagination.current,
        pageSize: newPagination.pageSize,
    }));
  };

  const trendChartData = {
    labels: cohortDetails?.trends?.map(t => dayjs(t.date).format('MMM D')) || [],
    datasets: [
      {
        label: 'Average Score Trend',
        data: cohortDetails?.trends?.map(t => t.avg_score) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  const avgScore = cohortDetails?.average_score;
  const grade = avgScore !== null && avgScore !== undefined ? getLetterGrade(avgScore) : 'N/A';
  const gradeColor = getGradeColor(grade);

  // Define columns for the submissions table
  const submissionColumns = [
    {
        title: 'Builder',
        dataIndex: 'builder_name',
        key: 'builder_name',
        sorter: (a, b) => a.builder_name.localeCompare(b.builder_name),
    },
    {
        title: 'Date',
        dataIndex: 'date',
        key: 'date',
        render: (d) => d ? dayjs(d?.value || d).format('MMM D, YYYY') : 'N/A',
        sorter: (a, b) => dayjs(a.date?.value || a.date).unix() - dayjs(b.date?.value || b.date).unix(),
    },
    {
        title: 'Score',
        key: 'score',
        render: (_, record) => {
            const analysis = parseAnalysis(record.analysis);
            const score = analysis?.completion_score;
            const grade = score !== null && score !== undefined ? getLetterGrade(score) : 'N/A';
            const criteria = analysis?.criteria_met;
            if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
                return '-';
            }
            return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
        },
        sorter: (a, b) => {
            const scoreA = parseAnalysis(a.analysis)?.completion_score ?? -1;
            const scoreB = parseAnalysis(b.analysis)?.completion_score ?? -1;
            return scoreA - scoreB;
        }
    },
    {
        title: 'Assessment',
        key: 'assessment',
        render: (_, record) => {
            const analysis = parseAnalysis(record.analysis);
            const score = analysis?.completion_score;
            const grade = score !== null && score !== undefined ? getLetterGrade(score) : 'N/A';
            const criteria = analysis?.criteria_met;
            const areas = analysis?.areas_for_improvement;
            if (grade === 'Document Access Error' || (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received')) {
                return '-';
            }
            const criteriaTags = (Array.isArray(criteria) && criteria.length > 0)
              ? criteria.map(c => <Tag key={`crit-${c}`} color="green">{c}</Tag>)
              : null;
            const areaTags = (Array.isArray(areas) && areas.length > 0)
              ? areas.map(a => {
                  const label = a === "technical issue with analysis - please try again" ? "Tech Issue" : a;
                  return <Tag key={`area-${a}`} color="red">{label}</Tag>;
                })
              : null;
             if (!criteriaTags && !areaTags) return '-';
             return <Space wrap size={[0, 8]}>{criteriaTags}{areaTags}</Space>;
        }
    },
    {
        title: 'Feedback',
        key: 'feedback',
        render: (_, record) => {
            const analysis = parseAnalysis(record.analysis);
            const score = analysis?.completion_score;
            const grade = score !== null && score !== undefined ? getLetterGrade(score) : 'N/A';
            const criteria = analysis?.criteria_met;
            const feedback = analysis?.feedback;
            if (grade === 'Document Access Error') {
              return <Tag color="orange">Document Access Error</Tag>;
            }
            if (Array.isArray(criteria) && criteria.length === 1 && criteria[0] === 'Submission received') {
               return <Tag color="red">Tech Issue</Tag>;
            }
            return <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }} style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>{feedback || '-'}</Paragraph>;
        }
    },
    {
        title: 'Submission',
        key: 'submission',
        render: (_, record) => {
            // Use the new analyzed_content field
            const content = record.analyzed_content; 
            if (!content) return 'N/A';

            if (record.deliverable_type === 'link') {
                // Assume content is a URL if deliverable_type is link
                // Basic URL validation (can be improved)
                const isUrl = content.startsWith('http://') || content.startsWith('https://');
                return isUrl ? 
                    <Button type="link" href={content} target="_blank" rel="noopener noreferrer" style={{ padding: 0, height: 'auto' }}>View Link</Button> : 
                    <Text type="secondary">Invalid Link</Text>;
            } else {
                // Assume text content otherwise (from text submission or aggregated responses)
                return <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }} style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>{content}</Paragraph>;
            }
        }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Cohort Task Details</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col>
           <Space wrap>
             <Select
               showSearch
               style={{ width: 300 }}
               placeholder="Select a Task"
               loading={taskListLoading}
               value={selectedTaskId ? parseInt(selectedTaskId, 10) : undefined}
               onChange={handleTaskChange}
               filterOption={(input, option) => 
                  option.children.toLowerCase().includes(input.toLowerCase())
               }
               disabled={taskListLoading}
             >
               {taskList.map(task => (
                 <Option key={task.task_id} value={task.task_id}>
                   {task.task_title}
                 </Option>
               ))}
             </Select>
             <RangePicker value={dateRange} onChange={handleDateRangeChange} allowClear />
           </Space>
         </Col>
      </Row>

      {!selectedTaskId ? (
        <Card><Text>Please select a task to view details.</Text></Card>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
      ) : error ? (
        <Card><Typography.Text type="danger">Error loading details for Task {selectedTaskId}: {error}</Typography.Text></Card>
      ) : cohortDetails ? (
        <>
          <Title level={3} style={{ marginBottom: '20px' }}>{cohortDetails.task_title || `Task ${selectedTaskId}`}</Title>
          <Row gutter={[16, 24]}>
            <Col span={24}>
              <Card title="Overall Performance">
                {avgScore !== null && avgScore !== undefined ? (
                  <Space direction="vertical">
                      <Text>Average Score: {avgScore.toFixed(1)}</Text>
                      <Text>Overall Grade: <Tag className={getGradeTagClass(grade)}>{grade}</Tag></Text>
                  </Space>
                ) : (
                    <Text>No average score data available for this period.</Text>
                )}
              </Card>
            </Col>
             <Col xs={24} md={12}>
               <Card title="Common Strengths (Top 5)">
                 {cohortDetails.strengths && cohortDetails.strengths.length > 0 ? (
                     <List
                         size="small"
                         dataSource={cohortDetails.strengths}
                         renderItem={item => (
                             <List.Item>
                                 <Text>{item.item}</Text> <Tag>{item.count} occurrences</Tag>
                             </List.Item>
                         )}
                     />
                 ) : (
                     <Text>No common strengths identified.</Text>
                 )}
               </Card>
             </Col>
             <Col xs={24} md={12}>
               <Card title="Common Challenges (Top 5)">
                 {cohortDetails.challenges && cohortDetails.challenges.length > 0 ? (
                     <List
                         size="small"
                         dataSource={cohortDetails.challenges}
                         renderItem={item => (
                             <List.Item>
                                 <Text>{item.item}</Text> <Tag>{item.count} occurrences</Tag>
                             </List.Item>
                         )}
                     />
                 ) : (
                     <Text>No common challenges identified.</Text>
                 )}
               </Card>
             </Col>
             <Col span={24}>
                <Card title="Score Trend">
                    {cohortDetails.trends && cohortDetails.trends.length > 0 ? (
                        <Paragraph>
                            Trend Chart Placeholder. Data points: {cohortDetails.trends.length}
                        </Paragraph>
                     ) : (
                         <Text>No trend data available for this period.</Text>
                     )}
                </Card>
             </Col>
          </Row>
          
          <Divider />

          <Title level={4} style={{ marginBottom: '16px' }}>Individual Submissions</Title>
          <Table
            columns={submissionColumns}
            dataSource={submissionsData}
            loading={submissionsLoading}
            rowKey={(record, index) => `${record.user_id}-${record.date?.value || record.date}-${index}`}
            pagination={{
                current: pagination.currentPage,
                pageSize: pagination.pageSize,
                total: pagination.totalItems,
                showSizeChanger: true,
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        </>
      ) : (
        <Card><Text>No details found for Task {selectedTaskId} in the selected date range.</Text></Card> 
      )}
    </div>
  );
};

export default CohortTaskDetailsPage; 