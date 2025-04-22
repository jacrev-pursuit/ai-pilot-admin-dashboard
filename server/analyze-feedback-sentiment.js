require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const OpenAI = require('openai');
const fs = require('fs').promises;
const logger = require('./logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.PROJECT_ID,
  credentials: {
    client_email: process.env.CLIENT_EMAIL,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    private_key_id: process.env.PRIVATE_KEY_ID,
  }
});

async function analyzeFeedbackWithGPT(text) {
  if (!text || text.trim() === '') {
    return {
      sentiment: { score: 0, magnitude: 0, category: 'Neutral' },
      summary: 'No feedback provided'
    };
  }

  try {
    const prompt = `Analyze the following feedback and provide:
1. Sentiment analysis (score from -1 to 1, magnitude from 0 to 1, and category: Very Negative, Negative, Neutral, Positive, or Very Positive)
2. A structured summary with the following sections (only include sections that have relevant content):
   - Strengths: Describe key strengths and their impact, using "the recipient" or "their" instead of pronouns
   - Opportunities: If there's criticism, describe areas for improvement constructively
   - Additional Comments: Capture personal messages or notable context

Keep summaries concise and impactful. Focus on outcomes and impact rather than just listing traits. Avoid phrases like "The feedback praised..." or "They were...". Be direct but warm in tone.

Example:
Bad: "The feedback praised their communication skills and they were good at teamwork"
Good: "Strong communication skills that enhanced team collaboration"

Feedback: "${text}"

Respond in JSON format:
{
  "sentiment": {
    "score": number,
    "magnitude": number,
    "category": string
  },
  "summary": {
    "strengths": string[],
    "opportunities": string[],
    "additionalComments": string[]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Format the summary as a string with sections
    let formattedSummary = '';
    
    if (result.summary.strengths && result.summary.strengths.length > 0) {
      formattedSummary += 'Strengths: ';
      formattedSummary += result.summary.strengths.join('. ') + '.';
      formattedSummary += '\n\n';
    }
    
    if (result.summary.opportunities && result.summary.opportunities.length > 0) {
      formattedSummary += 'Opportunities: ';
      formattedSummary += result.summary.opportunities.join('. ') + '.';
      formattedSummary += '\n\n';
    }
    
    if (result.summary.additionalComments && result.summary.additionalComments.length > 0) {
      formattedSummary += 'Additional Comments: ';
      formattedSummary += result.summary.additionalComments.join('. ') + '.';
    }
    
    // Trim any extra whitespace
    formattedSummary = formattedSummary.trim();
    
    return {
      sentiment: result.sentiment,
      summary: formattedSummary
    };
  } catch (error) {
    logger.error('Error analyzing feedback:', error);
    return {
      sentiment: { score: 0, magnitude: 0, category: 'Neutral' },
      summary: 'Error analyzing feedback'
    };
  }
}

async function processFeedbackSentiment(dateFilter = null, limit = null, isFullAnalysis = false, specificIds = null) {
  try {
    logger.info('Starting feedback sentiment analysis');
    
    // Build the query with optional date filter and limit
    let query = `
      SELECT id, from_user_id, to_user_id, feedback_text, created_at
      FROM \`pursuit-ops.pilot_agent_public.peer_feedback\`
      WHERE feedback_text IS NOT NULL
    `;
    
    // Add specific IDs filter if provided
    if (specificIds) {
      query += ` AND id IN (${specificIds.join(',')})`;
    }
    // Add date filter if provided and not doing full analysis
    else if (dateFilter && !isFullAnalysis) {
      query += ` AND DATE(created_at) = DATE('${dateFilter}')`;
    } else if (isFullAnalysis) {
      // For full analysis, exclude dates that are already processed (April 15th and after)
      query += ` AND DATE(created_at) < DATE('2025-04-15')`;
    } else {
      // Default case: Process feedback from April 16th, 2024 onwards
      query += ` AND DATE(created_at) >= DATE('2024-04-17')`;
    }

    // Add limit if provided
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    logger.info(`Querying feedback data${specificIds ? ` for IDs: ${specificIds.join(',')}` : dateFilter && !isFullAnalysis ? ` for date: ${dateFilter}` : isFullAnalysis ? ' before April 15th' : ''}${limit ? ` (limited to ${limit} rows)` : ''}`);
    const [rows] = await bigquery.query({ query });
    logger.info(`Found ${rows.length} feedback entries to analyze`);

    const results = [];
    for (const row of rows) {
      logger.info(`Analyzing feedback ID: ${row.id}`);
      
      const analysis = await analyzeFeedbackWithGPT(row.feedback_text);
      
      results.push({
        id: row.id,
        from_user_id: row.from_user_id,
        to_user_id: row.to_user_id,
        feedback_text: row.feedback_text,
        sentiment_score: analysis.sentiment.score,
        sentiment_magnitude: analysis.sentiment.magnitude,
        sentiment_category: analysis.sentiment.category,
        summary: analysis.summary,
        created_at: row.created_at,
        processed_at: new Date().toISOString()
      });

      logger.info('Analysis complete', {
        id: row.id,
        sentiment: analysis.sentiment,
        summaryLength: analysis.summary.length
      });
    }

    // Save results to a JSON file for backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `feedback-results-${timestamp}.json`;
    await fs.writeFile(
      filename,
      JSON.stringify(results, null, 2)
    );
    logger.info(`Results saved to ${filename}`);

    // Create or update BigQuery table with the results
    const dataset = bigquery.dataset('pilot_agent_public');
    const tableId = 'feedback_sentiment_analysis';

    // Define schema
    const schema = [
      { name: 'id', type: 'STRING' },
      { name: 'from_user_id', type: 'STRING' },
      { name: 'to_user_id', type: 'STRING' },
      { name: 'feedback_text', type: 'STRING' },
      { name: 'sentiment_score', type: 'FLOAT' },
      { name: 'sentiment_magnitude', type: 'FLOAT' },
      { name: 'sentiment_category', type: 'STRING' },
      { name: 'summary', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'processed_at', type: 'TIMESTAMP' }
    ];

    // Create table if it doesn't exist
    try {
      await dataset.table(tableId).get();
      logger.info(`Table ${tableId} already exists, will be updated`);
    } catch (error) {
      logger.info(`Creating new table ${tableId}`);
      await dataset.createTable(tableId, { schema });
    }
    
    // Load data into table
    const table = dataset.table(tableId);
    const job = await table.insert(results);

    logger.info(`Results uploaded to BigQuery table: ${tableId}`);
    logger.info('Feedback sentiment analysis completed successfully');

  } catch (error) {
    logger.error('Error in feedback sentiment analysis:', error);
  }
}

// If running directly (not imported as a module)
if (require.main === module) {
  // Check if a date was provided as a command line argument
  const dateArg = process.argv[2];
  
  if (dateArg) {
    // Process feedback for the specified date
    processFeedbackSentiment(dateArg);
  } else {
    // Process all feedback
    processFeedbackSentiment();
  }
}

module.exports = { processFeedbackSentiment }; 