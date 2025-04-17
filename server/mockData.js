// Mock data for development when BigQuery is not available

const mockBuilders = [
  {
    user_id: 1,
    name: 'John Doe',
    tasks_completed_percentage: 85.5,
    prompts_sent: 120,
    daily_sentiment: 'Positive',
    peer_feedback_sentiment: 'Very Positive',
    work_product_score: 4.2,
    comprehension_score: 3.8
  },
  {
    user_id: 2,
    name: 'Jane Smith',
    tasks_completed_percentage: 92.3,
    prompts_sent: 150,
    daily_sentiment: 'Very Positive',
    peer_feedback_sentiment: 'Positive',
    work_product_score: 4.5,
    comprehension_score: 4.1
  },
  {
    user_id: 3,
    name: 'Bob Johnson',
    tasks_completed_percentage: 78.9,
    prompts_sent: 95,
    daily_sentiment: 'Neutral',
    peer_feedback_sentiment: 'Positive',
    work_product_score: 3.8,
    comprehension_score: 3.5
  }
];

const mockBuilderDetails = {
  workProduct: [
    {
      task_id: 'TASK-001',
      task_title: 'Introduction to React',
      response_content: 'This is a sample response for the React task.',
      feedback: 'Good understanding of React concepts.',
      scores: 4.5,
      grading_timestamp: '2025-04-15T10:30:00Z'
    },
    {
      task_id: 'TASK-002',
      task_title: 'State Management',
      response_content: 'This is a sample response for the State Management task.',
      feedback: 'Excellent implementation of Redux.',
      scores: 4.8,
      grading_timestamp: '2025-04-16T14:45:00Z'
    }
  ],
  comprehension: [
    {
      task_id: 'TASK-001',
      task_title: 'React Fundamentals Quiz',
      score: 90,
      grading_timestamp: '2025-04-15T11:20:00Z'
    },
    {
      task_id: 'TASK-002',
      task_title: 'Redux Quiz',
      score: 85,
      grading_timestamp: '2025-04-16T15:10:00Z'
    }
  ],
  peerFeedback: [
    {
      id: 'FB-001',
      feedback_text: 'Great work on the React project!',
      sentiment: 'Very Positive',
      summary: 'Positive feedback about React implementation',
      created_at: '2025-04-15T12:30:00Z',
      reviewer_name: 'Alice Cooper'
    },
    {
      id: 'FB-002',
      feedback_text: 'Good understanding of Redux concepts.',
      sentiment: 'Positive',
      summary: 'Positive feedback about Redux knowledge',
      created_at: '2025-04-16T16:20:00Z',
      reviewer_name: 'Charlie Brown'
    }
  ]
};

module.exports = {
  getMockBuilders: () => mockBuilders,
  getMockBuilderDetails: (type) => mockBuilderDetails[type] || []
}; 