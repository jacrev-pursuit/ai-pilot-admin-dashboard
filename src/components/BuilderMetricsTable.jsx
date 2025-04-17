import { useState, useEffect } from 'react';
import { executeQuery } from '../services/bigqueryService';

const BuilderMetricsTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const getSentimentCategory = (score) => {
    if (score >= 0.6) return 'Very Positive';
    if (score >= 0.2) return 'Positive';
    if (score > -0.2) return 'Neutral';
    if (score > -0.5) return 'Negative';
    return 'Very Negative';
  };

  const getSentimentColor = (score) => {
    if (score >= 0.6) return '#4CAF50'; // Green for Very Positive
    if (score >= 0.2) return '#8BC34A'; // Light Green for Positive
    if (score > -0.2) return '#FFC107'; // Amber for Neutral
    if (score > -0.5) return '#FF5722'; // Deep Orange for Negative
    return '#F44336'; // Red for Very Negative
  };

  const toggleRow = (userId) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(userId)) {
      newExpandedRows.delete(userId);
    } else {
      newExpandedRows.add(userId);
    }
    setExpandedRows(newExpandedRows);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const query = `
        WITH user_metrics AS (
          SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            COUNT(DISTINCT CASE WHEN utp.status = 'completed' THEN utp.task_id END) as completed_tasks,
            COUNT(DISTINCT utp.task_id) as total_tasks,
            COUNT(DISTINCT cm.message_id) as total_prompts,
            AVG(sr.sentiment_score) as avg_sentiment_score
          FROM \`pilot_agent_public.users\` u
          LEFT JOIN \`pilot_agent_public.user_task_progress\` utp
            ON u.user_id = utp.user_id
          LEFT JOIN \`pilot_agent_public.conversation_messages\` cm
            ON u.user_id = cm.user_id
          LEFT JOIN \`pilot_agent_public.sentiment_results\` sr
            ON u.user_id = sr.user_id
          WHERE u.created_at BETWEEN TIMESTAMP('${dateRange.startDate}')
            AND TIMESTAMP('${dateRange.endDate}')
          GROUP BY u.user_id, u.first_name, u.last_name
        )
        SELECT 
          user_id,
          CONCAT(first_name, ' ', last_name) as builder_name,
          ROUND(completed_tasks * 100.0 / NULLIF(total_tasks, 0), 2) as completion_rate,
          total_prompts,
          ROUND(avg_sentiment_score, 2) as avg_sentiment_score
        FROM user_metrics
        ORDER BY builder_name ASC
      `;

      const result = await executeQuery(query);
      setData(result.rows || []);
    } catch (err) {
      console.error('Error fetching builder metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...data].sort((a, b) => {
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

  const filteredData = sortedData.filter(row => 
    row.builder_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading builder metrics...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div style={{ 
      padding: '20px',
      background: '#2f2f2f',
      borderRadius: '8px',
      marginTop: '20px',
      maxWidth: '1200px',
      margin: '20px auto'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>Builder Metrics</h2>
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search builders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                background: '#404040',
                color: 'white',
                border: '1px solid #505050',
                width: '100%'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '20px', flex: '2', minWidth: '400px' }}>
            <div>
              <label style={{ marginRight: '10px' }}>Start Date: </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  background: '#404040',
                  color: 'white',
                  border: '1px solid #505050'
                }}
              />
            </div>
            <div>
              <label style={{ marginRight: '10px' }}>End Date: </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  background: '#404040',
                  color: 'white',
                  border: '1px solid #505050'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        background: '#2f2f2f',
        borderRadius: '8px',
        overflow: 'hidden',
        tableLayout: 'fixed'
      }}>
        <thead>
          <tr style={{ background: '#404040' }}>
            <th onClick={() => handleSort('builder_name')} 
                style={{ 
                  cursor: 'pointer',
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #505050',
                  width: '20%'
                }}>
              Builder Name {sortConfig.key === 'builder_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('completion_rate')} 
                style={{ 
                  cursor: 'pointer',
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #505050',
                  width: '20%'
                }}>
              Task Completion Rate {sortConfig.key === 'completion_rate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('total_prompts')} 
                style={{ 
                  cursor: 'pointer',
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #505050',
                  width: '15%'
                }}>
              Total Prompts {sortConfig.key === 'total_prompts' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('avg_sentiment_score')} 
                style={{ 
                  cursor: 'pointer',
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: '2px solid #505050',
                  width: '20%'
                }}>
              Sentiment {sortConfig.key === 'avg_sentiment_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th style={{ 
              padding: '12px',
              textAlign: 'left',
              borderBottom: '2px solid #505050',
              width: '25%'
            }}>
              Peer Feedback
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row) => (
            <>
              <tr key={row.user_id} 
                  style={{ 
                    background: '#2f2f2f',
                    '&:hover': {
                      background: '#404040'
                    }
                  }}>
                <td style={{ padding: '12px', borderBottom: '1px solid #505050' }}>{row.builder_name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #505050' }}>{row.completion_rate}%</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #505050' }}>{row.total_prompts}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #505050' }}>
                  {row.avg_sentiment_score !== null ? (
                    <span 
                      title={`Score: ${row.avg_sentiment_score}`}
                      style={{
                        color: getSentimentColor(row.avg_sentiment_score),
                        fontWeight: 500,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: `${getSentimentColor(row.avg_sentiment_score)}22`
                      }}
                    >
                      {getSentimentCategory(row.avg_sentiment_score)}
                    </span>
                  ) : (
                    'N/A'
                  )}
                </td>
                <td style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #505050',
                  cursor: 'pointer'
                }} 
                onClick={() => toggleRow(row.user_id)}>
                  {row.feedback_list && row.feedback_list.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{row.feedback_list.length} Feedback Items</span>
                      <span style={{ 
                        fontSize: '18px',
                        transition: 'transform 0.2s'
                      }}>
                        {expandedRows.has(row.user_id) ? '▼' : '▶'}
                      </span>
                    </div>
                  ) : (
                    'No feedback'
                  )}
                </td>
              </tr>
              {expandedRows.has(row.user_id) && row.feedback_list && row.feedback_list.length > 0 && (
                <tr>
                  <td colSpan="5" style={{ 
                    padding: '16px', 
                    backgroundColor: '#353535',
                    borderBottom: '1px solid #505050'
                  }}>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {row.feedback_list.map((feedback, index) => (
                        <div key={index} style={{ 
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: '#2f2f2f',
                          borderRadius: '4px'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            color: '#aaa',
                            fontSize: '0.9em'
                          }}>
                            <span>From: {feedback.reviewer_name}</span>
                            <span>{formatDate(feedback.created_at)}</span>
                          </div>
                          <div style={{ 
                            padding: '8px',
                            backgroundColor: '#404040',
                            borderRadius: '4px',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {feedback.feedback_text}
                          </div>
                          <div style={{
                            marginTop: '8px',
                            color: '#aaa',
                            fontSize: '0.9em'
                          }}>
                            Type: {feedback.feedback_type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      
      {filteredData.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: '#888' 
        }}>
          No builders found matching your search.
        </div>
      )}
    </div>
  );
};

export default BuilderMetricsTable; 