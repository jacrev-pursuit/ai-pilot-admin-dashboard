from google.cloud import bigquery, language_v1
from datetime import datetime, UTC
import os
from google.oauth2 import service_account
import re
import requests
from urllib.parse import urlparse
import concurrent.futures
import json
import time
import logging
from openai import OpenAI
from typing import List, Dict, Any

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Debug: Print environment information
print("Initializing...")

try:
    # Use service account credentials explicitly
    credentials = service_account.Credentials.from_service_account_file(
        'service_account.json',
        scopes=['https://www.googleapis.com/auth/bigquery',
                'https://www.googleapis.com/auth/cloud-language']
    )
    
    # Initialize BigQuery and Cloud Natural Language API clients
    bq_client = bigquery.Client(project="pursuit-ops", credentials=credentials)
    language_client = language_v1.LanguageServiceClient(credentials=credentials)
    
    # Test BigQuery access with a simple query
    test_query = "SELECT 1"
    test_job = bq_client.query(test_query)
    test_job.result()
    print("Successfully authenticated with BigQuery")
except Exception as e:
    print(f"Error initializing clients: {str(e)}")
    raise

# Add OpenAI configuration after the Google Cloud credentials setup
try:
    # Initialize the OpenAI client
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    if not os.getenv('OPENAI_API_KEY'):
        raise ValueError("OPENAI_API_KEY environment variable not set")
except Exception as e:
    print(f"Error setting up OpenAI API: {str(e)}")
    raise

# Function to assess sentiment reason based on message content
def assess_sentiment_reason(text):
    reasons = []
    # Define keywords for each category
    ai_keywords = ["AI", "artificial intelligence", "machine learning", "deep learning", "neural network"]
    pd_keywords = ["career", "professional", "development", "skill", "growth", "learning", "improve"]
    
    # Split text into sentences (a simple regex-based approach)
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    
    # Extract sentences that mention AI-related keywords
    ai_sentences = [s for s in sentences if any(keyword.lower() in s.lower() for keyword in ai_keywords)]
    # Extract sentences that mention professional development keywords
    pd_sentences = [s for s in sentences if any(keyword.lower() in s.lower() for keyword in pd_keywords)]
    
    if ai_sentences:
        reasons.append("AI Literacy: " + " | ".join(ai_sentences[:2]))
    if pd_sentences:
        reasons.append("Professional Development: " + " | ".join(pd_sentences[:2]))
    
    if not reasons:
        # If no specific keywords found, try to extract the most meaningful sentence
        # (assuming longer sentences might contain more context)
        meaningful_sentences = sorted(sentences, key=len, reverse=True)[:2]
        if meaningful_sentences:
            reasons.append("General: " + " | ".join(meaningful_sentences))
        else:
            reasons.append("General: No specific context found")
    
    return " ; ".join(reasons)

# Function to interpret sentiment scores
def interpret_sentiment(score):
    # Define sentiment categories based on score ranges
    if score is None:
        return "Neutral", 0.5
    
    # Define sentiment categories
    if score > 0.5:
        sentiment = "Very Positive"
        adjusted_score = score  # Keep original score
    elif score > 0.2:
        sentiment = "Positive"
        adjusted_score = score  # Keep original score
    elif score > -0.2:
        sentiment = "Neutral"
        adjusted_score = score  # Keep original score
    elif score > -0.5:
        sentiment = "Negative"
        adjusted_score = score  # Keep original score
    else:
        sentiment = "Very Negative"
        adjusted_score = score  # Keep original score
    
    return sentiment, adjusted_score

def validate_url(url):
    """Validate if a URL is accessible."""
    try:
        # Clean up the URL
        if url.startswith('www.'):
            url = 'https://' + url
        
        # Parse URL to check if it's valid
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False, "Invalid URL format"
        
        # Special handling for Twitter/X URLs
        if 'twitter.com' in parsed.netloc or 'x.com' in parsed.netloc:
            return True, "Twitter/X URL"
        
        # Try to access the URL with a HEAD request first (lighter than GET)
        response = requests.head(url, timeout=5, allow_redirects=True)
        
        # If HEAD fails, try GET as some servers don't support HEAD
        if response.status_code >= 400:
            response = requests.get(url, timeout=5, allow_redirects=True)
        
        return response.status_code < 400, f"Status code: {response.status_code}"
    except requests.RequestException as e:
        return False, str(e)
    except Exception as e:
        return False, f"Error: {str(e)}"

def validate_links(links_str):
    """Validate a semicolon-separated string of URLs."""
    if not links_str or links_str == 'No links found':
        return []
    
    urls = [url.strip() for url in links_str.split(';') if url.strip()]
    results = []
    
    # Use ThreadPoolExecutor to validate URLs concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_url = {executor.submit(validate_url, url): url for url in urls}
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                is_valid, message = future.result()
                results.append({
                    "url": url,
                    "is_valid": is_valid,
                    "message": message
                })
            except Exception as e:
                results.append({
                    "url": url,
                    "is_valid": False,
                    "message": f"Error during validation: {str(e)}"
                })
    
    return results

def test_link_validation():
    """Test the link validation functionality with various types of URLs."""
    test_urls = [
        "https://www.google.com",  # Should work
        "https://www.github.com",   # Should work
        "http://thisisnotarealwebsite.com",  # Should fail
        "www.python.org",  # Should work after adding https://
        "not_a_url",  # Should fail
        "https://api.github.com/repos/invalid/repo",  # Should return 404
    ]
    
    test_links_str = "; ".join(test_urls)
    results = validate_links(test_links_str)
    
    valid_count = sum(1 for r in results if r["is_valid"])
    print(f"Link validation test: {valid_count}/{len(results)} valid URLs")

def clean_text(text):
    """Clean text by removing control characters and normalizing whitespace."""
    if not text:
        return ""
    # Remove control characters except newlines
    text = ''.join(char for char in text if char >= ' ' or char == '\n')
    # Normalize whitespace
    text = ' '.join(text.split())
    return text

def generate_task_evaluation_criteria(task_id: int, task_title: str, task_description: str, questions: List[str]) -> Dict[str, str]:
    """Generate consistent evaluation criteria for a task."""
    try:
        # Clean the input text
        task_title = clean_text(task_title)
        task_description = clean_text(task_description)
        questions = [clean_text(q) for q in questions if q]
        
        # Format task information
        task_info = f"""Task Title: {task_title}
Task Description: {task_description}
Questions:
{chr(10).join(f'{i+1}. {q}' for i, q in enumerate(questions))}"""

        # Call OpenAI API to generate task-level criteria
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """You are an expert at creating evaluation criteria for educational tasks.
Your response MUST be in valid JSON format with no additional text before or after. Use the following structure exactly:
{
    "task_summary": "brief summary of what the task is asking for",
    "evaluation_criteria": "detailed criteria that will be used to evaluate all responses to this task"
}"""},
                {"role": "user", "content": f"Generate a task summary and evaluation criteria for the following task:\n\n{task_info}"}
            ],
            temperature=0.7
        )
        
        response_text = completion.choices[0].message.content
        criteria = json.loads(response_text)
        
        # Convert evaluation_criteria to string if it's a dictionary
        if isinstance(criteria["evaluation_criteria"], dict):
            criteria["evaluation_criteria"] = json.dumps(criteria["evaluation_criteria"])
        
        return {
            "task_id": task_id,
            "task_title": task_title,
            "task_summary": criteria["task_summary"],
            "evaluation_criteria": criteria["evaluation_criteria"],
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating task criteria: {str(e)}")
        return {
            "task_id": task_id,
            "task_title": task_title,
            "task_summary": "Error generating task summary",
            "evaluation_criteria": "Default evaluation based on completeness and relevance",
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat()
        }

def analyze_task_responses(user_id: int, task_id: int, task_questions: Any, responses: List[str], 
                         task_summary: str, evaluation_criteria: str, task_title: str = "", task_description: str = "") -> Dict[str, Any]:
    """Analyze task responses using OpenAI API with consistent evaluation criteria."""
    try:
        logger.info(f"Starting analysis for user_id={user_id}, task_id={task_id}")
        
        # Extract questions from task_questions
        user_content = "\n\n".join(responses)
        try:
            # Handle case where task_questions is already a list
            if isinstance(task_questions, list):
                questions = task_questions
            else:
                questions = json.loads(task_questions) if task_questions else []
            if not questions:
                questions = [{'question': 'Task Response', 'response': user_content}]
            
            # Debug logging
            logger.info(f"Task questions type: {type(task_questions)}")
            logger.info(f"Questions type: {type(questions)}")
            logger.info(f"First question type: {type(questions[0]) if questions else 'None'}")
            
            # Convert string questions to dictionaries if needed
            if questions and isinstance(questions[0], str):
                questions = [{'question': q, 'response': user_content} for q in questions]
            
        except json.JSONDecodeError:
            questions = [{'question': 'Task Response', 'response': user_content}]
        
        logger.info(f"Successfully processed content with {len(questions)} questions")
        
        # Format all questions into a single task description
        task_description_text = "Task Questions:\n"
        for i, q in enumerate(questions, 1):
            task_description_text += f"{i}. {q.get('question', 'Task Response')}\n"
        
        # Truncate response if too long (approximately 4000 tokens)
        if len(user_content) > 8000:  # Rough estimate of token count
            user_content = user_content[:8000] + "... (response truncated due to length)"
        
        # Call OpenAI API with complete task context and consistent criteria
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """You are an expert at evaluating student responses to tasks about AI and professional development. 
Your response MUST be in valid JSON format with no additional text before or after. Use the following structure exactly:
{
    "score": <number between 0 and 1>,
    "feedback": "detailed explanation of strengths and weaknesses",
    "missing_aspects": "what was missing from the response"
}"""},
                {"role": "user", "content": f"""Complete Task Context:
Title: {task_title}
Description: {task_description}
{task_description_text}

Task Summary: {task_summary}

Evaluation Criteria: {evaluation_criteria}

Student Response: {user_content}

Evaluate this response according to the given criteria, considering the complete task context. Provide your evaluation in the required JSON format."""}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        # Extract evaluation from response
        response_text = completion.choices[0].message.content
        try:
            # Try to parse as JSON
            evaluation = json.loads(response_text)
            overall_score = float(evaluation.get('score', 0.0))
            overall_feedback = evaluation.get('feedback', '')
            overall_missing = evaluation.get('missing_aspects', '')
            
            logger.info(f"Successfully parsed JSON response for task {task_id}")
                
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON response for task {task_id}. Response: {response_text[:200]}...")
            overall_score = 0.0
            overall_feedback = "Error processing response"
            overall_missing = "Could not analyze missing aspects"
        
        logger.info(f"Completed analysis of task with {len(questions)} questions")
        print(f"Processed task with overall score: {overall_score:.2f}")
        
        # Format questions and responses in a readable way
        formatted_questions = "\n\n".join([
            f"Question {i+1}:\n{q.get('question', 'Task Response')}"
            for i, q in enumerate(questions)
        ])
        
        # Format feedback (now without task summary and criteria since they're stored at task level)
        formatted_feedback = (
            f"Overall Assessment:\n- Score: {overall_score}\n- Feedback: {overall_feedback}\n- Missing Aspects: {overall_missing}"
        )
        
        return {
            "user_id": user_id,
            "task_id": task_id,
            "date": datetime.now(UTC).isoformat(),
            "response_content": user_content,
            "questions": formatted_questions,
            "scores": str(overall_score),
            "feedback": formatted_feedback,
            "missing_aspects": overall_missing,
            "grading_timestamp": datetime.now(UTC).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_task_responses: {str(e)}")
        return None

def chunk_text(text, max_size=900000):
    """Split text into chunks that fit within the API size limit."""
    if len(text.encode('utf-8')) <= max_size:
        return [text]
    
    chunks = []
    current_chunk = []
    current_size = 0
    
    # Split by sentences to maintain context
    sentences = text.split('. ')
    
    for sentence in sentences:
        sentence_size = len((sentence + '. ').encode('utf-8'))
        if current_size + sentence_size > max_size:
            if current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_size = 0
        current_chunk.append(sentence)
        current_size += sentence_size
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def process_user_sentiment(user_data):
    """Process sentiment for a single user's data."""
    try:
        logger.info(f"Starting sentiment analysis for user {user_data['user_id']}")
        
        # Handle empty content by returning neutral sentiment
        if not user_data['weekly_content'] or user_data['weekly_content'].strip() == '':
            logger.info(f"No content for user {user_data['user_id']}, using neutral sentiment")
            return {
                "user_id": user_data['user_id'],
                "user_name": user_data['user_name'],
                "date": user_data['week_start'].isoformat(),
                "sentiment_score": 0.0,
                "sentiment_category": "Neutral",
                "sentiment_reason": "No content available",
                "message_count": user_data['message_count'],
                "total_tasks": 0,
                "completed_tasks": 0,
                "task_completion_percentage": 0.0,
                "link_validation_percentage": 0.0
            }
        
        # Split content into chunks if needed
        logger.info(f"Chunking content for user {user_data['user_id']}")
        content_chunks = chunk_text(user_data['weekly_content'])
        logger.info(f"Split content into {len(content_chunks)} chunks for user {user_data['user_id']}")
        
        # Process each chunk and aggregate sentiment
        total_score = 0
        total_magnitude = 0
        all_reasons = []
        processed_chunks = 0
        
        for i, chunk in enumerate(content_chunks):
            logger.info(f"Processing chunk {i+1}/{len(content_chunks)} for user {user_data['user_id']}")
            try:
                document = language_v1.Document(
                    content=chunk,
                    type_=language_v1.Document.Type.PLAIN_TEXT
                )
                # Add timeout to the API call
                sentiment_response = language_client.analyze_sentiment(
                    request={'document': document},
                    timeout=30  # 30 second timeout
                )
                sentiment = sentiment_response.document_sentiment
                total_score += sentiment.score
                total_magnitude += sentiment.magnitude
                all_reasons.append(assess_sentiment_reason(chunk))
                processed_chunks += 1
                logger.info(f"Successfully processed chunk {i+1} for user {user_data['user_id']}")
            except Exception as e:
                logger.error(f"Error processing chunk {i+1} for user {user_data['user_id']}: {str(e)}")
                continue
        
        # Calculate average sentiment
        if processed_chunks > 0:
            avg_score = total_score / processed_chunks
            # Determine sentiment category based on raw score
            if avg_score > 0.5:
                sentiment_category = "Very Positive"
            elif avg_score > 0.2:
                sentiment_category = "Positive"
            elif avg_score > -0.2:
                sentiment_category = "Neutral"
            elif avg_score > -0.5:
                sentiment_category = "Negative"
            else:
                sentiment_category = "Very Negative"
        else:
            logger.warning(f"No valid chunks processed for user {user_data['user_id']}, using neutral sentiment")
            sentiment_category = "Neutral"
            avg_score = 0.0
        
        logger.info(f"Completed sentiment analysis for user {user_data['user_id']}")
        
        return {
            "user_id": user_data['user_id'],
            "user_name": user_data['user_name'],
            "date": user_data['week_start'].isoformat(),
            "sentiment_score": float(avg_score),
            "sentiment_category": sentiment_category,
            "sentiment_reason": " | ".join(all_reasons) if all_reasons else "No specific context found",
            "message_count": user_data['message_count'],
            "total_tasks": 0,  # Will be updated later
            "completed_tasks": 0,  # Will be updated later
            "task_completion_percentage": 0.0,  # Will be updated later
            "link_validation_percentage": 0.0  # Will be updated later
        }
    except Exception as e:
        logger.error(f"Error processing sentiment for user {user_data['user_id']}: {str(e)}")
        return None

def process_task_response(task_data):
    """Process a single task response."""
    try:
        if task_data['questions'] and task_data['user_content']:
            # Get or generate task-level criteria
            if task_data['task_id'] not in task_criteria_cache:
                questions = json.loads(task_data['questions']) if isinstance(task_data['questions'], str) else task_data['questions']
                task_criteria = generate_task_evaluation_criteria(
                    task_data['task_id'],
                    task_data['task_title'],
                    task_data['task_description'],
                    questions
                )
                task_criteria_cache[task_data['task_id']] = task_criteria
            
            # Use cached criteria for evaluation
            task_criteria = task_criteria_cache[task_data['task_id']]
            response = analyze_task_responses(
                task_data['user_id'],
                task_data['task_id'],
                task_data['questions'],
                [task_data['user_content']],
                task_criteria["task_summary"],
                task_criteria["evaluation_criteria"],
                task_data['task_title'],
                task_data['task_description']
            )
            
            if response:
                response['date'] = task_data['week_start'].isoformat()
                return response
    except Exception as e:
        logger.error(f"Error processing task response: {str(e)}")
    return None

# Run the test before processing actual data
if __name__ == "__main__":
    print("\nStarting task evaluation and response analysis...")
    
    # Skip sentiment analysis parts
    print("Skipping sentiment analysis as requested...")
    
    # First, check the table structure
    print("\nChecking table structure...")
    table_check_query = """
    SELECT column_name, data_type
    FROM `pursuit-ops.pilot_agent_public.INFORMATION_SCHEMA.COLUMNS`
    WHERE table_name = 'tasks'
    ORDER BY ordinal_position
    """
    
    try:
        table_info = list(bq_client.query(table_check_query).result())
        print("\nTable structure:")
        for col in table_info:
            print(f"{col.column_name}: {col.data_type}")
    except Exception as e:
        print(f"Error checking table structure: {e}")
        print("Proceeding with default column names...")
    
    # Get task data
    print("\nFetching task data...")
    task_progress_query = """
    WITH date_ranges AS (
        SELECT 
            cd.day_date,
            DATE(DATE_ADD('2025-03-15', 
                INTERVAL (DIV(DATE_DIFF(cd.day_date, DATE '2025-03-15', DAY), 7)) WEEK
            )) as week_start
        FROM `pursuit-ops.pilot_agent_public.curriculum_days` cd
        WHERE cd.day_date >= '2025-03-15'
    ),
    weekly_tasks AS (
        SELECT 
            dr.week_start,
            COUNT(DISTINCT t.id) as total_tasks
        FROM `pursuit-ops.pilot_agent_public.tasks` t
        JOIN `pursuit-ops.pilot_agent_public.time_blocks` tb ON t.block_id = tb.id
        JOIN `pursuit-ops.pilot_agent_public.curriculum_days` cd ON tb.day_id = cd.id
        JOIN date_ranges dr ON cd.day_date = dr.day_date
        WHERE t.deliverable_type = 'text'
        GROUP BY dr.week_start
    ),
    task_questions AS (
        SELECT 
            id,
            TO_JSON_STRING(questions) as questions_str
        FROM `pursuit-ops.pilot_agent_public.tasks`
    ),
    ordered_messages AS (
        SELECT 
            tt.task_id,
            cm.user_id,
            cm.content,
            ROW_NUMBER() OVER (
                PARTITION BY tt.task_id, cm.user_id, cm.content 
                ORDER BY cm.created_at
            ) as msg_rank
        FROM `pursuit-ops.pilot_agent_public.task_threads` tt
        JOIN `pursuit-ops.pilot_agent_public.conversation_messages` cm 
            ON tt.thread_id = cm.thread_id 
        WHERE cm.message_role = 'user'
        AND cm.content IS NOT NULL
    ),
    deduplicated_messages AS (
        SELECT 
            task_id,
            user_id,
            content
        FROM ordered_messages
        WHERE msg_rank = 1
    ),
    selected_users AS (
        SELECT DISTINCT user_id 
        FROM `pursuit-ops.pilot_agent_public.user_task_progress`
    ),
    all_tasks AS (
        SELECT DISTINCT 
            t.id as task_id,
            t.task_title,
            t.task_description,
            t.deliverable_type,
            tq.questions_str as task_questions
        FROM `pursuit-ops.pilot_agent_public.tasks` t
        LEFT JOIN task_questions tq ON t.id = tq.id
        WHERE t.deliverable_type = 'text'
        AND t.task_title != 'Daily Standup'
    ),
    user_task_combinations AS (
        SELECT 
            u.user_id,
            t.task_id,
            t.task_title,
            t.task_description,
            t.task_questions,
            t.deliverable_type,
            dr.week_start
        FROM selected_users u
        CROSS JOIN all_tasks t
        CROSS JOIN (SELECT DISTINCT week_start FROM weekly_tasks) dr
    ),
    user_tasks AS (
        SELECT 
            utc.user_id,
            utc.week_start,
            wt.total_tasks,
            COUNT(DISTINCT CASE 
                WHEN utp.status = 'completed' 
                AND DATE(utp.updated_at) BETWEEN utc.week_start AND DATE_ADD(utc.week_start, INTERVAL 6 DAY)
                THEN utc.task_id 
            END) as completed_tasks,
            utc.task_id,
            utc.task_title,
            utc.task_description,
            utc.task_questions,
            utc.deliverable_type,
            COALESCE(STRING_AGG(dm.content, '\\n\\n'), '') as user_content
        FROM user_task_combinations utc
        JOIN weekly_tasks wt ON utc.week_start = wt.week_start
        LEFT JOIN `pursuit-ops.pilot_agent_public.user_task_progress` utp 
            ON utc.user_id = utp.user_id
            AND utc.task_id = utp.task_id
        LEFT JOIN deduplicated_messages dm
            ON utc.task_id = dm.task_id
            AND utc.user_id = dm.user_id
        GROUP BY 
            utc.user_id, 
            utc.week_start, 
            wt.total_tasks,
            utc.task_id,
            utc.task_title,
            utc.task_description,
            utc.task_questions,
            utc.deliverable_type
    )
    SELECT 
        user_id,
        week_start,
        total_tasks,
        completed_tasks,
        task_id,
        task_title,
        task_description,
        task_questions,
        deliverable_type,
        user_content
    FROM user_tasks
    ORDER BY user_id, week_start, task_id"""
    
    print("\nAnalyzing task completion...")
    tasks_job = bq_client.query(task_progress_query)
    tasks_rows = list(tasks_job.result())
    print(f"Found {len(tasks_rows)} task records")
    
    # Process task responses with deduplication
    print("\nProcessing task responses...")
    task_responses_data = []
    task_criteria_cache = {}  # Cache for task-level criteria

    # Process task responses in parallel
    print("\nProcessing task responses in parallel...")
    task_responses_data = []
    task_criteria_data = []  # Store task criteria data
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # First, generate task criteria for all unique tasks
        unique_tasks = {}
        for row in tasks_rows:
            if (hasattr(row, 'task_id') and row.task_id and 
                row.task_id not in unique_tasks and 
                row.task_questions and 
                row.deliverable_type == 'text'):
                unique_tasks[row.task_id] = {
                    'task_id': row.task_id,
                    'task_title': row.task_title,
                    'task_description': row.task_description,
                    'questions': row.task_questions
                }
        
        # Generate criteria for each unique task
        print(f"\nGenerating criteria for {len(unique_tasks)} unique tasks...")
        criteria_futures = {
            executor.submit(
                generate_task_evaluation_criteria,
                task['task_id'],
                task['task_title'],
                task['task_description'],
                json.loads(task['questions']) if isinstance(task['questions'], str) else task['questions']
            ): task['task_id']
            for task in unique_tasks.values()
        }
        
        # Collect task criteria results
        for future in concurrent.futures.as_completed(criteria_futures):
            task_id = criteria_futures[future]
            try:
                criteria = future.result()
                if criteria:
                    task_criteria_data.append(criteria)
                    print(f"Generated criteria for task {task_id}")
            except Exception as e:
                logger.error(f"Error generating criteria for task {task_id}: {str(e)}")
        
        # Now process task responses using the generated criteria
        task_data_list = [{
            'user_id': row.user_id,
            'task_id': row.task_id,
            'week_start': row.week_start,
            'questions': row.task_questions,
            'user_content': row.user_content,
            'task_title': row.task_title,
            'task_description': row.task_description
        } for row in tasks_rows if hasattr(row, 'task_questions') and row.task_questions and row.deliverable_type == 'text']
        
        # Submit all tasks for parallel processing
        future_to_task = {executor.submit(process_task_response, task_data): task_data 
                         for task_data in task_data_list}
        
        # Collect results as they complete
        for future in concurrent.futures.as_completed(future_to_task):
            result = future.result()
            if result:
                task_responses_data.append(result)

    print(f"Processed {len(task_responses_data)} task responses in parallel")
    print(f"Generated criteria for {len(task_criteria_data)} tasks")

    # Create and populate the task_evaluation_criteria table
    print("\nCreating task evaluation criteria table...")
    try:
        task_criteria_table_id = "pursuit-ops.pilot_agent_public.task_evaluation_criteria"
        
        # Define schema for the task criteria table
        task_criteria_schema = [
            bigquery.SchemaField("task_id", "INTEGER"),
            bigquery.SchemaField("task_title", "STRING"),
            bigquery.SchemaField("task_summary", "STRING"),
            bigquery.SchemaField("evaluation_criteria", "STRING"),
            bigquery.SchemaField("created_at", "TIMESTAMP"),
            bigquery.SchemaField("updated_at", "TIMESTAMP")
        ]
        
        # Delete the existing table if it exists
        try:
            bq_client.delete_table(task_criteria_table_id, not_found_ok=True)
            print("Existing task criteria table deleted")
        except Exception as e:
            print(f"Error deleting existing table: {e}")
        
        # Create the new table
        task_criteria_table = bigquery.Table(task_criteria_table_id, schema=task_criteria_schema)
        task_criteria_table = bq_client.create_table(task_criteria_table, exists_ok=True)
        print("Task evaluation criteria table created successfully")
        
        # Insert data into the task criteria table
        if task_criteria_data:
            job_config = bigquery.LoadJobConfig(
                schema=task_criteria_schema,
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND
            )
            job = bq_client.load_table_from_json(
                task_criteria_data,
                task_criteria_table_id,
                job_config=job_config
            )
            job.result()
            
            if job.errors:
                print(f"Errors loading task criteria data: {job.errors}")
                raise Exception("Failed to load task criteria data")
            print(f"Successfully processed {len(task_criteria_data)} task criteria records")
        else:
            print("No task criteria data to process")
            
    except Exception as e:
        print(f"Error processing task criteria data: {e}")
        raise

    # Create and populate the task_responses table
    print("\nCreating task responses table...")
    try:
        task_responses_table_id = "pursuit-ops.pilot_agent_public.task_responses"
        
        # Define schema for the task responses table
        task_responses_schema = [
            bigquery.SchemaField("user_id", "INTEGER"),
            bigquery.SchemaField("task_id", "INTEGER"),
            bigquery.SchemaField("date", "DATE"),
            bigquery.SchemaField("response_content", "STRING"),
            bigquery.SchemaField("questions", "STRING"),
            bigquery.SchemaField("scores", "STRING"),
            bigquery.SchemaField("feedback", "STRING"),
            bigquery.SchemaField("missing_aspects", "STRING"),
            bigquery.SchemaField("grading_timestamp", "TIMESTAMP")
        ]
        
        # Delete the existing table if it exists
        try:
            bq_client.delete_table(task_responses_table_id, not_found_ok=True)
            print("Existing task responses table deleted")
        except Exception as e:
            print(f"Error deleting existing table: {e}")
        
        # Create the new table
        task_responses_table = bigquery.Table(task_responses_table_id, schema=task_responses_schema)
        task_responses_table = bq_client.create_table(task_responses_table, exists_ok=True)
        print("Task responses table created successfully")
        
        # Insert data into the task responses table
        if task_responses_data:
            job_config = bigquery.LoadJobConfig(
                schema=task_responses_schema,
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND
            )
            job = bq_client.load_table_from_json(
                task_responses_data,
                task_responses_table_id,
                job_config=job_config
            )
            job.result()
            
            if job.errors:
                print(f"Errors loading task responses data: {job.errors}")
                raise Exception("Failed to load task responses data")
            print(f"Successfully processed {len(task_responses_data)} task response records")
        else:
            print("No task response data to process")
            
    except Exception as e:
        print(f"Error processing task responses data: {e}")
        raise

    print("\nTask evaluation and response analysis completed")
