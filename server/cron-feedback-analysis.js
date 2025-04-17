const cron = require('node-cron');
const { processFeedbackSentiment } = require('./analyze-feedback-sentiment');
const logger = require('./logger');

// Schedule the job to run at 10 AM every day
cron.schedule('0 10 * * *', async () => {
  try {
    logger.info('Starting scheduled feedback sentiment analysis');
    
    // Get yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    logger.info(`Processing feedback for date: ${dateStr}`);
    
    // Run the analysis for yesterday's feedback
    await processFeedbackSentiment(dateStr, null, false);
    
    logger.info('Scheduled feedback sentiment analysis completed successfully');
  } catch (error) {
    logger.error('Error in scheduled feedback sentiment analysis:', error);
  }
});

logger.info('Feedback sentiment analysis cron job scheduled to run at 10 AM daily'); 