# 📖 FieldOPS — Complete Feature Explanation Guide

> **FieldOPS** — AI-Powered Political Field Intelligence Operating System  
> **Hackathon:** India Innovates 2026 — World's Largest Civic Tech Hackathon  
> **Domain:** Digital Democracy

This document provides a detailed explanation of every feature in the FieldOPS platform, organized by module category.

---

## Table of Contents

1. [Command Center](#1-command-center)
2. [Operations](#2-operations)
3. [Intelligence](#3-intelligence)
4. [Monitoring](#4-monitoring)
5. [Security & Authentication](#5-security--authentication)

---

## 1. Command Center

### 1.1 War Room Dashboard (`/dashboard`)

**What it does:**  
The War Room is the central command hub — a real-time, single-pane-of-glass view of all field operations. It aggregates data from every module into actionable KPIs.

**Key Components:**
- **Animated Stat Cards** — Active workers, tasks completed, pending tasks, and average performance score update in real-time with smooth animations.
- **Performance Trend Charts** — Line/area charts (Recharts) visualize historical performance patterns over time, enabling trend analysis.
- **Task Distribution** — Pie/bar breakdown of task statuses (pending, assigned, in-progress, completed, cancelled) showing pipeline health.
- **Recent Activity Feed** — Live stream of operational events — task completions, attendance marks, new assignments.
- **District Breakdown** — Regional performance comparison table ranking districts by worker output and task completion.

**Why it matters:**  
In a national campaign with 500+ constituencies, campaign managers need a single view to identify which regions are performing and which need intervention — without manually checking each district.

**Technical Details:**  
- Data fetched via Supabase client with TanStack React Query for caching and background refetch.
- Real-time updates via Supabase Realtime WebSocket subscriptions.
- Charts rendered using Recharts with responsive containers.

---

### 1.2 War Mode (`/war-mode`)

**What it does:**  
War Mode is a real-time emergency broadcast and crisis management system. It enables campaign leadership to push urgent alerts to all field operatives instantly.

**Key Components:**
- **Crisis Mode Activation** — One-click button to activate emergency mobilization. Sends an emergency-severity broadcast to all users.
- **Crisis Mode Deactivation** — "Stop Crisis" button deactivates all active emergency broadcasts and sends a stand-down notice, clearing the crisis state across the system.
- **Crisis Active Banner** — When crisis mode is active, a persistent red banner with pulsing animation and inline "Stand Down" button appears at the top of the page.
- **Broadcast Form** — Create broadcasts with title, message, and severity level (info, warning, critical, emergency).
- **Broadcast Feed** — Chronological list of all broadcasts with severity-coded styling, LIVE badges for active broadcasts, and dismiss buttons.
- **Live Stats** — Real-time counts of operatives online, pending operations, and critical alerts.

**Why it matters:**  
On election day or during a crisis, every second counts. War Mode ensures all field workers receive critical instructions simultaneously — no phone chains, no delays.

**Technical Details:**
- Broadcasts stored in `broadcasts` table with `is_active` flag and `severity` field.
- Real-time delivery via Supabase Realtime subscriptions on INSERT events.
- Crisis mode auto-detected by checking for active emergency-severity broadcasts.
- RLS policies restrict broadcast creation to admins and district heads only.

---

### 1.3 AI Co-Pilot (`/ai-copilot`)

**What it does:**  
A conversational AI assistant that helps commanders make strategic decisions by analyzing operational data through natural language queries.

**Key Components:**
- **Chat Interface** — Type questions in natural language and receive AI-generated strategic responses.
- **Streaming Responses** — AI responses stream in real-time for a responsive experience.
- **Context-Aware** — The AI has access to worker data, task status, attendance patterns, and performance metrics for grounded answers.

**Example Queries:**
- "Which district has the lowest readiness and what should we do?"
- "Summarize today's field operations."
- "How should we redistribute workers for maximum coverage?"

**Why it matters:**  
Campaign managers are often non-technical. The AI Co-Pilot converts complex multi-table analytics into plain-language recommendations, making data-driven decision-making accessible to everyone.

**Technical Details:**
- Powered by Google Gemini via the Lovable AI Gateway (no external API keys required).
- Edge Function `ai-copilot` receives the query with user's JWT, validates auth, and sends operational context to the AI model.
- Session-based authentication ensures only authorized users can access AI features.

---

## 2. Operations

### 2.1 Worker Management (`/workers`)

**What it does:**  
Complete lifecycle management for field operatives — from onboarding to performance tracking to deactivation.

**Key Components:**
- **Worker Roster** — Searchable, filterable list of all registered operatives with performance stats and role badges.
- **Add Worker Dialog** — Create workers with full details: name, phone, email, district, booth, constituency, skills, experience level, role, and status.
- **Auto Account Creation** — When an email is provided, the system automatically creates a login account via the `create-worker-account` Edge Function and returns temporary credentials.
- **Role Badges** — Color-coded badges (Volunteer = teal, Booth Head = green, District Head = amber, Admin = red) on each worker card.
- **Worker Profiles** (`/workers/:id`) — Detailed drill-down pages with performance history, earned badges, task audit trail, and trend charts.
- **Admin-Only Delete** — Only users with the admin role can see and use the delete button to remove workers from the roster. Non-admin users cannot delete workers.

**Why it matters:**  
Political campaigns manage tens of thousands of workers. Manual onboarding and tracking is impossibly slow — FieldOPS digitizes the entire process with role-based permissions baked in.

**Technical Details:**
- Workers stored in `workers` table with foreign key to `auth.users` via `user_id`.
- Role check via `useAuth()` hook — `role === "admin"` controls delete button visibility.
- Edge Function handles auth account creation with role assignment and temp password generation.
- RLS policies allow admins and district heads to manage workers; everyone can view.

---

### 2.2 Task Management (`/tasks`)

**What it does:**  
Full CRUD task lifecycle management with priority levels, status workflows, and geographic assignment.

**Key Components:**
- **Task List** — All tasks displayed with priority badges (low/medium/high/critical) and status pills (pending/assigned/in-progress/completed/cancelled).
- **Create Task** — Dialog to create new tasks with title, description, priority, district, booth, and due date.
- **Edit Task** — Pencil icon on each task card opens the same dialog pre-filled for editing. Allows updating title, description, priority, location, and due date.
- **Delete Task** — Trash icon on each task card for permanent removal with confirmation.
- **Status Update** — Inline dropdown to change task status. Setting "completed" auto-records the completion timestamp.

**Why it matters:**  
Field operations generate hundreds of tasks daily. Without structured tracking, tasks get lost, duplicated, or forgotten. FieldOPS ensures every task is tracked from creation to completion.

**Technical Details:**
- Tasks stored in `tasks` table with PostgreSQL enums for `task_priority` and `task_status`.
- `created_by` field links tasks to their creator for ownership tracking.
- RLS allows task creators and admins to manage tasks; all authenticated users can view.

---

### 2.3 AI Smart Assign (`/smart-assign`)

**What it does:**  
AI-powered task-to-worker matching that recommends the optimal worker for each task based on multiple data dimensions.

**Key Components:**
- **Task Selection** — Choose an unassigned task from the pending list.
- **AI Analysis** — Click "Get AI Recommendations" to trigger the AI matching engine.
- **Ranked Results** — Top 3 worker recommendations with fit scores and detailed reasoning (skills match, location proximity, workload balance, experience level).
- **One-Click Assignment** — Accept a recommendation to instantly assign the worker.

**Why it matters:**  
Manual assignment is biased, slow, and often suboptimal. AI considers 6+ data dimensions simultaneously and returns results in under 3 seconds — something no human coordinator can match at scale.

**Technical Details:**
- Edge Function `ai-task-assign` receives task details and all available worker profiles.
- Google Gemini evaluates skills[], experience_level, performance_score, tasks_completed, district match, and current workload.
- JWT authentication validates the caller before processing.

---

### 2.4 Workload Balancer (`/workload`)

**What it does:**  
Visual analysis of task distribution across workers to identify overloaded and underutilized operatives.

**Key Components:**
- **Workload Distribution Chart** — Bar/radar visualization showing tasks assigned per worker.
- **Overload Indicators** — Workers exceeding capacity thresholds are flagged.
- **Rebalancing Recommendations** — Suggestions for redistributing tasks to optimize capacity.

**Why it matters:**  
Uneven task distribution leads to burnout for some workers and idle time for others. The Workload Balancer ensures equitable distribution, maximizing team productivity.

---

### 2.5 Attendance System (`/attendance`)

**What it does:**  
Comprehensive attendance tracking supporting manual GPS-verified check-ins, daily status marking, and real-time analytics.

**Key Components:**
- **Mark Attendance Tab** — Table of all active workers with attendance action buttons (Present, Absent, Late, On Leave, Half Day) and GPS-verified check-in/check-out.
- **Admin-Only Marking** — Only admin users can mark attendance or perform check-outs. Non-admin users see "Admin only" in the Actions column and can only view attendance data.
- **GPS Verification** — Check-in coordinates captured via browser Geolocation API and stored for location validation.
- **Records Tab** — Daily attendance log with timestamps, duration calculation, and GPS verification badges.
- **Analytics Tab** — Attendance distribution pie chart, district-level rates, GPS verification stats, and trend analysis.

**Why it matters:**  
Ghost attendance is a massive problem in political field operations. GPS-verified check-ins with admin-only control make it virtually impossible to fake presence.

**Technical Details:**
- Attendance stored in `attendance` table with worker_id, date, status, GPS coordinates, and marked_by.
- Admin check via `useAuth()` — `role === "admin"` controls button visibility.
- RLS policies allow admins and district heads to manage attendance; all users can view.
- Real-time updates via Supabase Realtime subscriptions.

---

## 3. Intelligence

### 3.1 Readiness Index (`/readiness`)

**What it does:**  
AI-predicted constituency and booth preparedness scoring that identifies weak spots before election day.

**Key Components:**
- **Readiness Scores** — AI-generated scores per constituency/booth on a 0-100 scale.
- **Risk Categories** — Color-coded: Critical (red), At Risk (amber), On Track (blue), Strong (green).
- **Analyze Button** — Trigger fresh AI analysis to recalculate readiness based on current data.
- **Improvement Recommendations** — AI provides specific actions to improve readiness in weak areas.

**Why it matters:**  
Knowing three weeks before election day that a district is "Critical" gives leadership time to intervene — reassigning workers, increasing resources, or escalating attention.

**Technical Details:**
- Edge Function `ai-readiness` aggregates worker coverage, task completion rates, attendance patterns, and performance scores.
- Google Gemini processes the data and returns readiness predictions with confidence scores.

---

### 3.2 Geo Intel (`/geo-intel`)

**What it does:**  
Interactive geospatial intelligence map showing worker distribution, engagement patterns, and district-level analytics.

**Key Components:**
- **Interactive Map** — Leaflet/OpenStreetMap with worker markers color-coded by status (green = active, amber = on leave, red = inactive).
- **District Overlays** — Geographic boundaries with performance data overlays.
- **Engagement Heatmaps** — Visual density maps showing worker concentration areas.

**Why it matters:**  
Understanding where workers are (and aren't) deployed is critical for coverage optimization. The map instantly reveals deployment gaps that spreadsheets hide.

**Technical Details:**
- Leaflet.js with React-Leaflet bindings for cost-free interactive mapping (no Google Maps API costs).
- Worker data fetched from Supabase and plotted by district/booth assignment coordinates.

---

### 3.3 GPS Tracking (`/gps-tracking`)

**What it does:**  
Real-time worker location tracking with geo-fencing, route optimization, and breach detection.

**Key Components:**
- **Map Tab** — Live worker positions with simulated GPS movement and trail visualization.
- **Geo-Fence Tab** — Define custom boundary zones around assigned areas with configurable radius. Workers are auto-tracked against these boundaries.
- **Routes Tab** — Select a worker and click "Optimize Route" to calculate the most efficient path between booth zones using a nearest-neighbor algorithm.
- **Breaches Tab** — Automatic alerts when workers cross geo-fence boundaries, with timestamps and location data.
- **Push Notifications** — Browser-based alerts for real-time breach notifications.

**Why it matters:**  
Ensures workers are where they're supposed to be, optimizes their routes to save time, and instantly flags unauthorized movements.

**Technical Details:**
- Browser Geolocation API captures coordinates.
- Geo-fence comparison runs client-side against defined zone polygons.
- Push notifications via browser Notification API.
- Route optimization uses nearest-neighbor algorithm for path calculation.

---

### 3.4 Issue Heatmap (`/issue-heatmap`)

**What it does:**  
Geographic visualization of field issues across Indian districts, enabling pattern recognition and priority-based response.

**Key Components:**
- **Interactive Map** — Circle markers across districts, color-coded by severity (green/amber/red).
- **Category Filters** — Filter by issue type: logistics, security, infrastructure, communication, etc.
- **Severity Filters** — Filter by severity level to focus on critical issues.
- **Statistical Charts** — Top districts bar chart, category distribution pie chart, severity breakdown.

**Why it matters:**  
Scattered reports from the field are meaningless without geographic context. The heatmap transforms fragmented data into actionable geographic intelligence.

---

### 3.5 Public Sentiment (`/public-sentiment`)

**What it does:**  
AI-powered public opinion monitoring using NLP to analyze feedback and track sentiment trends across districts.

**Key Components:**
- **14-Day Trend Chart** — Area chart showing sentiment movement over two weeks.
- **Topic-Based Breakdown** — Sentiment scores per topic (infrastructure, healthcare, corruption, security).
- **District Leaderboard** — Rankings by average sentiment score across districts.
- **AI Analysis** — Automated sentiment classification (positive/negative/neutral) with confidence scores.

**Why it matters:**  
Understanding how public opinion shifts across districts enables proactive communication strategies. Declining sentiment in a region signals an emerging problem before it becomes a crisis.

**Technical Details:**
- Edge Function `analyze-sentiment` processes feedback text through Google Gemini.
- Returns sentiment classification, confidence score, and extracted topics.
- Results stored in `feedback` table with `sentiment`, `sentiment_score`, and `topics` fields.

---

### 3.6 Hierarchy Analytics (`/hierarchy`)

**What it does:**  
Organizational hierarchy visualization with performance aggregation across levels.

**Key Components:**
- **Hierarchy Tree** — Visual representation of Admin → District Heads → Booth Heads → Volunteers.
- **Performance Roll-Ups** — Aggregate metrics flow from individual workers up through the hierarchy.
- **Bottleneck Detection** — Identifies organizational levels where performance drops occur.

**Why it matters:**  
Performance problems often originate at specific hierarchy levels. This module pinpoints whether issues are at the volunteer, booth, or district level — enabling targeted interventions.

---

### 3.7 Intel Brief (`/intel-brief`)

**What it does:**  
Consolidated intelligence reports that aggregate data from all modules into a professional, exportable briefing document.

**Key Components:**
- **AI-Generated Report** — Comprehensive briefing covering Executive Summary, Operational Status, Worker Performance, Task Pipeline, Risk Assessment, and Strategic Recommendations.
- **Clean Formatting** — Professional markdown rendering with styled headers, bullet points, and section dividers (no decorative symbols or clutter).
- **PDF Export** — One-click export to PDF with proper formatting, headers, page breaks, and "CLASSIFIED" footer — ready for offline distribution.

**Why it matters:**  
Campaign leadership often doesn't log into the system. The Intel Brief provides a one-page intelligence summary they can read on paper or a phone, ensuring all stakeholders are informed regardless of tech access.

**Technical Details:**
- AI-generated via Google Gemini with structured prompts that enforce professional formatting.
- PDF generated client-side using jsPDF with custom styling.
- Markdown-to-HTML renderer for clean in-app display.

---

### 3.8 Digital Twin (`/digital-twin`)

**What it does:**  
A virtual simulation engine for election-day scenario modeling. Campaign managers can test strategies in a risk-free virtual environment.

**Key Components:**
- **Scenario Builder** — Configure variables: voter turnout, worker availability, resource allocation, booth failures.
- **AI Simulation** — Run "what-if" scenarios and see predicted outcomes.
- **Strategy Comparison** — Compare outcomes across different strategy configurations.

**Example Scenarios:**
- "What if voter turnout drops 10% in the northern districts?"
- "What if we reassign 20 workers from District A to District B?"
- "What if 3 booth locations become unavailable?"

**Why it matters:**  
Strategic decisions in campaigns are high-stakes and irreversible. The Digital Twin lets leaders make mistakes in simulation — not in reality — reducing costly strategic errors.

---

## 4. Monitoring

### 4.1 Leaderboard (`/leaderboard`)

**What it does:**  
Gamified performance rankings that create healthy competition among field workers and recognize top performers.

**Key Components:**
- **Performance Rankings** — Workers ranked by composite score (tasks completed, performance score, attendance).
- **Badge System** — Achievement badges earned for milestones (stored in `badges` table).
- **Category Filtering** — Filter by district, role, or time period.

**Why it matters:**  
Gamification transforms routine field work into a motivating experience. Recognition through badges and rankings improves task completion rates without managerial pressure.

---

### 4.2 Feedback & Sentiment (`/feedback`)

**What it does:**  
Collects field-level feedback from workers and processes it through AI for sentiment analysis and topic extraction.

**Key Components:**
- **Feedback Submission** — Workers submit text feedback about ground conditions.
- **AI Sentiment Analysis** — Automatic classification as positive, negative, or neutral with a 0-1 confidence score.
- **Topic Extraction** — AI identifies key themes (logistics, security, infrastructure, morale, corruption).
- **Trend Visualization** — Sentiment trends over time per district and topic.

**Why it matters:**  
Raw feedback from thousands of workers is unreadable. AI converts it into quantified intelligence — sentiment scores and topic trends — that leadership can act on.

**Technical Details:**
- Edge Function `analyze-sentiment` processes each feedback submission.
- Results stored in `feedback` table: `sentiment` (text), `sentiment_score` (numeric), `topics` (text array).
- RLS policies allow any authenticated user to create feedback; admins can manage all entries.

---

### 4.3 Burnout Detection (`/burnout`)

**What it does:**  
Proactive monitoring of worker behavioral patterns to identify burnout risk before it leads to disengagement or attrition.

**Key Components:**
- **Risk Scoring** — Workers scored on burnout risk based on consecutive active days, task overload, declining performance, and irregular attendance.
- **Alert System** — At-risk workers flagged for manager attention with recommended interventions.
- **Trend Analysis** — Historical burnout risk patterns across the workforce.

**Why it matters:**  
A burnt-out worker is worse than no worker — they make mistakes, disengage, and demoralize others. Early detection enables interventions like task redistribution, rest periods, or workload rebalancing.

---

### 4.4 Fraud Detection (`/fraud-detection`)

**What it does:**  
Automated anomaly detection engine that identifies suspicious patterns across attendance, task completion, and performance data.

**Key Anomaly Types:**
- **GPS Spoofing** — Check-in locations far from assigned booths.
- **Impossible Travel** — Check-ins at distant locations within unrealistic time frames.
- **Ghost Workers** — Accounts with no genuine activity patterns.
- **Speed Completion** — Suspiciously fast task completions suggesting data fabrication.
- **Duplicate Reports** — NLP-based detection of copied or near-identical feedback submissions.

**Why it matters:**  
Manual fraud detection is impossible at scale. Automated anomaly detection catches patterns that human oversight would miss — protecting operational integrity and ensuring authentic data.

---

### 4.5 Resource Optimization (`/resources`)

**What it does:**  
Budget and resource allocation analysis with efficiency recommendations to maximize operational impact within constraints.

**Key Components:**
- **Resource Distribution** — Visual breakdown of resource allocation across districts and operations.
- **Efficiency Metrics** — Cost-per-task, resource utilization rates, and ROI indicators.
- **Optimization Recommendations** — AI-suggested reallocation for maximum efficiency.

**Why it matters:**  
Political campaigns operate on tight budgets. Resource Optimization ensures every rupee is spent where it creates the most impact.

---

### 4.6 Blockchain Ledger (`/blockchain`)

**What it does:**  
An immutable, blockchain-inspired audit trail that records every field action using cryptographic hash-chaining.

**Key Components:**
- **Activity Log** — Chronological record of all field actions: task assignments, attendance marks, status changes, worker modifications.
- **Hash Chain** — Each entry contains a SHA-256 `data_hash` and links to the `previous_hash`, creating a tamper-proof chain.
- **Integrity Verification** — Interface to validate the hash chain and detect any tampering attempts.

**How it works:**
1. An action occurs (e.g., worker marks attendance).
2. The system creates an audit entry with: actor_id, action_type, entity_type, entity_id, and details (JSONB).
3. A SHA-256 hash is computed from the entry data.
4. The hash of the previous entry is stored as `previous_hash`, linking the chain.
5. If anyone modifies a historical record, the hash chain breaks — making tampering mathematically detectable.

**Why it matters:**  
Post-election audits and legal challenges require irrefutable evidence of what happened. The blockchain ledger provides that — no records can be altered, deleted, or fabricated without detection.

**Technical Details:**
- Stored in `audit_log` table with RLS: no UPDATE or DELETE policies — records are truly immutable.
- Only admins and district heads can view the log; all authenticated users can insert entries.
- SHA-256 hashing with chain linking for cryptographic integrity.

---

## 5. Security & Authentication

### 5.1 Role-Based Access Control (RBAC)

**What it does:**  
Four-tier hierarchical access control system that determines what each user can see and do.

**Roles:**
| Role | Scope | Capabilities |
|------|-------|-------------|
| **Admin** | Global | Full access to all features, all data, all management operations. Can mark attendance, delete workers, manage all tasks and broadcasts. |
| **District Head** | District-level | View and manage workers, tasks, and data within their district. Can create broadcasts and manage attendance. |
| **Booth Head** | Booth-level | View assigned booth data, manage booth-level tasks and workers. |
| **Volunteer** | Individual | View own assignments, tasks, and attendance. Submit feedback. Cannot mark attendance, delete workers, or create broadcasts. |

**Implementation:**
- Roles stored in dedicated `user_roles` table (not on profiles — prevents privilege escalation).
- `has_role()` SECURITY DEFINER function checks permissions without recursive RLS issues.
- `handle_new_user()` trigger auto-assigns role on signup.
- Frontend uses `useAuth()` hook to conditionally render UI elements based on role.

### 5.2 Row-Level Security (RLS)

**What it does:**  
Database-level policies that ensure users can only access rows they're authorized to see — enforced at the PostgreSQL level, not just the frontend.

**Key Policies:**
- Workers table: Admins/district heads manage; all can view.
- Tasks table: Creators and admins manage; all can view.
- Attendance table: Admins and district heads manage; all can view. Marking restricted to admins in the UI.
- Broadcasts table: Admins/district heads create; all can view.
- Audit log: Admins/district heads can view; all can insert. No UPDATE or DELETE allowed.
- User roles: Admins manage; users view own role.

### 5.3 Secure Authentication

**What it does:**  
JWT-based email/password authentication with email verification, session management, and secure password handling.

**Features:**
- Email/password signup with role selection.
- Email verification required before login (not auto-confirmed).
- JWT tokens with automatic refresh.
- Protected routes redirect unauthenticated users to `/auth`.
- Change password functionality at `/change-password`.
- Password reset via email at `/reset-password`.

---

## Feature Count Summary

| Category | Features | Count |
|----------|----------|-------|
| **Command** | War Room Dashboard, War Mode (with Crisis Activation/Deactivation), AI Co-Pilot | 3 |
| **Operations** | Worker Management (with Admin-Only Delete), Task Management (with Edit/Delete), AI Smart Assign, Workload Balancer, Attendance (Admin-Only Marking) | 5 |
| **Intelligence** | Readiness Index, Geo Intel, GPS Tracking (Map/Geo-Fence/Routes/Breaches), Issue Heatmap, Public Sentiment, Hierarchy Analytics, Intel Brief (with PDF Export), Digital Twin | 8 |
| **Monitoring** | Leaderboard, Feedback & Sentiment, Burnout Detection, Fraud Detection, Resource Optimization, Blockchain Ledger | 6 |
| **Security** | RBAC, Row-Level Security, Secure Authentication | 3 |
| **Total** | | **25+ distinct features** |

---

## AI-Powered Features (Edge Functions)

| Edge Function | Feature | AI Model |
|--------------|---------|----------|
| `ai-copilot` | AI Co-Pilot conversational assistant | Google Gemini (Lovable AI Gateway) |
| `ai-readiness` | Predictive Readiness Index scoring | Google Gemini (Lovable AI Gateway) |
| `ai-task-assign` | Smart Task Assignment matching | Google Gemini (Lovable AI Gateway) |
| `analyze-sentiment` | Feedback sentiment analysis & topic extraction | Google Gemini (Lovable AI Gateway) |
| `create-worker-account` | Auto account creation for workers | N/A (auth logic) |

---

## Recent Updates

- **War Mode Crisis Deactivation** — Added "Stop Crisis" button that deactivates all active emergency broadcasts and sends a stand-down notice. Crisis-active banner with inline stand-down option.
- **Admin-Only Attendance** — Only admin users can mark attendance or check out workers. Non-admin users see "Admin only" in the Actions column.
- **Task Edit & Delete** — Every task now has edit (pencil) and delete (trash) buttons for full CRUD management.
- **Admin-Only Worker Delete** — The delete button on worker cards is only visible to admin users, preventing unauthorized removal of operatives.

---

> **"In the field, information is ammunition. FieldOPS ensures you never run out."**
