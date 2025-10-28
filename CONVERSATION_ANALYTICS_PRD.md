# Conversation Mode Analytics PRD

**Project:** Conversation Mode Performance Dashboard  
**Owner:** Jac  
**Date:** October 16, 2025  
**Status:** Implementation Phase  

## The Goal
Build a dashboard that helps the product, curriculum, and facilitation teams understand how Conversation Mode is performing so we can rapidly improve AI coach behavior and curriculum design.

## The Problem
**Current state:** We released Conversation Mode a month ago and discovered through manual analysis that 40% of students are disengaging. We're running SQL queries and reading individual conversations to understand what's working, which is slow and doesn't give us a continuous feedback loop.

**Who's affected:**
- Product team can't quickly identify if prompt changes are working
- Curriculum team doesn't know which tasks need redesigning
- Facilitators can't spot struggling students in real-time

**Why now:** We've identified critical issues (message length, multiple questions, engagement decline) and need to track improvements as we implement Phase 1-3 fixes from the Oct 10 retro.

## Success Looks Like
**Goal:** Enable daily monitoring and weekly iteration cycles to improve conversation quality

**Metrics:**
- Dashboard is checked daily by product team
- Curriculum adjustments made within 1 week of identifying task issues
- Product team can A/B test prompt changes and see results within 24 hours

## Users & Needs
**Primary users:** Product team  
- Need: Daily pulse check on key metrics
- Need: Validate that prompt changes are working
- Need: Identify which tasks/modes are breaking

**Secondary users:** Learning Experience team (Joanna, Greg, Laziah)
- Need: See which tasks have high engagement vs. dropout
- Need: Understand where students are getting stuck
- Need: Compare task performance across cohorts

**Also benefits:** Facilitators
- Need: Spot students who are struggling during class sessions

## The Solution
A web dashboard that visualizes conversation quality metrics and task performance, updated daily via batch processing of conversation data.

**Core views:**
1. **Health Overview** - Daily snapshot of the 7 key metrics
2. **Task Performance** - Which tasks are working vs. failing  
3. **AI Compliance** - How well the AI is following mode behaviors
4. **Student Journey** - Engagement patterns through conversations

**Key features:**
- Metric tracking with trend lines (30-day view)
- Task-level drill-down (see metrics per task)
- Mode comparison (coach_only vs research_partner vs technical_assistant)
- Conversation samples (click to read examples of good/bad patterns)
- Alert system (flag when metrics drop below thresholds)

## Must Haves

### Core Metrics (Updated from Analysis)
1. **AI response length** (avg characters) - Track if AI responses are too long/short
2. **Multiple questions per message rate** (%) - AI behavior compliance metric
3. **Builder response length** (avg characters) - Engagement indicator
4. **Task completion rate** (%) - Based on reaching final question in conversation
5. **Engagement decline** (%) - Pattern analysis from reading conversations
6. **Frustration signals** - Detected through conversation analysis
7. **Knowledge transfer evidence** (TBD - placeholder for future)

### Technical Requirements
- **Daily batch processing** of conversation data
- **Filter by:** date range, task, AI helper mode
- **Click through** to sample conversations
- **Export data** to CSV
- **Conversation mode only** (task_mode = 'conversation')

### Data Sources (Confirmed)
- **conversation_messages** table (message content, roles, timestamps)
- **tasks** table (task_mode, ai_helper_mode, questions array)
- **task_threads** table (links conversations to tasks)
- **task_analysis_results** table (for context, not completion tracking)

## Not Now
- Real-time updates (batch is fine)
- Individual student tracking (focus on aggregate patterns)
- Automated alerts via Slack/email (nice to have later)
- Advanced analytics (correlation analysis, predictive models)
- Cohort filtering (deprioritized)

## Implementation Architecture (Learned)

### Data Pipeline
```
conversation_messages (raw data)
    ↓
task_threads (conversation → task mapping)  
    ↓
tasks (ai_helper_mode, questions array)
    ↓
Daily Processing Script
    ↓
conversation_analytics_daily (aggregated metrics)
    ↓
API Layer
    ↓
Dashboard
```

### Task Completion Logic
- **Completion = reaching the last question** in the task's questions array
- Check conversation flow to see if user got to final question
- Different from task_analysis_results completion_score

### AI Helper Mode Detection  
- Stored in `tasks.ai_helper_mode` field
- Values: `coach_only`, `research_partner`, `technical_assistant`
- New prompt system is already implemented

### Engagement Analysis Approach
- Read actual conversations to identify patterns
- Look for declining response quality within conversations
- Identify early dropout patterns (< 3 exchanges)
- Detect frustration signals through conversation content analysis

## Success Metrics
**Goal:** Enable daily monitoring and weekly iteration cycles to improve conversation quality

**Metrics:**
- Dashboard is checked daily by product team
- Curriculum adjustments made within 1 week of identifying task issues  
- Product team can A/B test prompt changes and see results within 24 hours

## Ship By
**Phase 1 (1 week):** Core dashboard with 7 metrics, task-level filtering  
**Phase 2 (2 weeks):** Add mode comparison, conversation samples  
**Phase 3 (ongoing):** Iterate based on team feedback

## Tech Notes
- **Data source:** Existing conversation_messages table in BigQuery
- **Processing:** Daily batch job (can reuse existing analysis scripts)
- **Dashboard:** React + Recharts for visualization
- **Hosting:** Same infrastructure as main tool

## Open Questions
- **Knowledge transfer metric:** How do we measure this? (Can punt to Phase 2)
- **Alerting thresholds:** What % drop triggers concern? (Can set after baseline)
- **Historical data:** Do we backfill or start from deployment date?

## Implementation Status
- ✅ **Dashboard UI** - Mock dashboard completed with React/Ant Design
- ✅ **Data Exploration** - Analyzed conversation_messages table structure  
- 🔄 **Analytics Pipeline** - In progress: reading conversations to define metrics
- ⏳ **API Layer** - Pending: build endpoints for real data
- ⏳ **Data Processing** - Pending: daily batch processing script

## Recent Learnings (Oct 16, 2025)

### Data Structure Confirmed
- **Conversation mode tasks**: `task_mode = 'conversation'` in tasks table
- **AI helper modes**: Stored in `ai_helper_mode` field with new prompt system active
- **Task completion**: Reaching final question in conversation flow (e.g., "Question 5:")
- **One conversation thread** per user per task via task_threads table
- **Daily batch processing** sufficient for team needs

### Real Conversation Analysis (Oct 16)
From analyzing actual conversation mode data:

**Task Structure Pattern:**
- Tasks have exactly 5 questions (`total_questions: 5`)
- AI progresses through "Question 1:", "Question 2:", etc.
- Completion = AI reaching "Question 5:" in the conversation flow
- Current data shows mainly `coach_only` mode conversations

**Engagement Patterns Identified:**
1. **High Engagement** (Thread -483141, User 317):
   - 33 total messages (17 exchanges)
   - Detailed user responses (140+ characters average)
   - User provides context and reasoning
   - AI successfully guides through all 5 questions

2. **Low Engagement** (Thread -483043, User 313):  
   - 31 messages but extremely short responses
   - User responses: "yes", "no", "done", "none" (4-35 characters)
   - Clear frustration/disengagement signals
   - AI still pushes through all questions despite poor responses

3. **Very Low Engagement** (Multiple threads):
   - Many conversations with only 1 message (AI opening)
   - Immediate dropout, no user response

**Refined Metrics Based on Real Data:**
1. **Task Completion Rate**: % of conversations reaching "Question 5:"
2. **Engagement Quality**: Average user response length per conversation
3. **Early Dropout Rate**: % of conversations with ≤2 user messages  
4. **Frustration Signals**: 
   - Very short responses (≤10 characters)
   - Generic responses ("yes", "no", "done")
   - Response length declining within conversation
5. **AI Response Appropriateness**: 
   - Average AI response length (coach_only should be concise)
   - Question clarity and progression
6. **Conversation Efficiency**: Messages needed to reach completion

**Mode-Specific Insights:**
- **Coach_only mode**: Should use Socratic questioning, avoid direct answers
- Current conversations show good question progression
- Some AI responses quite long (200+ chars) - may need optimization

## Implementation Assumptions for Validation

### Task Completion Detection
**Assumption**: A conversation is "completed" when the AI reaches "Question 5:" in the message content.

**Proposed Logic**:
```sql
WITH CompletedConversations AS (
  SELECT 
    cm.thread_id,
    MAX(CASE WHEN cm.content LIKE '%Question 5:%' AND cm.sender_type = 'assistant' THEN 1 ELSE 0 END) as reached_final_question
  FROM conversation_messages cm
  JOIN task_threads tt ON cm.thread_id = tt.thread_id
  JOIN tasks t ON tt.task_id = t.id
  WHERE t.task_mode = 'conversation'
  GROUP BY cm.thread_id
)
```

### Engagement Quality Calculation
**Assumption**: Engagement quality = average user message length, excluding very short responses (≤10 chars) that indicate frustration.

**Proposed Logic**:
```sql
-- Calculate meaningful user response length (excluding frustrated responses)
AVG(CASE 
  WHEN LENGTH(content) > 10 AND sender_type = 'user' 
  THEN LENGTH(content) 
  ELSE NULL 
END) as avg_meaningful_user_length
```

### Frustration Signal Detection
**Assumption**: Multiple indicators suggest disengagement:
- Response length ≤10 characters
- Generic words: "yes", "no", "done", "none", "ok"
- Declining response length within conversation

**Proposed Logic**:
```sql
-- Frustration signals per conversation
WITH FrustrationSignals AS (
  SELECT 
    thread_id,
    COUNT(CASE WHEN LENGTH(content) <= 10 AND sender_type = 'user' THEN 1 END) as short_responses,
    COUNT(CASE WHEN LOWER(TRIM(content)) IN ('yes', 'no', 'done', 'none', 'ok') THEN 1 END) as generic_responses,
    COUNT(CASE WHEN sender_type = 'user' THEN 1 END) as total_user_messages
  FROM conversation_messages cm
  GROUP BY thread_id
)
```

### AI Compliance Metrics
**Assumption**: Good AI behavior means:
- Responses 50-150 characters for coach_only mode
- Single question per message
- Progressive question numbering

**Proposed Logic**:
```sql
-- AI response appropriateness
AVG(CASE WHEN sender_type = 'assistant' THEN LENGTH(content) END) as avg_ai_length,
COUNT(CASE WHEN content LIKE '%?%?%' AND sender_type = 'assistant' THEN 1 END) as multiple_question_messages
```

### Daily Aggregation Schema
**Proposed Table**: `conversation_analytics_daily`
```sql
CREATE TABLE conversation_analytics_daily (
  analysis_date DATE,
  task_id INT64,
  ai_helper_mode STRING,
  total_conversations INT64,
  completed_conversations INT64,
  completion_rate FLOAT64,
  avg_user_response_length FLOAT64,
  avg_ai_response_length FLOAT64,
  early_dropout_conversations INT64,
  early_dropout_rate FLOAT64,
  frustrated_conversations INT64,
  frustration_rate FLOAT64,
  multiple_question_violations INT64,
  avg_conversation_length INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
```

**Questions for Validation:**
1. Is "Question 5:" detection the right completion criteria, or should we also check if user actually responds to it?
2. Should frustration signals include response declining pattern within a conversation?
3. What AI response length range is optimal for coach_only mode?
4. Should we weight engagement quality by conversation progress (later responses matter more)?