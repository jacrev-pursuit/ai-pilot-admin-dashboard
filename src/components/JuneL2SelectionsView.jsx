import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  DatePicker, 
  Space, 
  Button, 
  Alert, 
  Select, 
  Spin, 
  Typography, 
  Tag, 
  message,
  Rate,
  Dropdown,
  Menu,
  Input,
  Checkbox
} from 'antd';
import { UserOutlined, EyeOutlined, LinkOutlined, DownOutlined, FilterOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import BuilderDetailsModal from './BuilderDetailsModal';
import DemoRatingModal from './DemoRatingModal';
import PeerFeedbackChart from './PeerFeedbackChart';
import { getLetterGrade, getGradeTagClass } from '../utils/gradingUtils';

const { Title, Text } = Typography;
const { Option } = Select;

const JuneL2SelectionsView = () => {
  // State with all-time date range and level for June 2025 - L2
  const [startDate] = useState(dayjs('2000-01-01').startOf('day')); // All time start
  const [endDate] = useState(dayjs('2100-12-31').endOf('day')); // All time end
  const [selectedLevel] = useState('June 2025 - L1'); // Fixed to June 2025 - L1 (data source)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Builders table state
  const [builders, setBuilders] = useState([]);
  const [buildersLoading, setBuildersLoading] = useState(false);
  const [buildersError, setBuildersError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState(null);

  // New state for interactive columns
  const [videoRatings, setVideoRatings] = useState({}); // Store ratings by user_id
  const [selectionStatuses, setSelectionStatuses] = useState({}); // Store selection status by user_id

  // Demo rating modal state
  const [demoModalVisible, setDemoModalVisible] = useState(false);
  const [selectedBuilderForDemo, setSelectedBuilderForDemo] = useState(null);
  const [selectedDemoRating, setSelectedDemoRating] = useState(0);

  // Existing feedback state - simplified since we're using only DemoRatingModal now
  const [existingFeedback, setExistingFeedback] = useState({}); // Store feedback by builder_id

  // Filter state - Excel style with arrays of selected values
  const [selectedBuilderNames, setSelectedBuilderNames] = useState([]);
  const [selectedSelectionStatuses, setSelectedSelectionStatuses] = useState([]);
  
  // Search state for filter dropdowns
  const [builderNameSearch, setBuilderNameSearch] = useState('');
  
  // Dropdown visibility and temporary state
  const [builderFilterVisible, setBuilderFilterVisible] = useState(false);
  const [tempSelectedBuilderNames, setTempSelectedBuilderNames] = useState([]);

  // Fetch builders data on component mount
  useEffect(() => {
    fetchBuildersData();
  }, []);

  // Fetch existing feedback when builders data changes
  useEffect(() => {
    if (builders.length > 0) {
      fetchExistingFeedback();
    }
  }, [builders]);

  // Fetch builders data
  const fetchBuildersData = async () => {
    setBuildersLoading(true);

    try {
      const params = new URLSearchParams({
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        level: selectedLevel
      });

      const response = await fetch(`/api/builders?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch builders data');
      }
      const data = await response.json();
      setBuilders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching builders data:', error);
      setBuildersError('Failed to fetch builders data. Please try again later.');
      setBuilders([]);
      message.error('Failed to fetch builders data');
    } finally {
      setBuildersLoading(false);
    }
  };

  // Handle video rating change
  const handleVideoRatingChange = (userId, rating) => {
    // Find the builder record for this user_id
    const builder = builders.find(b => b.user_id === userId);
    if (builder) {
      // Check if video exists
      const hasVideo = builder.latest_loom_url && builder.latest_loom_url.includes('loom.com');
      if (!hasVideo) {
        message.warning('Cannot rate demo - no video available for this builder');
        return;
      }
      
      setSelectedBuilderForDemo(builder);
      setSelectedDemoRating(rating);
      setDemoModalVisible(true);
    }
  };

  // Save demo feedback
  const saveDemoFeedback = async (feedbackData) => {
    try {
      // Include the current selection status when saving
      const currentSelectionStatus = selectionStatuses[feedbackData.builder_id] || 'pending';
      const dataWithSelection = {
        ...feedbackData,
        selection_status: currentSelectionStatus
      };
      
      console.log('Saving demo feedback with data:', dataWithSelection);
      
      const response = await fetch('/api/human-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataWithSelection)
      });

      if (!response.ok) {
        throw new Error('Failed to save demo feedback');
      }

      // Update the local rating state after successful save
      setVideoRatings(prev => ({
        ...prev,
        [feedbackData.builder_id]: feedbackData.score
      }));

      // Update local feedback state with updated feedback (optimize performance)
      const responseData = await response.json();
      const updatedFeedback = {
        builder_id: feedbackData.builder_id,
        task_id: feedbackData.task_id,
        submission_id: feedbackData.submission_id,
        score: feedbackData.score,
        technical_feedback: feedbackData.technical_feedback,
        business_feedback: feedbackData.business_feedback,
        professional_feedback: feedbackData.professional_feedback,
        overall_notes: feedbackData.overall_notes,
        selection_status: feedbackData.selection_status,
        created_at: existingFeedback[feedbackData.builder_id]?.[0]?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Update existing feedback state - replace the first record (since we're using upsert)
      setExistingFeedback(prev => ({
        ...prev,
        [feedbackData.builder_id]: [updatedFeedback]
      }));

      return responseData;
    } catch (error) {
      console.error('Error saving demo feedback:', error);
      throw error;
    }
  };

  // Close demo modal
  const handleDemoModalClose = () => {
    setDemoModalVisible(false);
    setSelectedBuilderForDemo(null);
    setSelectedDemoRating(0);
  };

  // Fetch existing feedback for all builders
  const fetchExistingFeedback = async () => {
    try {
      const feedbackPromises = builders.map(async (builder) => {
        try {
          const response = await fetch(`/api/human-review/${builder.user_id}`);
          if (response.ok) {
            const data = await response.json();
            return { builderId: builder.user_id, feedback: data.data || [] };
          }
          return { builderId: builder.user_id, feedback: [] };
        } catch (error) {
          console.error(`Error fetching feedback for builder ${builder.user_id}:`, error);
          return { builderId: builder.user_id, feedback: [] };
        }
      });

      const results = await Promise.all(feedbackPromises);
      const feedbackMap = {};
      results.forEach(({ builderId, feedback }) => {
        feedbackMap[builderId] = feedback;
        // Also update the rating and selection status state if we have feedback
        if (feedback.length > 0) {
          const latestFeedback = feedback[0]; // Most recent feedback
          setVideoRatings(prev => ({
            ...prev,
            [builderId]: latestFeedback.score
          }));
          
          // Update selection status from the database
          if (latestFeedback.selection_status) {
            setSelectionStatuses(prev => ({
              ...prev,
              [builderId]: latestFeedback.selection_status
            }));
          }
        }
      });
      setExistingFeedback(feedbackMap);
    } catch (error) {
      console.error('Error fetching existing feedback:', error);
    }
  };

  // Open notes modal directly with existing feedback pre-populated
  const openNotesModal = (record) => {
    const existingRating = videoRatings[record.user_id] || 0;
    setSelectedBuilderForDemo(record);
    setSelectedDemoRating(existingRating);
    setDemoModalVisible(true);
  };

  // Handle selection status change
  const handleSelectionStatusChange = async (userId, status) => {
    try {
      // Update local state immediately
      setSelectionStatuses(prev => ({
        ...prev,
        [userId]: status
      }));

      // Save to database - create a minimal record with just selection status
      const builder = builders.find(b => b.user_id === userId);
      if (builder) {
        const selectionData = {
          builder_id: userId,
          task_id: builder.latest_task_id || null,
          submission_id: builder.latest_submission_id || null,
          score: videoRatings[userId] || 0, // Use existing rating or 0
          technical_feedback: '',
          business_feedback: '',
          professional_feedback: '',
          overall_notes: '',
          selection_status: status
        };

        console.log('Saving selection status with data:', selectionData);

        const response = await fetch('/api/human-review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(selectionData)
        });

        if (!response.ok) {
          throw new Error('Failed to save selection status');
        }

        message.success(`Selection status updated to "${status}"`);
        
        // Update local feedback state with updated selection status (optimize performance)
        const existingData = existingFeedback[userId]?.[0] || {};
        const updatedFeedback = {
          builder_id: userId,
          task_id: selectionData.task_id,
          submission_id: selectionData.submission_id,
          score: selectionData.score,
          technical_feedback: existingData.technical_feedback || '',
          business_feedback: existingData.business_feedback || '',
          professional_feedback: existingData.professional_feedback || '',
          overall_notes: existingData.overall_notes || '',
          selection_status: status,
          created_at: existingData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Update existing feedback state - replace the record (since we're using upsert)
        setExistingFeedback(prev => ({
          ...prev,
          [userId]: [updatedFeedback]
        }));
      }
    } catch (error) {
      console.error('Error saving selection status:', error);
      message.error('Failed to save selection status');
      
      // Revert local state change on error
      setSelectionStatuses(prev => ({
        ...prev,
        [userId]: prev[userId] || 'pending'
      }));
    }
  };

  // Get selection status menu
  const getSelectionStatusMenu = (userId) => (
    <Menu onClick={({ key }) => handleSelectionStatusChange(userId, key)}>
      <Menu.Item key="strong">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
        </div>
      </Menu.Item>
      <Menu.Item key="maybe">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <span style={{ fontSize: '20px' }}>❓</span>
        </div>
      </Menu.Item>
      <Menu.Item key="drop">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <span style={{ fontSize: '20px' }}>❌</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  // Get current selection status display
  const getSelectionStatusDisplay = (userId) => {
    const status = selectionStatuses[userId] || 'pending';
    const statusConfig = {
      strong: { emoji: '✅' },
      maybe: { emoji: '❓' },
      drop: { emoji: '❌' },
      pending: { emoji: '⚫' }
    };
    const config = statusConfig[status];
    return (
      <span style={{ fontSize: '18px', cursor: 'pointer' }}>
        {config.emoji}
      </span>
    );
  };

  // Builders table sorting and utilities
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '⇅';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Sort builders based on current sort config
  const sortedBuilders = builders && builders.length > 0 ? [...builders].sort((a, b) => {
    let aValue, bValue;
    
    // Special handling for demo rating sorting
    if (sortConfig.key === 'demo_rating') {
      aValue = videoRatings[a.user_id] || 0;
      bValue = videoRatings[b.user_id] || 0;
    } else {
      aValue = a[sortConfig.key];
      bValue = b[sortConfig.key];
    }
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortConfig.direction === 'asc' 
      ? aValue - bValue
      : bValue - aValue;
  }) : [];

  // Get unique values for filters
  const getUniqueBuilderNames = () => {
    return [...new Set(builders.map(builder => builder.name))].sort();
  };

  const getUniqueSelectionStatuses = () => {
    const statuses = [...new Set(builders.map(builder => selectionStatuses[builder.user_id] || 'pending'))];
    // Sort in a specific order
    const order = ['strong', 'maybe', 'pending', 'drop'];
    return statuses.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };

  // Filter builders based on selected values (Excel style)
  const filteredBuilders = sortedBuilders.filter(builder => {
    // Filter by builder name - empty array = show all, non-empty = show only selected
    const nameMatches = selectedBuilderNames.length === 0 || selectedBuilderNames.includes(builder.name);
    
    // Filter by selection status  
    const selectionStatus = selectionStatuses[builder.user_id] || 'pending';
    const selectionMatches = selectedSelectionStatuses.length === 0 || 
      selectedSelectionStatuses.includes(selectionStatus);
    
    return nameMatches && selectionMatches;
  });

  // Export function
  const exportToCSV = () => {
    try {
      // Calculate average task score for a builder
      const calculateAverageTaskScore = (builder) => {
        const grades = {
          'C': { count: builder.grade_c_count || 0, value: 70 },
          'C+': { count: builder.grade_cplus_count || 0, value: 75 },
          'B-': { count: builder.grade_bminus_count || 0, value: 80 },
          'B': { count: builder.grade_b_count || 0, value: 83 },
          'B+': { count: builder.grade_bplus_count || 0, value: 87 },
          'A-': { count: builder.grade_aminus_count || 0, value: 90 },
          'A': { count: builder.grade_a_count || 0, value: 93 },
          'A+': { count: builder.grade_aplus_count || 0, value: 97 }
        };
        
        let totalScore = 0;
        let totalTasks = 0;
        
        Object.values(grades).forEach(grade => {
          totalScore += grade.count * grade.value;
          totalTasks += grade.count;
        });
        
        return totalTasks > 0 ? Math.round(totalScore / totalTasks) : 0;
      };

      // Get notes content for a builder
      const getNotes = (builderId) => {
        const feedback = existingFeedback[builderId] || [];
        if (feedback.length === 0) return '';
        
        const latest = feedback[0];
        const noteParts = [];
        
        if (latest.technical_feedback && latest.technical_feedback.trim()) {
          noteParts.push(`Technical: ${latest.technical_feedback.trim()}`);
        }
        if (latest.business_feedback && latest.business_feedback.trim()) {
          noteParts.push(`Business: ${latest.business_feedback.trim()}`);
        }
        if (latest.professional_feedback && latest.professional_feedback.trim()) {
          noteParts.push(`Professional: ${latest.professional_feedback.trim()}`);
        }
        if (latest.overall_notes && latest.overall_notes.trim()) {
          noteParts.push(`Overall: ${latest.overall_notes.trim()}`);
        }
        
        return noteParts.join(' | ');
      };

      // Create CSV data
      const csvData = filteredBuilders.map(builder => {
        const selectionStatus = selectionStatuses[builder.user_id] || 'pending';
        const selectionLabels = {
          'strong': 'Strong',
          'maybe': 'Maybe', 
          'drop': 'Drop',
          'pending': 'Pending'
        };

        return {
          'Builder Name': builder.name || '',
          'Builder Email': builder.email || '',
          'Attendance %': builder.attendance_percentage || 0,
          'Tasks %': builder.tasks_completed_percentage || 0,
          'Peer Feedback Count': builder.total_peer_feedback_count || 0,
          '# Negative Peer Feedback': builder.negative_feedback_count || 0,
          'Average Task Score': calculateAverageTaskScore(builder),
          '# of Videos Submitted': builder.video_tasks_completed || 0,
          'Avg Video Score': builder.avg_video_score || 0,
          'Demo Rating': videoRatings[builder.user_id] || 0,
          'Notes': getNotes(builder.user_id),
          'Selection': selectionLabels[selectionStatus] || 'Pending'
        };
      });

      // Convert to CSV format
      if (csvData.length === 0) {
        message.warning('No data to export');
        return;
      }

      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or quote
            const stringValue = String(value).replace(/"/g, '""');
            return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') 
              ? `"${stringValue}"` 
              : stringValue;
          }).join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `june-l2-selections-${dayjs().format('YYYY-MM-DD')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success(`Exported ${csvData.length} builders to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export data');
    }
  };

  // Excel-style filter menu for builder names
  const getBuilderNameFilterMenu = () => {
    const uniqueNames = getUniqueBuilderNames();
    const filteredNames = uniqueNames.filter(name => 
      name.toLowerCase().includes(builderNameSearch.toLowerCase())
    );
    
    // Simplified logic: checkboxes reflect what's actually in tempSelectedBuilderNames
    const allFilteredSelected = filteredNames.length > 0 && filteredNames.every(name => tempSelectedBuilderNames.includes(name));
    const someFilteredSelected = filteredNames.some(name => tempSelectedBuilderNames.includes(name)) && !allFilteredSelected;
    
    const handleSaveFilter = () => {
      setSelectedBuilderNames([...tempSelectedBuilderNames]);
      setBuilderFilterVisible(false);
      setBuilderNameSearch('');
    };
    
    const handleCancelFilter = () => {
      setTempSelectedBuilderNames([]); // Reset to empty (no changes applied)
      setBuilderFilterVisible(false);
      setBuilderNameSearch('');
    };
    
    return (
      <Menu 
        onClick={(e) => e.domEvent.stopPropagation()} 
        style={{ maxHeight: '400px', overflowY: 'auto', minWidth: '280px' }}
      >
        {/* Search Input */}
        <Menu.Item key="search" style={{ borderBottom: '1px solid #f0f0f0', padding: '8px' }}>
          <Input
            size="small"
            placeholder="Search names..."
            value={builderNameSearch}
            onChange={(e) => {
              e.stopPropagation();
              setBuilderNameSearch(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
            allowClear
            autoFocus
          />
        </Menu.Item>
        
        {/* Controls Row */}
        <Menu.Item key="controls" style={{ borderBottom: '1px solid #f0f0f0', padding: '8px' }}>
          <Checkbox
            checked={allFilteredSelected}
            indeterminate={someFilteredSelected}
            onChange={(e) => {
              if (e.target.checked) {
                // Add all filtered names to selection
                setTempSelectedBuilderNames(prev => {
                  const newSelection = new Set([...prev, ...filteredNames]);
                  return Array.from(newSelection);
                });
              } else {
                // Remove all filtered names from selection
                setTempSelectedBuilderNames(prev => prev.filter(name => !filteredNames.includes(name)));
              }
            }}
          >
            Select All
          </Checkbox>
        </Menu.Item>
        
        {/* Individual Name Checkboxes */}
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {filteredNames.length === 0 ? (
            <Menu.Item key="no-results" disabled>
              <span style={{ color: '#999', fontStyle: 'italic' }}>No names match search</span>
            </Menu.Item>
          ) : (
            filteredNames.map(name => (
              <Menu.Item key={name}>
                              <Checkbox
                checked={tempSelectedBuilderNames.includes(name)}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Add this name to selection
                    setTempSelectedBuilderNames(prev => [...prev, name]);
                  } else {
                    // Remove this name from selection
                    setTempSelectedBuilderNames(prev => prev.filter(n => n !== name));
                  }
                }}
              >
                  {name}
                </Checkbox>
              </Menu.Item>
            ))
          )}
        </div>
        
        {/* Action Buttons */}
        <Menu.Divider />
        <Menu.Item key="actions" style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleCancelFilter();
              }}
            >
              Cancel
            </Button>
            <Button 
              size="small" 
              type="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveFilter();
              }}
            >
              Apply Filter
            </Button>
          </div>
        </Menu.Item>
      </Menu>
    );
  };

  // Excel-style filter menu for selection status
  const getSelectionStatusFilterMenu = () => {
    const uniqueStatuses = getUniqueSelectionStatuses();
    const allSelected = selectedSelectionStatuses.length === 0;
    
    const statusLabels = {
      'strong': '✅ Strong',
      'maybe': '❓ Maybe',
      'drop': '❌ Drop',
      'pending': '⚫ Pending'
    };
    
    return (
      <Menu onClick={(e) => e.domEvent.stopPropagation()} style={{ maxHeight: '300px', overflowY: 'auto' }}>
        <Menu.Item key="select-all" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <Checkbox
            checked={allSelected}
            indeterminate={selectedSelectionStatuses.length > 0 && selectedSelectionStatuses.length < uniqueStatuses.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedSelectionStatuses([]);
              } else {
                setSelectedSelectionStatuses([...uniqueStatuses]);
              }
            }}
          >
            Select All
          </Checkbox>
        </Menu.Item>
        {uniqueStatuses.map(status => (
          <Menu.Item key={status}>
            <Checkbox
              checked={selectedSelectionStatuses.length === 0 || selectedSelectionStatuses.includes(status)}
              onChange={(e) => {
                if (selectedSelectionStatuses.length === 0) {
                  // Currently showing all, clicking unchecked means exclude this item
                  setSelectedSelectionStatuses(uniqueStatuses.filter(s => s !== status));
                } else {
                  // Some items are filtered
                  if (selectedSelectionStatuses.includes(status)) {
                    // Item is selected, remove it
                    setSelectedSelectionStatuses(prev => prev.filter(s => s !== status));
                  } else {
                    // Item is not selected, add it
                    setSelectedSelectionStatuses(prev => [...prev, status]);
                  }
                }
              }}
            >
              {statusLabels[status] || status}
            </Checkbox>
          </Menu.Item>
        ))}
      </Menu>
    );
  };

  // Calculate max feedback count for scaling
  const maxFeedbackCount = builders && builders.length > 0 
    ? Math.max(...builders.map(builder => builder.total_peer_feedback_count || 0))
    : 100;

  // Enhanced Builders table columns for June L1 Selections
  const buildersColumns = [
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div 
            onClick={() => handleSort('name')} 
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              fontWeight: sortConfig.key === 'name' ? 'bold' : 'normal',
              fontSize: '13px'
            }}
          >
            Builder Name {getSortIcon('name')}
          </div>
          <Dropdown 
            overlay={getBuilderNameFilterMenu()} 
            trigger={['click']}
            placement="bottomRight"
            visible={builderFilterVisible}
            onVisibleChange={(visible) => {
              if (visible) {
                // Always start with empty selection (all checkboxes unchecked)
                setTempSelectedBuilderNames([]);
                setBuilderFilterVisible(true);
              } else {
                // Only close if not clicking inside the dropdown
                setBuilderFilterVisible(false);
                setBuilderNameSearch(''); // Clear search when dropdown closes
              }
            }}
          >
            <FilterOutlined 
              style={{ 
                fontSize: '12px', 
                cursor: 'pointer',
                color: selectedBuilderNames.length > 0 ? '#1890ff' : '#8c8c8c'
              }}
            />
          </Dropdown>
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      width: '12%',
      render: (text, record) => (
        <span style={{ fontWeight: '500' }}>
          {text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
        </span>
      ),
    },
    {
      title: (
        <div onClick={() => handleSort('attendance_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'attendance_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Attendance {getSortIcon('attendance_percentage')}
        </div>
      ),
      dataIndex: 'attendance_percentage',
      key: 'attendance_percentage',
      width: '7%',
      render: (text, record) => {
        const attendancePercentage = record.attendance_percentage || 0;
        const daysAttended = record.days_attended || 0;
        const totalDays = record.total_curriculum_days || 0;
        
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: attendancePercentage >= 90 ? '#52c41a' : attendancePercentage >= 80 ? '#faad14' : '#ff4d4f' }}>
              {attendancePercentage}%
            </div>
            <div style={{ fontSize: '10px', color: '#8c8c8c' }}>
              {daysAttended}/{totalDays}
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('tasks_completed_percentage')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'tasks_completed_percentage' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Tasks {getSortIcon('tasks_completed_percentage')}
        </div>
      ),
      dataIndex: 'tasks_completed_percentage',
      key: 'tasks_completed_percentage',
      width: '7%',
      render: (text) => (
        <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#1890ff' }}>
          {text === null ? '-' : `${text}%`}
        </div>
      ),
    },
    {
      title: (
        <div onClick={() => handleSort('total_peer_feedback_count')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'total_peer_feedback_count' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Peer Feedback {getSortIcon('total_peer_feedback_count')}
        </div>
      ),
      dataIndex: 'total_peer_feedback_count',
      key: 'total_peer_feedback_count',
      width: '9%',
      render: (text, record) => {
        return (
          <div onClick={() => handleBuilderExpand('peer_feedback', record)} style={{ cursor: 'pointer' }}>
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
        <div onClick={() => handleSort('total_graded_tasks')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'total_graded_tasks' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Scores {getSortIcon('total_graded_tasks')}
        </div>
      ),
      dataIndex: 'total_graded_tasks',
      key: 'total_graded_tasks',
      width: '14%',
      render: (text, record) => {
        return (
          <div onClick={() => handleBuilderExpand('allTasks', record)} style={{ cursor: 'pointer' }}>
            {renderBuilderGradeDistribution(record)}
          </div>
        );
      },
    },
    {
      title: (
        <div onClick={() => handleSort('avg_video_score')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'avg_video_score' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Videos {getSortIcon('avg_video_score')}
        </div>
      ),
      dataIndex: 'avg_video_score',
      key: 'avg_video_score',
      width: '9%',
      render: (text, record) => {
        const videoCount = record.video_tasks_completed || 0;
        const avgScore = record.avg_video_score;
        
        if (videoCount === 0) {
          return <Text type="secondary" style={{ fontSize: '11px' }}>No videos</Text>;
        }
        
        const grade = avgScore ? getLetterGrade(avgScore) : null;
        
        return (
          <div onClick={() => handleBuilderExpand('videoTasks', record)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {videoCount}
            </div>
            {grade && (
              <Tag 
                className={getGradeTagClass(grade)} 
                style={{ fontSize: '11px', margin: 0, padding: '2px 6px' }}
              >
                {grade}
              </Tag>
            )}
          </div>
        );
      },
    },
    // NEW: Recent Loom Video column (condensed)
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          Latest Video
        </div>
      ),
      key: 'recent_loom_video',
      width: '8%',
      render: (text, record) => {
        const loomUrl = record.latest_loom_url;
        
        if (loomUrl && loomUrl.includes('loom.com')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <a 
                href={loomUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#1890ff' }}
              >
                <LinkOutlined style={{ fontSize: '10px' }} /> View
              </a>
            </div>
          );
        }
        
        return (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '10px' }}>
              No video
            </Text>
          </div>
        );
      },
    },
    // NEW: Video Rating column (expanded for all 5 stars in one row)
    {
      title: (
        <div onClick={() => handleSort('demo_rating')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: sortConfig.key === 'demo_rating' ? 'bold' : 'normal', height: '32px', whiteSpace: 'nowrap' }}>
          Demo Rating {getSortIcon('demo_rating')}
        </div>
      ),
      dataIndex: 'demo_rating',
      key: 'demo_rating',
      width: '12%',
      render: (text, record) => {
        const hasVideo = record.latest_loom_url && record.latest_loom_url.includes('loom.com');
        const rating = videoRatings[record.user_id] || 0;
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Rate
              value={rating}
              onChange={hasVideo ? (rating) => handleVideoRatingChange(record.user_id, rating) : undefined}
              disabled={!hasVideo}
              style={{ 
                fontSize: '14px', 
                whiteSpace: 'nowrap',
                filter: hasVideo ? 'none' : 'grayscale(100%) opacity(0.3)'
              }}
            />
          </div>
        );
      },
    },
    // NEW: Notes column to view existing feedback
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          Notes
        </div>
      ),
      key: 'notes',
      width: '6%',
      render: (text, record) => {
        const feedback = existingFeedback[record.user_id] || [];
        const hasFeedback = feedback.length > 0;
        
        return (
          <div style={{ textAlign: 'center' }}>
            <Button
              type="link"
              size="small"
              onClick={() => openNotesModal(record)}
              style={{ 
                padding: '2px 6px',
                fontSize: '10px',
                color: hasFeedback ? '#1890ff' : '#8c8c8c'
              }}
              title={hasFeedback ? `Edit ${feedback.length} note${feedback.length > 1 ? 's' : ''}` : 'Add note'}
            >
              {hasFeedback ? `📝 ${feedback.length}` : '📝 +'}
            </Button>
          </div>
        );
      },
    },
    // UPDATED: Selection Status column with Excel-style filter
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ 
            fontSize: '13px',
            fontWeight: 'normal'
          }}>
            Selection
          </div>
          <Dropdown 
            overlay={getSelectionStatusFilterMenu()} 
            trigger={['click']}
            placement="bottomRight"
          >
            <FilterOutlined 
              style={{ 
                fontSize: '12px', 
                cursor: 'pointer',
                color: selectedSelectionStatuses.length > 0 ? '#1890ff' : '#8c8c8c'
              }}
            />
          </Dropdown>
        </div>
      ),
      key: 'selection_status',
      width: '10%',
      render: (text, record) => (
        <Dropdown 
          overlay={getSelectionStatusMenu(record.user_id)} 
          trigger={['click']}
          placement="bottomLeft"
        >
          <div style={{ 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '4px'
          }}>
            {getSelectionStatusDisplay(record.user_id)}
          </div>
        </Dropdown>
      ),
    },
  ];

  // Helper function to render builder grade distribution
  const renderBuilderGradeDistribution = (builder) => {
    const grades = {
      'C': builder.grade_c_count || 0,
      'C+': builder.grade_cplus_count || 0,
      'B-': builder.grade_bminus_count || 0,
      'B': builder.grade_b_count || 0,
      'B+': builder.grade_bplus_count || 0,
      'A-': builder.grade_aminus_count || 0,
      'A': builder.grade_a_count || 0,
      'A+': builder.grade_aplus_count || 0
    };

    const total = builder.total_graded_tasks || 0;
    
    if (total === 0) {
      return <Text type="secondary" style={{ fontSize: '12px' }}>No grades yet</Text>;
    }

    // Grade colors matching exactly the WeeklySummary component
    const gradeColors = {
      'A+': '#1e4d28', // Very dark green
      'A': '#38761d',  // Green
      'A-': '#4a9625', // Light green
      'B+': '#bf9002', // Gold
      'B': '#d4a419',  // Light gold
      'B-': '#e6b800', // Lighter gold
      'C+': '#b45f06', // Orange
      'C': '#cc6900'   // Light orange
    };

    return (
      <div style={{ width: '120px' }}>
        <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#2d2d2d' }}>
          {Object.entries(grades).map(([grade, count]) => {
            if (count === 0) return null;
            const percentage = (count / total) * 100;
            return (
              <div
                key={grade}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: gradeColors[grade],
                  height: '100%'
                }}
                title={`${grade}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c8c8c', marginTop: '2px' }}>
          <span>C</span>
          <span>Total: {total}</span>
          <span>A+</span>
        </div>
      </div>
    );
  };

  // Handle builder modal expansion
  const handleBuilderExpand = async (type, record) => {
    setSelectedBuilder(record);
    setModalType(type);
    setModalVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDetailsLoading(true);
    setBuildersError(null);

    try {
      const response = await fetch(`/api/builders/${record.user_id}/details?type=${type}&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`);
      if (!response.ok) {
        throw new Error('Failed to fetch builder details');
      }
      const details = await response.json();
      setDetailsData(details);
    } catch (error) {
      console.error('Error fetching details:', error);
      setBuildersError('Failed to fetch builder details. Please try again later.');
      message.error('Failed to fetch details');
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>
          <Text>Loading June L2 selections data...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1680px', margin: '0 auto' }}>
      {/* Custom styles for better star visibility */}
      <style>
        {`
          .ant-rate-star:not(.ant-rate-star-full) .ant-rate-star-second {
            color: rgba(255, 255, 255, 0.65) !important;
          }
          .ant-rate-star:not(.ant-rate-star-full) .ant-rate-star-first {
            color: rgba(255, 255, 255, 0.25) !important;
          }
          .ant-rate-star-full .ant-rate-star-second,
          .ant-rate-star-half .ant-rate-star-first {
            color: #faad14 !important;
          }
          .ant-rate:hover .ant-rate-star:not(.ant-rate-star-full) .ant-rate-star-second {
            color: rgba(255, 255, 255, 0.85) !important;
          }
        `}
      </style>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>June L2 Selections</Title>
        <Space>
          <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
            June 2025 - L1 Data
          </Tag>
          <Tag color="purple" style={{ fontSize: '14px', padding: '4px 8px' }}>
            All Time Data
          </Tag>
          {(selectedBuilderNames.length > 0 || selectedSelectionStatuses.length > 0) && (
            <Button 
              size="small"
              onClick={() => {
                setSelectedBuilderNames([]);
                setSelectedSelectionStatuses([]);
              }}
              style={{ fontSize: '11px' }}
            >
              Clear Filters
            </Button>
          )}
          <Button onClick={fetchBuildersData}>Refresh</Button>
          <Button 
            onClick={exportToCSV} 
            icon={<DownloadOutlined />}
            disabled={filteredBuilders.length === 0}
          >
            Export CSV
          </Button>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {filteredBuilders.length !== sortedBuilders.length 
              ? `${filteredBuilders.length} of ${sortedBuilders.length} builders (filtered)`
              : `${filteredBuilders.length} builders`}
          </Text>
        </Space>
      </div>

      {error && (
        <Alert 
          message="Error Loading Data" 
          description={error} 
          type="error" 
          showIcon 
          style={{ marginBottom: '24px' }}
        />
      )}



      {/* Enhanced Builders Table Section */}
      <Card 
        title={
          <span style={{ color: '#ffffff' }}>
            <UserOutlined /> June L2 Builder Performance Overview
          </span>
        }
        style={{ marginBottom: '24px' }}
      >
        {buildersLoading && <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>}

        {!buildersLoading && buildersError && (
          <Alert 
            message="Error Loading Builders" 
            description={buildersError} 
            type="error" 
            showIcon 
          />
        )}

        {!buildersLoading && !buildersError && (
          <Table
            columns={buildersColumns}
            dataSource={filteredBuilders}
            rowKey="user_id"
            scroll={{ x: 'max-content' }}
            pagination={false}
            style={{ borderRadius: '8px' }}
          />
        )}
      </Card>

      {/* Builder Details Modal */}
      <BuilderDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={modalType}
        data={detailsData}
        loading={detailsLoading}
        builder={selectedBuilder}
      />

      {/* Demo Rating Modal */}
      <DemoRatingModal
        visible={demoModalVisible}
        onClose={handleDemoModalClose}
        builder={selectedBuilderForDemo}
        rating={selectedDemoRating}
        onSave={saveDemoFeedback}
        existingFeedback={selectedBuilderForDemo ? existingFeedback[selectedBuilderForDemo.user_id] : []}
      />
    </div>
  );
};

export default JuneL2SelectionsView; 