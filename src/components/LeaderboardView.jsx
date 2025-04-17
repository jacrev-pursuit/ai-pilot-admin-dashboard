import { useState, useEffect } from 'react';
import { executeQuery } from '../services/bigquery';
import './LeaderboardView.css';

const LeaderboardView = () => {
  const [users, setUsers] = useState([]);
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('lessons_completed');
  const [searchTerm, setSearchTerm] = useState('');
  const [usersPerPage, setUsersPerPage] = useState(20);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLeaderboardData();
  }, [timeRange, sortBy, includeInactive, usersPerPage]);

  const fetchLeaderboardData = async () => {
    try {
      const daysToLookback = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : null;
      
      const query = `
        WITH message_times AS (
          SELECT 
            user_id,
            thread_id,
            created_at,
            -- Get previous message time within the same thread
            LAG(created_at) OVER (
              PARTITION BY user_id, thread_id 
              ORDER BY created_at
            ) as prev_message_time,
            -- Get first message time in thread to track session start
            FIRST_VALUE(created_at) OVER (
              PARTITION BY user_id, thread_id 
              ORDER BY created_at
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as thread_start_time
          FROM \`pilot_agent_public.conversation_messages\`
          WHERE message_role = 'user'
        ),
        time_diffs AS (
          SELECT
            user_id,
            SUM(
              CASE 
                -- Count time if less than 30 min gap and within same thread
                WHEN TIMESTAMP_DIFF(created_at, prev_message_time, MINUTE) <= 30 
                THEN TIMESTAMP_DIFF(created_at, prev_message_time, MINUTE)
                -- Add 5 minutes for first message in thread
                WHEN prev_message_time IS NULL 
                THEN 5
                ELSE 0 
              END
            ) as total_minutes
          FROM message_times
          GROUP BY user_id
        ),
        user_stats AS (
          SELECT 
            u.id as user_id,
            u.first_name,
            u.last_name,
            u.profile_image_url,
            COUNT(DISTINCT utp.task_id) as lessons_completed,
            COUNT(DISTINCT CASE WHEN utp.status = 'completed' THEN utp.task_id END) / 
              NULLIF(COUNT(DISTINCT utp.task_id), 0) * 100 as curriculum_progress,
            STRUCT(
              COALESCE(td.total_minutes / 60.0, 0) as hours,
              COALESCE(MOD(td.total_minutes, 60), 0) as minutes
            ) as time_learning,
            COUNT(DISTINCT DATE(cm.created_at)) as active_days,
            COUNT(cm.id) as total_messages,
            COUNT(DISTINCT CASE WHEN utp.status = 'submitted' THEN utp.task_id END) as submissions,
            MAX(cm.created_at) as last_active_at
          FROM \`pilot_agent_public.users\` u
          LEFT JOIN \`pilot_agent_public.user_task_progress\` utp ON u.id = utp.user_id
          LEFT JOIN \`pilot_agent_public.conversation_messages\` cm ON u.id = cm.user_id
          LEFT JOIN time_diffs td ON u.id = td.user_id
          WHERE 1=1
          ${daysToLookback ? ' AND cm.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ' + daysToLookback + ' DAY)' : ''}
          ${!includeInactive ? ' AND cm.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)' : ''}
          GROUP BY u.id, u.first_name, u.last_name, u.profile_image_url, td.total_minutes
        )
        SELECT 
          *,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_active_at, DAY) as days_since_active
        FROM user_stats
        ORDER BY ${
          sortBy === 'lessons_completed' ? 'lessons_completed DESC' :
          sortBy === 'curriculum_progress' ? 'curriculum_progress DESC' :
          sortBy === 'time_learning' ? 'time_learning.hours DESC' :
          sortBy === 'active_days' ? 'active_days DESC' :
          sortBy === 'total_messages' ? 'total_messages DESC' :
          'last_active_at DESC'
        }
      `;

      const results = await executeQuery(query);
      setUsers(results);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    }
  };

  const formatTimeSpent = (timeObj) => {
    if (!timeObj) return '0 minutes';
    const hours = timeObj.hours || 0;
    const minutes = timeObj.minutes || 0;
    if (hours === 0) return `${minutes} minutes`;
    return `${Math.floor(hours)} hours ${minutes} minutes`;
  };

  const formatDaysAgo = (days) => {
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const filteredUsers = users
    .filter(user => 
      (user.first_name + ' ' + user.last_name)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="view-controls">
          <button className="active">Leaderboard View</button>
          <button>Detailed User View</button>
          <button>Daily Activity</button>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label>Time Range</label>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="90d">Last 90 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="lessons_completed">Lessons Completed</option>
              <option value="curriculum_progress">Curriculum Progress</option>
              <option value="time_learning">Time Learning</option>
              <option value="active_days">Active Days</option>
              <option value="total_messages">Total Messages</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Search Users</label>
            <input
              type="text"
              placeholder="Enter name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={e => setIncludeInactive(e.target.checked)}
              />
              Include Inactive
            </label>
          </div>
        </div>

        <div className="pagination-controls">
          <label>Users per page: </label>
          <input
            type="number"
            min="1"
            max="100"
            value={usersPerPage}
            onChange={e => setUsersPerPage(Number(e.target.value))}
          />
          <span>
            Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </span>
        </div>
      </div>

      <div className="leaderboard-table">
        <table>
          <thead>
            <tr>
              <th>Portrait</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Lessons</th>
              <th>Curriculum Progress</th>
              <th>Time Learning</th>
              <th>Active Days</th>
              <th>Total Messages</th>
              <th>Submissions</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map(user => (
              <tr key={user.user_id}>
                <td>
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt={`${user.first_name}'s portrait`} />
                  ) : (
                    <div className="default-avatar">{user.first_name[0]}</div>
                  )}
                </td>
                <td>{user.first_name}</td>
                <td>{user.last_name}</td>
                <td>{user.lessons_completed}</td>
                <td>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${user.curriculum_progress}%` }}
                    />
                    <span>{Math.round(user.curriculum_progress)}%</span>
                  </div>
                </td>
                <td>{formatTimeSpent(user.time_learning)}</td>
                <td>{user.active_days}</td>
                <td>{user.total_messages}</td>
                <td>{user.submissions}</td>
                <td>{formatDaysAgo(user.days_since_active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(p => p - 1)}
        >
          Previous
        </button>
        <span>Page {currentPage}</span>
        <button
          disabled={currentPage * usersPerPage >= filteredUsers.length}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default LeaderboardView; 