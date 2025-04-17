# Server

This is the server component of the AI Pilot Admin Dashboard.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   # Server Configuration
   PORT=3001

   # BigQuery Configuration
   GOOGLE_CLOUD_PROJECT_ID=pursuit-ops
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/credentials.json

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   ```

3. Make sure you have the `service_account.json` file in the server directory.

## Running the Server

Development mode with auto-reload:
```
npm run dev
```

Production mode:
```
npm start
```

## Feedback Sentiment Analysis

### Manual Analysis

To run a full analysis of all feedback:
```
npm run analyze-feedback
```

To analyze feedback for a specific date:
```
npm run analyze-feedback-date YYYY-MM-DD
```

### Test Analysis

To run a test analysis on 5 feedback entries:
```
npm run test-feedback
```

The test script will:
- Process 5 feedback entries
- Analyze sentiment using Google Cloud Natural Language API
- Summarize feedback using OpenAI
- Save results to `test-feedback-results.json`
- Create a temporary BigQuery table `feedback_sentiment_analysis_test`

### Automated Daily Analysis

The server includes a cron job that automatically runs the feedback analysis every day at 10 AM for the previous day's feedback.

To start the cron job:
```
npm run start-cron
```

The cron job will:
- Run automatically at 10 AM daily
- Process all feedback from the previous day
- Log the results to the configured Winston logger
- Store results in the BigQuery table

## Output Table Schema

The analysis results are stored in BigQuery with the following schema:

- `id`: Unique identifier for the feedback
- `from_user_id`: ID of the user who gave the feedback
- `to_user_id`: ID of the user who received the feedback
- `sentiment_score`: Sentiment score from -1.0 to 1.0
- `sentiment_magnitude`: Strength of the sentiment
- `sentiment_category`: Categorized sentiment (positive, negative, neutral)
- `summary`: AI-generated summary of the feedback
- `processed_at`: Timestamp of when the analysis was performed 