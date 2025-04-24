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
    private_key: process.env.PRIVATE_KEY.replace(/\\\\n/g, '\\n'),
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

async function processFeedbackSentiment(dateFilter = null, limit = null, specificIds = null) {
  try {
    logger.info('Starting feedback sentiment analysis');

    let targetDate = dateFilter;

    // If no specific date is provided, find the latest date in curriculum_days with feedback
    if (!targetDate && !specificIds) {
      const latestDateQuery = `
        SELECT CAST(MAX(cd.day_date) AS STRING) as latest_date
        FROM \`pursuit-ops.pilot_agent_public.peer_feedback\` pf
        JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON pf.day_number = cd.id
        WHERE cd.day_date IS NOT NULL
      `;
      logger.info('Querying for the latest date in curriculum_days with associated peer feedback');
      const [latestDateRows] = await bigquery.query({ query: latestDateQuery });
      if (latestDateRows.length > 0 && latestDateRows[0].latest_date !== null) {
        targetDate = latestDateRows[0].latest_date;
        logger.info(`Found latest date with feedback: ${targetDate}`);
      } else {
        logger.warn('Could not determine the latest date with feedback. No feedback will be processed.');
        return; // Exit if no date is found or specified
      }
    }

    // Build the main query with JOIN and DATE filter
    let query = `
      SELECT 
        pf.id, 
        pf.from_user_id, 
        pf.to_user_id, 
        pf.feedback_text, 
        cd.day_date AS curriculum_date, -- Select the date from curriculum_days
        pf.created_at AS original_created_at -- Keep original timestamp if needed for logs, but not for results table
      FROM \`pursuit-ops.pilot_agent_public.peer_feedback\` pf
      JOIN \`pursuit-ops.pilot_agent_public.curriculum_days\` cd ON pf.day_number = cd.id
      WHERE pf.feedback_text IS NOT NULL
    `;

    // Add specific IDs filter if provided (overrides date filter)
    if (specificIds) {
      query += ` AND pf.id IN (${specificIds.map(id => `'${id}'`).join(',')})`; 
    }
    // Add date filter if determined or provided
    else if (targetDate) {
      query += ` AND DATE(cd.day_date) = DATE('${targetDate}')`;
    } else if (!specificIds) {
       logger.warn('No date specified or found, and no specific IDs provided. Aborting.');
       return;
    }

    // Add limit if provided
    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    // Updated log message
    logger.info(`Querying feedback data${specificIds ? ` for IDs: ${specificIds.join(',')}` : targetDate ? ` for date: ${targetDate}` : ''}${limit ? ` (limited to ${limit} rows)` : ''}`);
    const [rows] = await bigquery.query({ query });
    logger.info(`Found ${rows.length} feedback entries to analyze`);

    if (rows.length === 0) {
        logger.info('No feedback entries found for the specified criteria. Exiting analysis.');
        // Optionally save an empty results file or skip BigQuery insert
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `feedback-results-${timestamp}-empty.json`;
        await fs.writeFile(filename, JSON.stringify([], null, 2));
        logger.info(`Empty results saved to ${filename}`);
        return; // Exit successfully if no rows found
    }

    const results = [];
    for (const row of rows) {
      logger.info(`Analyzing feedback ID: ${row.id}`);
      
      const analysis = await analyzeFeedbackWithGPT(row.feedback_text);
      
      // Use curriculum_date for the created_at field in the results
      results.push({
        id: row.id,
        from_user_id: row.from_user_id,
        to_user_id: row.to_user_id,
        feedback_text: row.feedback_text,
        sentiment_score: analysis.sentiment.score,
        sentiment_magnitude: analysis.sentiment.magnitude,
        sentiment_category: analysis.sentiment.category,
        summary: analysis.summary,
        created_at: row.curriculum_date, // Use the date from curriculum_days
        processed_at: new Date().toISOString()
        // Removed day_number
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

    // Define schema - removed day_number, ensured created_at is appropriate type (TIMESTAMP is flexible)
    const schema = [
      { name: 'id', type: 'STRING' }, // Adjust type if needed (e.g., INTEGER)
      { name: 'from_user_id', type: 'STRING' }, // Adjust type if needed (e.g., INTEGER)
      { name: 'to_user_id', type: 'STRING' }, // Adjust type if needed (e.g., INTEGER)
      { name: 'feedback_text', type: 'STRING' },
      { name: 'sentiment_score', type: 'FLOAT' },
      { name: 'sentiment_magnitude', type: 'FLOAT' },
      { name: 'sentiment_category', type: 'STRING' },
      { name: 'summary', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' }, // Represents the curriculum day date
      { name: 'processed_at', type: 'TIMESTAMP' }
      // Removed day_number field
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
    // Check if results array is empty before inserting
    if (results.length > 0) {
        const job = await table.insert(results);
        logger.info(`Results uploaded to BigQuery table: ${tableId}`);
    } else {
        logger.info('No results to upload to BigQuery.');
    }

    logger.info('Feedback sentiment analysis completed successfully');

  } catch (error) {
    // Log the specific error related to BigQuery insert if it occurs
    if (error.message.includes('You must provide at least 1 row')) {
         logger.warn('Attempted to insert 0 rows into BigQuery. This usually means no feedback was found for the criteria.');
    } else {
        logger.error('Error in feedback sentiment analysis:', error);
    }
  }
}

// If running directly (not imported as a module)
if (require.main === module) {
  // Check if a date was provided as a command line argument (YYYY-MM-DD)
  const dateArg = process.argv[2]; // Expects format like '2024-04-23'
  const limitArg = process.argv[3] ? parseInt(process.argv[3], 10) : null; // Optional limit

  // Basic validation for date format (can be improved)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (dateArg && dateRegex.test(dateArg)) {
      logger.info(`Processing feedback manually for date: ${dateArg}${limitArg ? ` with limit: ${limitArg}`: ''}`);
      processFeedbackSentiment(dateArg, limitArg);
  } else if (process.argv[2]) {
      // Provided argument is not null/undefined but doesn't match format
      logger.error('Invalid date format provided. Please use YYYY-MM-DD format.');
  } else {
      logger.info('Processing feedback manually for the latest date found with feedback.');
      // Process feedback for the latest date by default
      processFeedbackSentiment(null, limitArg);
  }
}

module.exports = { processFeedbackSentiment }; 