import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Input, Select, Button, Modal, Typography, Tag, Space, Spin, Alert, message } from 'antd';
import { SearchOutlined, LinkOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Helper to attach auth header
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const VideoSubmissions = () => {
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [error, setError] = useState(null);
  const [availableCohorts, setAvailableCohorts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  
  // Filters
  const [selectedCohort, setSelectedCohort] = useState('');
  
  // Modal state
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Refs for API request cancellation
  const currentRequestRef = useRef(null);

  // Fetch video submissions data
  const fetchVideoSubmissions = async () => {
    // Cancel any previous request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    currentRequestRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/video-submissions', {
        headers: {
          ...getAuthHeaders()
        },
        signal: abortController.signal
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch video submissions');
      }

      const data = await response.json();
      setVideoData(Array.isArray(data) ? data : []);
      
      // Extract unique cohorts for filter dropdown
      const cohorts = [...new Set(data.map(item => item.cohort).filter(Boolean))].sort();
      setAvailableCohorts(cohorts);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Video submissions request was cancelled');
        return;
      }
      console.error('Error fetching video submissions:', error);
      setError('Failed to load video submissions. Please try again later.');
      message.error('Failed to load video submissions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed video analysis for modal
  const fetchVideoAnalysisDetails = async (videoId) => {
    setModalLoading(true);
    try {
      const response = await fetch(`/api/video-analyses/${videoId}`, {
        headers: {
          ...getAuthHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch video analysis details');
      }

      const data = await response.json();
      setSelectedVideo(data);
    } catch (error) {
      console.error('Error fetching video analysis details:', error);
      message.error('Failed to load video analysis details');
    } finally {
      setModalLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchVideoSubmissions();
  }, []);

  // Filter data based on selected filters
  useEffect(() => {
    let filtered = [...videoData];

    // Filter by cohort
    if (selectedCohort) {
      filtered = filtered.filter(item => item.cohort === selectedCohort);
    }

    setFilteredData(filtered);
  }, [videoData, selectedCohort]);

  // Calculate letter grade from video analysis scores
  const calculateLetterGrade = (technical, business, professional) => {
    if (technical === null || technical === undefined || 
        business === null || business === undefined || 
        professional === null || professional === undefined) return 'N/A';
    const average = (Number(technical) + Number(business) + Number(professional)) / 3;
    const percentage = (average / 5) * 100; // Convert from 5-point scale to percentage
    return getLetterGrade(percentage);
  };

  // Local sorting like other tables (e.g., WeeklySummary)
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getAverageScore5 = (record) => {
    const tech = Number(record.technical_score) || 0;
    const bus = Number(record.business_score) || 0;
    const prof = Number(record.professional_skills_score) || 0;
    return (tech + bus + prof) / 3;
  };

  // Helpers to dedupe duplicate rows caused by multi-cohort joins
  const getDateValue = (row) => row?.submission_date?.value || row?.submission_date || '';
  const getLevelRank = (cohortStr) => {
    const match = typeof cohortStr === 'string' ? cohortStr.match(/-\s*(L\d+)$/) : null;
    const level = match ? match[1] : null;
    if (level === 'L2') return 2;
    if (level === 'L1') return 1;
    return 0; // unknown
  };
  const dedupeBySubmission = (rows) => {
    const map = new Map();
    (rows || []).forEach((row) => {
      const key = row.submission_id != null
        ? String(row.submission_id)
        : `${row.user_id || ''}-${row.loom_url || ''}-${getDateValue(row)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, row);
      } else {
        const r1 = getLevelRank(row.cohort);
        const r0 = getLevelRank(existing.cohort);
        if (r1 > r0) {
          map.set(key, row);
        } else if (r1 === r0) {
          const d1 = dayjs(getDateValue(row));
          const d0 = dayjs(getDateValue(existing));
          if (d1.isAfter(d0)) map.set(key, row);
        }
      }
    });
    return Array.from(map.values());
  };

  const baseData = dedupeBySubmission(selectedCohort ? filteredData : videoData);
  const displayedData = baseData && baseData.length > 0 ? [...baseData].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const dir = sortConfig.direction === 'asc' ? 1 : -1;

    if (sortConfig.key === 'builder_name') {
      const aVal = (a.builder_name || '').toLowerCase();
      const bVal = (b.builder_name || '').toLowerCase();
      return aVal.localeCompare(bVal) * dir;
    }

    if (sortConfig.key === 'avg_score') {
      const aScore = getAverageScore5(a);
      const bScore = getAverageScore5(b);
      return (aScore - bScore) * dir;
    }

    if (sortConfig.key === 'submission_date') {
      const aDate = a.submission_date?.value || a.submission_date;
      const bDate = b.submission_date?.value || b.submission_date;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1 * dir;
      if (!bDate) return -1 * dir;
      return (dayjs(aDate).valueOf() - dayjs(bDate).valueOf()) * dir;
    }

    return 0;
  }) : baseData;

  // Ensure unique row keys even if backend provides duplicate identifiers
  const renderData = (displayedData || []).map((item, idx) => {
    const sid = item.submission_id != null ? String(item.submission_id) : '';
    const vid = item.video_id != null ? String(item.video_id) : '';
    const uid = item.user_id != null ? String(item.user_id) : '';
    const when = item.submission_date?.value || item.submission_date || '';
    return { ...item, _rowKey: `${sid}-${vid}-${uid}-${when}-${idx}` };
  });

  // Handle opening feedback modal
  const handleViewDetails = async (record) => {
    setFeedbackModalVisible(true);
    await fetchVideoAnalysisDetails(record.video_id || record.submission_id);
  };

  // Parse rationale JSON for display
  const parseRationale = (rationaleString) => {
    if (!rationaleString) return { overall_explanation: 'No explanation available' };
    try {
      const parsed = JSON.parse(rationaleString);
      return parsed;
    } catch (e) {
      return { overall_explanation: rationaleString };
    }
  };

  // Table columns definition
  const columns = [
    {
      title: (
        <div onClick={() => handleSort('builder_name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '32px', whiteSpace: 'nowrap' }}>
          Builder Name&nbsp;{getSortIcon('builder_name')}
        </div>
      ),
      dataIndex: 'builder_name',
      key: 'builder_name',
      filters: [...new Set(videoData.map(i => i.builder_name).filter(Boolean))]
        .sort()
        .map(n => ({ text: n, value: n })),
      filterSearch: true,
      onFilter: (value, record) => (record.builder_name || '').toLowerCase() === String(value).toLowerCase(),
    },
    {
      title: 'Video Link',
      dataIndex: 'loom_url',
      key: 'loom_url',
      render: (url) => url ? (
        <Button
          type="link"
          icon={<LinkOutlined />}
          onClick={() => window.open(url, '_blank')}
          style={{ padding: 0 }}
        >
          View Video
        </Button>
      ) : '-',
    },
    {
      title: (
        <div onClick={() => handleSort('avg_score')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '32px', whiteSpace: 'nowrap' }}>
          Score&nbsp;{getSortIcon('avg_score')}
        </div>
      ),
      key: 'score',
      render: (_, record) => {
        const grade = calculateLetterGrade(
          record.technical_score,
          record.business_score,
          record.professional_skills_score
        );
        return <Tag className={getGradeTagClass(grade)}>{grade}</Tag>;
      },
    },
    {
      title: (
        <div onClick={() => handleSort('submission_date')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '32px', whiteSpace: 'nowrap' }}>
          Submission Date&nbsp;{getSortIcon('submission_date')}
        </div>
      ),
      dataIndex: 'submission_date',
      key: 'submission_date',
      render: (date) => {
        if (!date) return '-';
        // Handle nested date object from BigQuery
        const dateValue = date.value || date;
        return dayjs(dateValue).format('MMM DD, YYYY');
      },
      defaultSortOrder: null,
    },
    {
      title: 'Cohort',
      dataIndex: 'cohort',
      key: 'cohort',
      filters: availableCohorts.map(cohort => ({ text: cohort, value: cohort })),
      onFilter: (value, record) => record.cohort === value,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
          size="small"
        >
          View Analysis
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Video Submissions</Title>
      
      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Space size="large" wrap>
          <div>
            <Text strong>Filter by Cohort:</Text>
            <Select
              style={{ width: 200, marginLeft: 8 }}
              placeholder="Select cohort"
              value={selectedCohort}
              onChange={setSelectedCohort}
              allowClear
            >
              {availableCohorts.map(cohort => (
                <Option key={cohort} value={cohort}>
                  {cohort}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      {/* Video Submissions Table */}
      <Card>
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}
        
        <Table
          columns={columns}
          dataSource={renderData}
          rowKey="_rowKey"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} submissions`,
          }}
          scroll={{ x: 1000 }}
          showSorterTooltip={false}
        />
      </Card>

      {/* Feedback Modal */}
      <Modal
        title={<span style={{ color: '#ffffff' }}>Video Analysis Details</span>}
        open={feedbackModalVisible}
        onCancel={() => {
          setFeedbackModalVisible(false);
          setSelectedVideo(null);
        }}
        footer={null}
        width={800}
        styles={{
          header: {
            backgroundColor: '#001529',
            borderBottom: '1px solid #303030'
          },
          body: {
            backgroundColor: '#141414',
            color: '#ffffff'
          }
        }}
      >
        {modalLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <p style={{ marginTop: '16px' }}>Loading video analysis...</p>
          </div>
        ) : selectedVideo ? (
          <div>
            {/* Basic Info */}
            <Card 
              size="small" 
              style={{ 
                marginBottom: '16px',
                backgroundColor: '#1f1f1f',
                borderColor: '#303030'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ color: '#ffffff' }}><strong style={{ color: '#ffffff' }}>Builder:</strong> {selectedVideo.user_name}</div>
                <div style={{ color: '#ffffff' }}><strong style={{ color: '#ffffff' }}>Task:</strong> {selectedVideo.task_title}</div>
                <div style={{ color: '#ffffff' }}>
                  <strong style={{ color: '#ffffff' }}>Submission Date:</strong>{' '}
                  {(() => {
                    const raw = selectedVideo.submission_date;
                    const value = raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
                    return value ? dayjs(value).format('MMM DD, YYYY') : 'N/A';
                  })()}
                </div>
                {selectedVideo.loom_url && (
                  <div style={{ color: '#ffffff' }}>
                    <strong style={{ color: '#ffffff' }}>Video:</strong>{' '}
                    <Button
                      type="link"
                      icon={<LinkOutlined />}
                      onClick={() => window.open(selectedVideo.loom_url, '_blank')}
                      style={{ padding: 0, color: '#1890ff' }}
                    >
                      View Video
                    </Button>
                  </div>
                )}
              </Space>
            </Card>

            {/* Scores */}
            <Card 
              title={<span style={{ color: '#ffffff' }}>Scores</span>}
              size="small" 
              style={{ 
                marginBottom: '16px',
                backgroundColor: '#1f1f1f',
                borderColor: '#303030'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ color: '#ffffff' }}><strong style={{ color: '#ffffff' }}>Technical Score:</strong> {selectedVideo.technical_score}/5</div>
                <div style={{ color: '#ffffff' }}><strong style={{ color: '#ffffff' }}>Business Score:</strong> {selectedVideo.business_score}/5</div>
                <div style={{ color: '#ffffff' }}><strong style={{ color: '#ffffff' }}>Professional Skills Score:</strong> {selectedVideo.professional_skills_score}/5</div>
                <div style={{ color: '#ffffff' }}>
                  <strong style={{ color: '#ffffff' }}>Overall Grade:</strong>{' '}
                  <Tag className={getGradeTagClass(calculateLetterGrade(
                    selectedVideo.technical_score,
                    selectedVideo.business_score,
                    selectedVideo.professional_skills_score
                  ))}>
                    {calculateLetterGrade(
                      selectedVideo.technical_score,
                      selectedVideo.business_score,
                      selectedVideo.professional_skills_score
                    )}
                  </Tag>
                </div>
              </Space>
            </Card>

            {/* Feedback Details (expanded to match other modals) */}
            <Card 
              title={<span style={{ color: '#ffffff' }}>Feedback</span>}
              size="small" 
              style={{ 
                marginBottom: '16px',
                backgroundColor: '#1f1f1f',
                borderColor: '#303030'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {(() => {
                  const tech = parseRationale(selectedVideo.technical_score_rationale || '');
                  const biz = parseRationale(selectedVideo.business_score_rationale || '');
                  const prof = parseRationale(selectedVideo.professional_skills_score_rationale || '');

                  const renderSection = (title, score, data) => (
                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ color: '#ffffff' }}>{title} ({score}/5)</strong>
                      <Paragraph style={{ 
                        marginTop: '8px', padding: '12px', backgroundColor: '#2a2a2a', 
                        borderRadius: '6px', color: '#ffffff', border: '1px solid #404040'
                      }}>
                        {data.overall_explanation || 'No feedback provided.'}
                      </Paragraph>
                      {data.overall_supporting_evidence && (
                        <div style={{ marginTop: '8px' }}>
                          <strong style={{ color: '#ffffff' }}>Supporting Evidence:</strong>
                          <Paragraph style={{ color: '#d0d0d0', fontStyle: 'italic' }}>
                            {data.overall_supporting_evidence}
                          </Paragraph>
                        </div>
                      )}
                      {data.sub_criteria && typeof data.sub_criteria === 'object' && (
                        <div style={{ marginTop: '8px' }}>
                          <strong style={{ color: '#ffffff' }}>Detailed Criteria:</strong>
                          {Object.entries(data.sub_criteria).map(([name, item]) => (
                            <Paragraph key={name} style={{ color: '#d0d0d0', marginBottom: '8px' }}>
                              <span style={{ color: '#ffffff' }}>{name}:</span>{' '}
                              {item?.explanation || 'N/A'} {item?.score ? `(${item.score}/5)` : ''}
                            </Paragraph>
                          ))}
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <>
                      {selectedVideo.technical_score_rationale && renderSection('Technical Feedback', selectedVideo.technical_score, tech)}
                      {selectedVideo.business_score_rationale && renderSection('Business Feedback', selectedVideo.business_score, biz)}
                      {selectedVideo.professional_skills_score_rationale && renderSection('Professional Skills Feedback', selectedVideo.professional_skills_score, prof)}
                    </>
                  );
                })()}
              </Space>
            </Card>
          </div>
        ) : (
          <Alert
            message="No data available"
            description="Unable to load video analysis details."
            type="warning"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
};

export default VideoSubmissions;
