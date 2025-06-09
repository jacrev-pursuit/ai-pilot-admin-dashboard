console.log('Feedback sentiment analysis service starting...');

const express = require('express');
const cors = require('cors');
const { processFeedbackSentiment } = require('./analyze-feedback-sentiment');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

console.log(`Service will listen on port: ${port}`);

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'feedback-sentiment-analysis',
    port: port
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint requested');
  res.status(200).json({ 
    message: 'Feedback Sentiment Analysis Service',
    status: 'running',
    endpoints: {
      health: '/health',
      analyze: '/api/analyze-feedback'
    },
    timestamp: new Date().toISOString()
  });
});

// Feedback sentiment analysis endpoint for Cloud Scheduler
app.post('/api/analyze-feedback', async (req, res) => {
  try {
    console.log('Feedback analysis requested');
    
    // Get yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    console.log(`Processing feedback for date: ${dateStr}`);
    
    // Run the analysis for yesterday's feedback
    await processFeedbackSentiment(dateStr, null, null, false);
    
    console.log('Feedback sentiment analysis completed successfully');
    
    res.status(200).json({ 
      success: true, 
      message: 'Feedback sentiment analysis completed successfully',
      date: dateStr,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in feedback sentiment analysis:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Feedback sentiment analysis service running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Project ID: ${process.env.PROJECT_ID || 'NOT SET'}`);
  console.log(`Service ready to accept requests`);
});

module.exports = app; 