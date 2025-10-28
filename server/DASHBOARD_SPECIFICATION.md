# Conversation Mode Efficacy Dashboard - Specification Guide
**Created:** October 21, 2025  
**For:** Dashboard development team  
**Data Source:** BigQuery `pursuit-ops.pilot_agent_public`

---

## 📊 Executive Summary

This dashboard tracks the efficacy of "conversation mode" AI tutoring conversations. The goal is to monitor:
1. **AI Behavior Compliance** - Is the AI following the guidelines (short messages, single questions)?
2. **Student Engagement** - Are students actively participating with quality responses?
3. **Learning Outcomes** - Are conversations completing successfully? Are students reflecting?
4. **Content Authenticity** - Are students thinking for themselves or copying AI-generated text?

**Update Frequency:** Daily (automated at 2 AM EST)  
**Baseline Period:** October 13-20, 2025 (396 conversations)

---

## 🗄️ Data Tables

### Table 1: `conversation_efficacy_daily_metrics`
**Purpose:** Individual conversation-level metrics (one row per conversation)  
**Partitioned by:** `date`  
**Clustered by:** `ai_helper_mode`, `task_id`

#### Schema:

| Field | Type | Description | Typical Range | Dashboard Use |
|-------|------|-------------|---------------|---------------|
| **date** | DATE | Date of conversation | 2025-10-13 onwards | Time filtering |
| **thread_id** | INT64 | Unique conversation ID | - | Drill-down to individual convos |
| **task_id** | INT64 | Task identifier | 1187-1301 | Task comparison |
| **user_id** | INT64 | Student identifier | - | Student progression tracking |
| **ai_helper_mode** | STRING | Mode type | "conversation", "conversation_with_guide", etc. | Mode comparison |
| | | | | |
| **🤖 AI BEHAVIOR METRICS** | | | | |
| **message_length_compliance_pct** | FLOAT64 | % of AI messages under 150 words | 0-100% | Compliance gauge |
| **single_question_rate_pct** | FLOAT64 | % of AI messages with exactly 1 question | 0-100% | Compliance gauge |
| **avg_ai_message_words** | FLOAT64 | Average words per AI message | 10-150 words | Distribution chart |
| **avg_questions_per_message** | FLOAT64 | Average questions per AI message | 0-3 | Histogram |
| | | | | |
| **👥 ENGAGEMENT METRICS** | | | | |
| **engagement_decline_flag** | BOOL | TRUE if student quality dropped | TRUE/FALSE | Alert indicator |
| **student_avg_word_count** | FLOAT64 | Average words per student response | 5-150 words | Distribution chart |
| **student_response_quality_score** | FLOAT64 | Overall quality (0-10 scale) | 0-10 | Primary KPI |
| | | | | |
| **✅ COMPLETION METRICS** | | | | |
| **conversation_completed** | BOOL | TRUE if reached final question | TRUE/FALSE | Completion rate |
| **completion_pct** | FLOAT64 | % of questions reached | 0.0-1.0 | Progress bar |
| **questions_asked_in_order** | BOOL | TRUE if AI asked questions sequentially | TRUE/FALSE | Compliance check |
| **questions_coverage_pct** | FLOAT64 | % of questions from array that were asked | 0-100% | Coverage gauge |
| | | | | |
| **🧠 LEARNING METRICS** | | | | |
| **adaptation_rate_pct** | FLOAT64 | % of times AI adapted to student signals | 0-100% | AI responsiveness |
| **reflection_detected** | BOOL | TRUE if reflection indicators found | TRUE/FALSE | Learning indicator |
| **reflection_count** | INT64 | Number of reflection indicators | 0-10+ | Depth of reflection |
| **likely_ai_generated_pct** | FLOAT64 | % of student messages flagged as AI | 0-100% | 🚨 Authenticity alert |
| **human_authenticity_score** | FLOAT64 | 0-10 scale (10 = definitely human) | 0-10 | Primary authenticity KPI |
| | | | | |
| **📈 CONVERSATION STATS** | | | | |
| **total_ai_messages** | INT64 | Count of AI messages | 1-20 | Conversation length |
| **total_student_messages** | INT64 | Count of student messages | 1-20 | Conversation length |
| **conversation_duration_minutes** | FLOAT64 | Time from first to last message | 1-120 min | Engagement duration |

---

### Table 2: `conversation_efficacy_aggregated_daily`
**Purpose:** Daily aggregates by task and mode (one row per date/task/mode combination)  
**Partitioned by:** `analysis_date`  
**Clustered by:** `ai_helper_mode`, `task_id`

#### Schema:

| Field | Type | Description | Dashboard Use |
|-------|------|-------------|---------------|
| **analysis_date** | DATE | Date of analysis | Time series axis |
| **ai_helper_mode** | STRING | Mode type | Mode filter/comparison |
| **task_id** | INT64 | Task identifier | Task filter |
| **task_title** | STRING | Human-readable task name | Display labels |
| **total_conversations** | INT64 | Number of conversations | Volume indicator |
| | | | |
| **AGGREGATED METRICS (All averages)** | | | |
| **avg_message_compliance_pct** | FLOAT64 | Average % of compliant messages | KPI trend line |
| **avg_single_question_rate** | FLOAT64 | Average % single questions | KPI trend line |
| **avg_ai_words** | FLOAT64 | Average AI message length | Verbosity trend |
| **avg_engagement_decline_rate** | FLOAT64 | % of convos with engagement decline | 🚨 Alert metric |
| **avg_completion_rate** | FLOAT64 | % of conversations completed | Primary success KPI |
| **avg_student_quality_score** | FLOAT64 | Average student quality (0-10) | Primary learning KPI |
| **avg_adaptation_rate** | FLOAT64 | Average AI adaptation % | AI effectiveness |
| **avg_reflection_rate** | FLOAT64 | % of convos with reflection | Learning depth |
| **avg_questions_in_order_rate** | FLOAT64 | % of convos with proper question order | Compliance check |
| **avg_questions_coverage_pct** | FLOAT64 | Average % of questions asked | Coverage metric |
| **avg_ai_generated_pct** | FLOAT64 | Average % likely AI responses | 🚨 Authenticity alert |
| **avg_human_authenticity_score** | FLOAT64 | Average authenticity (0-10) | Primary authenticity KPI |
| | | | |
| **improvement_vs_baseline** | FLOAT64 | % improvement vs Oct 13-20 | Change indicator |
| **alert_flag** | BOOL | TRUE if any metric breaches threshold | 🚨 Alert trigger |

---

### Table 3: `conversation_efficacy_alerts`
**Purpose:** Alert log when metrics breach thresholds  
**Use:** Alert dashboard, notification system

#### Schema:

| Field | Type | Description |
|-------|------|-------------|
| **alert_date** | DATE | When alert triggered |
| **ai_helper_mode** | STRING | Mode affected |
| **task_id** | INT64 | Task affected |
| **metric_name** | STRING | Which metric breached |
| **metric_value** | FLOAT64 | Current value |
| **threshold** | FLOAT64 | Threshold breached |
| **severity** | STRING | "warning", "critical" |
| **alert_message** | STRING | Human-readable message |

---

### Table 4: `conversation_efficacy_examples`
**Purpose:** Best and worst conversation examples for manual review  
**Use:** Quality review dashboard

#### Schema:

| Field | Type | Description |
|-------|------|-------------|
| **date** | DATE | When stored |
| **example_type** | STRING | "best", "worst", "ai_generated" |
| **thread_id** | INT64 | Conversation ID |
| **task_id** | INT64 | Task ID |
| **user_id** | INT64 | Student ID |
| **quality_score** | FLOAT64 | Overall quality score |
| **conversation_snippet** | STRING | Formatted text of conversation |
| **flagged_reason** | STRING | Why this was flagged |

---

## 🎯 Key Metrics Definitions

### 1. **Student Response Quality Score (0-10)**
**Most Important Learning Outcome Metric**

**Components:**
- **Length appropriateness** (0-3 pts): 
  - 4-15 words: 2.0 pts (can be great if specific)
  - 16-50 words: 3.0 pts (sweet spot)
  - 51-80 words: 2.5 pts (detailed)
  - 81-100 words: 1.5 pts (getting suspicious)
  - 100+ words: 1.0 pts (likely AI)
  - 150+ words: 0.5 pts (almost certainly AI)
  
- **Technical vocabulary** (0-2 pts): Uses terms like "API", "XCUITest", "database", "authentication"
- **Specificity** (0-2 pts): Concrete examples ("removeTodo bug", "my project", "Cypress")
- **Critical thinking** (0-2 pts): "because", "however", "compared to", reasoning
- **Curiosity** (0-1 pt): Questions, uncertainty, exploration

**Good Score:** 6-8/10 (thoughtful, specific)  
**Concerning Score:** <4/10 (generic, disengaged, or AI-generated)

**Dashboard:** 
- Time series trend (daily average)
- Distribution histogram
- By task comparison
- By student (progression tracking)

---

### 2. **Human Authenticity Score (0-10)**
**New Critical Metric - Are Students Thinking for Themselves?**

**What it measures:** Likelihood that student wrote responses themselves vs. copying AI text

**Scoring:**
- **10/10:** Definitely human (casual language, first person, typos, personal experience)
- **7-9/10:** Likely human (mostly natural, some formal language)
- **5-6/10:** Unclear (could go either way)
- **3-4/10:** Likely AI (formal, structured, lacks personal voice)
- **0-2/10:** Almost certainly AI (third-person self-reference, zero first-person, 150+ words)

**AI Indicators (each adds "AI signals"):**
- ❌ Third-person self-reference: "**your** project", "**you** discovered" (+4 signals)
- ❌ No first-person pronouns in 50+ word response (+2 signals)
- ❌ Overly formal starters: "furthermore", "moreover", "in conclusion" (+2 signals)
- ❌ Perfect structure, buzzword-heavy, consultant tone (+1 signal each)
- ❌ 150+ words of perfect prose (+strong AI flag)

**Human Indicators (each adds "human signals"):**
- ✅ Personal experience: "when I tried", "my project", "I noticed" (+3 signals)
- ✅ Casual language: "kinda", "gonna", "yeah", "idk", "tbh" (+2 signals)
- ✅ Conversational: "I mean", "you know", "basically" (+1 signal)

**Dashboard:**
- 🚨 Alert if average drops below 6.0
- Time series trend
- % of conversations with score <5.0 (likely AI)
- Individual student scores (identify who needs intervention)

---

### 3. **Message Length Compliance (0-100%)**
**AI Behavior - Is AI Following Guidelines?**

**What it measures:** % of AI messages that are under 150 words

**Target:** >80% compliance  
**Concerning:** <60% compliance (AI is too verbose)

**Why it matters:** 
- Long AI messages overwhelm students
- Short, focused messages = better engagement
- Correlates with student response quality

**Dashboard:**
- Gauge (current compliance %)
- Trend over time
- Distribution of AI message lengths (histogram)

---

### 4. **Single Question Rate (0-100%)**
**AI Behavior - Is AI Asking One Question at a Time?**

**What it measures:** % of AI messages with exactly 1 question

**Target:** >70% single question rate  
**Concerning:** <50% (AI asking multiple questions, confusing students)

**Dashboard:**
- Gauge (current rate)
- Trend over time
- Avg questions per message (should be close to 1.0)

---

### 5. **Completion Rate (0-100%)**
**Success Metric - Are Conversations Finishing Successfully?**

**What it measures:** % of conversations that reached the final question

**Current Baseline:** ~45% completion rate (Oct 13-20)  
**Goal:** Improve to 60-70%

**Why incomplete:**
- Student disengaged
- AI didn't ask all questions
- Technical issues

**Dashboard:**
- Primary KPI gauge
- Trend over time
- By task comparison (which tasks have low completion?)
- Funnel chart (where do students drop off?)

---

### 6. **Questions Coverage % (0-100%)**
**Compliance - Is AI Asking All Required Questions?**

**What it measures:** % of questions from the task's `questions` array that were actually asked

**Target:** 100% coverage (all questions asked)  
**Issue Identified:** Some tasks have 0% coverage (questions not asked in order)

**Dashboard:**
- By task heatmap (which tasks have coverage issues?)
- Trend over time
- Distribution chart

---

### 7. **Questions Asked in Order (TRUE/FALSE)**
**Compliance - Is AI Following the Question Sequence?**

**What it measures:** Whether AI asked questions in the order specified in the task

**Current Issue:** Tasks 1264, 1259, 1187 have 0% compliance  
**Expected:** 100% compliance

**Dashboard:**
- % of conversations with proper order
- By task breakdown (which tasks have ordering issues?)
- Alert when <80%

---

### 8. **Reflection Detection Rate (0-100%)**
**Learning Outcome - Are Students Reflecting on Their Learning?**

**What it measures:** % of conversations with reflection indicators

**Reflection indicators:**
- "I learned", "I realized", "now I understand"
- "I was wrong", "I should have"
- "this helps me with", "next time I will"
- "I struggled with", "I was confused"
- "aha", "that makes sense", "I get it now"

**Current Baseline:** ~35% reflection rate  
**Good:** >50% reflection rate

**Dashboard:**
- Trend over time
- By task comparison
- Reflection depth (avg reflection count per conversation)

---

### 9. **Adaptation Rate (0-100%)**
**AI Effectiveness - Is AI Responding to Student Signals?**

**What it measures:** % of times AI adapted its approach after student confusion, mistakes, or questions

**Examples of adaptation:**
- Student asks clarifying question → AI provides more detail
- Student makes mistake → AI addresses it
- Student shows confusion → AI rephrases or provides example

**Dashboard:**
- Trend over time
- By mode comparison (which modes adapt better?)

---

### 10. **Engagement Decline Rate (0-100%)**
**Alert Metric - Are Students Getting Less Engaged?**

**What it measures:** % of conversations where student response quality dropped significantly

**Red flag:** Student started strong but responses became short, generic, or stopped

**Dashboard:**
- 🚨 Alert if >20% of conversations show decline
- Identify patterns (which questions cause drop-off?)

---

## 📈 Dashboard Views & Visualizations

### **View 1: Executive Overview (Leadership)**
**Purpose:** High-level health check of conversation mode

**Metrics:**
1. **Big Number Cards:**
   - Total conversations this week
   - Avg student quality score (0-10) with trend arrow
   - Avg human authenticity score (0-10) with trend arrow
   - Completion rate (%) with trend arrow
   - % improvement vs baseline

2. **Time Series (Daily):**
   - Student quality score trend
   - Completion rate trend
   - Human authenticity score trend

3. **Alerts Panel:**
   - Recent alerts from `conversation_efficacy_alerts` table
   - Red/yellow/green status indicators

4. **Mode Comparison (Side-by-side):**
   - Conversation vs Conversation with Guide
   - Quality, completion, authenticity scores

**Filters:** Date range, AI mode

---

### **View 2: AI Behavior Compliance (Product Team)**
**Purpose:** Is the AI following guidelines?

**Visualizations:**

1. **Compliance Gauges (Target vs Actual):**
   - Message length compliance (target: >80%)
   - Single question rate (target: >70%)
   - Questions asked in order (target: 100%)

2. **AI Verbosity Analysis:**
   - Distribution histogram: AI message lengths
   - Scatter plot: AI words vs student quality
   - Insight: "30-50 word AI messages = best student quality"

3. **Question Management:**
   - Heatmap: Questions coverage % by task
   - Table: Tasks with ordering issues (0% compliance)
   - Funnel: Which question # do students drop off?

4. **Time Series:**
   - Avg AI message words (daily trend)
   - Single question rate (daily trend)

**Filters:** Date range, task, AI mode

**Actions:**
- Drill down to specific conversations with issues
- Export tasks with 0% question order compliance

---

### **View 3: Student Engagement & Learning (Product + Leadership)**
**Purpose:** Are students actually learning?

**Visualizations:**

1. **Learning Outcome KPIs:**
   - Student quality score (0-10) - trend + distribution
   - Reflection rate (%) - trend
   - Avg reflection count - trend

2. **Authenticity Analysis (Critical!):**
   - Human authenticity score (0-10) - time series
   - % of conversations with likely AI responses (<5.0 score) - trend
   - Alert: "⚠️ 15% of conversations show AI-generated responses"

3. **Engagement Metrics:**
   - Avg student word count (distribution)
   - Engagement decline rate (% of convos)
   - Conversation duration (avg minutes)

4. **Scatter Plots (Discover Correlations):**
   - AI message length vs student quality
   - Student word count vs quality score
   - Completion % vs quality score

**Filters:** Date range, task, AI mode, quality score range

**Actions:**
- Flag students with authenticity score <5.0 for review
- View example conversations (best/worst)

---

### **View 4: Task-Level Performance (Product Team)**
**Purpose:** Which tasks are working well vs poorly?

**Visualizations:**

1. **Task Comparison Table:**

| Task ID | Task Title | Total Convos | Avg Quality | Completion Rate | Authenticity Score | Questions Coverage | Status |
|---------|------------|--------------|-------------|-----------------|-------------------|-------------------|--------|
| 1301 | IMDb redesign | 45 | 6.2 | 67% | 7.8 | 95% | ✅ Good |
| 1264 | Bug hunting | 38 | 5.1 | 42% | 6.5 | 0% | ⚠️ Fix questions |
| 1259 | QA testing | 29 | 4.8 | 38% | 6.2 | 0% | 🚨 Critical |

**Sort by:** Quality, completion rate, authenticity

2. **Task Performance Matrix:**
   - X-axis: Completion rate
   - Y-axis: Quality score
   - Bubble size: # of conversations
   - Color: Authenticity score

3. **Task Trends:**
   - Select a task → see its metrics over time
   - Compare multiple tasks on same chart

**Filters:** Date range, AI mode

**Actions:**
- Drill into specific task conversations
- Export tasks needing attention

---

### **View 5: Individual Student Progression (Product Team)**
**Purpose:** Track how individual students are progressing

**Visualizations:**

1. **Student Search/Select:**
   - Select student by user_id

2. **Individual Student Dashboard:**
   - **Quality Score Timeline:** Student's quality score across all conversations
   - **Authenticity Trend:** Are they becoming more/less authentic over time?
   - **Completion Rate:** What % of their conversations complete?
   - **Reflection Growth:** Are they reflecting more over time?

3. **Student Conversation List:**
   - All conversations for this student
   - Sortable by date, quality, authenticity
   - Click to view full conversation

4. **Concept Acquisition:**
   - Technical vocabulary usage over time
   - Specificity score trend
   - Critical thinking score trend

**Use Cases:**
- Identify struggling students (quality not improving)
- Identify students copying AI (authenticity declining)
- Celebrate student growth

---

### **View 6: Correlation & Insights Discovery (Product Team)**
**Purpose:** Automated pattern detection

**Visualizations:**

1. **Top Correlations:**
   - "AI messages 30-50 words = +1.2 quality points"
   - "Single questions = +15% completion rate"
   - "Questions in order = +23% completion boost"

2. **Trend Alerts:**
   - "📈 Quality improving +0.51 pts/week"
   - "🚨 Authenticity declining -0.3 pts/week"
   - "✅ Completion rate up +5% this week"

3. **Anomaly Detection:**
   - "⚠️ Task 1259 has 0% question order compliance"
   - "🚨 15 students with authenticity <4.0"

4. **Mode Comparison:**
   - Side-by-side: Conversation vs Conversation with Guide
   - Which mode has better outcomes?

**Auto-Generated Insights:**
- Daily insights (from trends framework)
- Celebrations (what's working)
- Concerns (what needs attention)
- Recommendations (what to try)

---

### **View 7: Conversation Examples Review (Product Team)**
**Purpose:** Manual review of actual conversations

**Data Source:** `conversation_efficacy_examples` table

**Visualizations:**

1. **Example Categories:**
   - 🏆 Best Examples (highest quality)
   - 🚨 Worst Examples (lowest quality)
   - ⚠️ AI-Generated Flagged (authenticity <4.0)

2. **Conversation Viewer:**
   - Formatted back-and-forth
   - Highlighted: AI patterns, reflection indicators, technical terms
   - Metrics shown: quality score, authenticity score, word counts

3. **Filtering:**
   - By task
   - By date range
   - By score range

**Actions:**
- Mark false positives (AI detector wrong)
- Add to training examples

---

## 🎨 Visualization Recommendations

### **Gauges/KPI Cards:**
Use for:
- Compliance metrics (message length, single question rate)
- Overall scores (quality, authenticity, completion)
- Show target threshold line

### **Time Series Line Charts:**
Use for:
- Tracking improvement over time
- All primary KPIs (quality, completion, authenticity)
- Daily or weekly aggregation

### **Heatmaps:**
Use for:
- Task performance (rows = tasks, color = quality/completion)
- Day of week patterns
- Questions coverage by task

### **Distribution Histograms:**
Use for:
- AI message lengths
- Student message lengths
- Quality score distribution

### **Scatter Plots:**
Use for:
- Discovering correlations (AI length vs student quality)
- Task comparison (completion vs quality)
- Identifying outliers

### **Tables with Conditional Formatting:**
Use for:
- Task comparison (color code by performance)
- Alert log
- Student list with flags

### **Funnel Charts:**
Use for:
- Where students drop off (Question 1 → 2 → 3 → completion)

---

## 🔍 Key Questions Dashboard Should Answer

### For Leadership:
1. **Is conversation mode working?** (quality score, completion rate trends)
2. **Are students actually learning?** (quality improving, reflection present, authenticity high)
3. **How does it compare to baseline?** (improvement vs Oct 13-20)
4. **Any red flags?** (alert dashboard)

### For Product Team:
1. **Is the AI following guidelines?** (compliance metrics)
2. **Which tasks are broken?** (0% question order, low completion)
3. **What AI behavior = best student outcomes?** (correlations)
4. **Are students copying AI-generated answers?** (authenticity scores)
5. **Where do students disengage?** (drop-off analysis)
6. **What should we fix first?** (prioritized list based on impact)

---

## 📊 Sample Queries for Dashboard

### **Query 1: Daily Overview KPIs**
```sql
SELECT
  analysis_date,
  SUM(total_conversations) as daily_total,
  AVG(avg_student_quality_score) as daily_quality,
  AVG(avg_human_authenticity_score) as daily_authenticity,
  AVG(avg_completion_rate) as daily_completion,
  AVG(avg_message_compliance_pct) as daily_compliance
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_aggregated_daily`
WHERE analysis_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY analysis_date
ORDER BY analysis_date DESC;
```

### **Query 2: Task Performance Comparison**
```sql
SELECT
  t.id as task_id,
  t.title as task_title,
  COUNT(DISTINCT dm.thread_id) as total_conversations,
  AVG(dm.student_response_quality_score) as avg_quality,
  AVG(dm.completion_pct) as avg_completion,
  AVG(dm.human_authenticity_score) as avg_authenticity,
  AVG(CASE WHEN dm.questions_asked_in_order THEN 1.0 ELSE 0.0 END) as pct_questions_in_order,
  AVG(dm.questions_coverage_pct) as avg_coverage
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_daily_metrics` dm
JOIN `pursuit-ops.pilot_agent_public.tasks` t ON dm.task_id = t.id
WHERE dm.date >= '2025-10-13'
GROUP BY t.id, t.title
ORDER BY avg_quality DESC;
```

### **Query 3: AI-Generated Response Alert**
```sql
SELECT
  date,
  thread_id,
  task_id,
  user_id,
  human_authenticity_score,
  student_response_quality_score,
  likely_ai_generated_pct
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_daily_metrics`
WHERE human_authenticity_score < 5.0
  AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
ORDER BY human_authenticity_score ASC
LIMIT 20;
```

### **Query 4: Student Progression**
```sql
SELECT
  user_id,
  date,
  thread_id,
  task_id,
  student_response_quality_score,
  human_authenticity_score,
  completion_pct,
  reflection_detected
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_daily_metrics`
WHERE user_id = 12345  -- Replace with actual user_id
ORDER BY date ASC;
```

### **Query 5: Correlation Analysis**
```sql
SELECT
  CORR(avg_ai_message_words, student_response_quality_score) as ai_words_quality_corr,
  CORR(CASE WHEN single_question_rate_pct > 70 THEN 1.0 ELSE 0.0 END, completion_pct) as single_q_completion_corr,
  CORR(CASE WHEN questions_asked_in_order THEN 1.0 ELSE 0.0 END, completion_pct) as q_order_completion_corr
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_daily_metrics`
WHERE date >= '2025-10-13';
```

### **Query 6: Weekly Trend**
```sql
SELECT
  DATE_TRUNC(date, WEEK) as week,
  AVG(student_response_quality_score) as avg_quality,
  AVG(completion_pct) as avg_completion,
  AVG(human_authenticity_score) as avg_authenticity,
  COUNT(DISTINCT thread_id) as conversations
FROM `pursuit-ops.pilot_agent_public.conversation_efficacy_daily_metrics`
WHERE date >= '2025-10-13'
GROUP BY week
ORDER BY week;
```

---

## 🚨 Alert Thresholds (Recommended)

| Metric | Warning | Critical |
|--------|---------|----------|
| Avg Quality Score | <5.0 | <4.0 |
| Avg Authenticity Score | <6.0 | <5.0 |
| Completion Rate | <40% | <30% |
| Message Compliance | <70% | <60% |
| Single Question Rate | <60% | <50% |
| Engagement Decline Rate | >20% | >30% |
| Questions Coverage | <80% | <50% |

**Alert Examples:**
- 🚨 "CRITICAL: Avg authenticity score dropped to 4.8 (threshold: 5.0)"
- ⚠️ "WARNING: Task 1259 has 0% question order compliance"
- 🚨 "CRITICAL: 25% of conversations show engagement decline"

---

## 📅 Baseline Data (October 13-20, 2025)

**Use this for comparison:**

| Metric | Baseline Value |
|--------|---------------|
| Total Conversations | 396 |
| Avg Quality Score | 5.2/10 |
| Avg Authenticity Score | 7.1/10 |
| Completion Rate | 45% |
| Message Length Compliance | 73% |
| Single Question Rate | 68% |
| Reflection Rate | 35% |
| Engagement Decline Rate | 18% |

**Trends Identified:**
- Quality improving +0.51 points/week ✅
- 30-50 word AI messages = +1.2 quality boost ✅
- Questions asked in order = +23% completion boost ✅

---

## 🔗 Data Access

**BigQuery Project:** `pursuit-ops`  
**Dataset:** `pilot_agent_public`

**Tables:**
1. `conversation_efficacy_daily_metrics` - Individual conversations
2. `conversation_efficacy_aggregated_daily` - Daily aggregates
3. `conversation_efficacy_alerts` - Alert log
4. `conversation_efficacy_examples` - Best/worst examples

**Update Schedule:** Daily at 2 AM EST

---

## 🎯 Priority Features for V1 Dashboard

### Must-Have:
1. ✅ Executive overview (big numbers + trends)
2. ✅ Task comparison table
3. ✅ Authenticity alert (students copying AI)
4. ✅ AI compliance gauges
5. ✅ Time series: quality, completion, authenticity

### Nice-to-Have:
6. Student progression tracking
7. Correlation discovery
8. Conversation examples viewer
9. Funnel chart (drop-off analysis)

### Future:
10. Automated daily insights generation
11. Predictive modeling (which convos will fail?)
12. Real-time alerts

---

## 📝 Notes for Dashboard Developer

1. **Color Coding:**
   - 🟢 Green: Score >7.0, completion >60%, compliance >80%
   - 🟡 Yellow: Score 5-7, completion 40-60%, compliance 60-80%
   - 🔴 Red: Score <5, completion <40%, compliance <60%

2. **Filters to Include:**
   - Date range (last 7 days, last 30 days, custom, Oct 13-20 baseline)
   - AI helper mode (conversation, conversation_with_guide)
   - Task ID (dropdown with task titles)
   - Quality score range (slider)
   - Authenticity score range (slider)

3. **Interactivity:**
   - Click on any data point → drill down to individual conversations
   - Click on task row → see all conversations for that task
   - Click on alert → see affected conversations
   - Hover for tooltips with definitions

4. **Export Options:**
   - Download tables as CSV
   - Export charts as PNG
   - Generate weekly summary report

5. **Refresh:**
   - Auto-refresh daily at 3 AM EST (after data pipeline runs)
   - Manual refresh button

---

## ❓ Questions?

Contact: [Your contact info]  
Documentation: `/conversation_efficacy_tracking/` folder  
Last Updated: October 21, 2025

