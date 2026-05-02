# Notification System Design

---

## Stage 1

### Real-Time Notification System Architecture

**Chosen Mechanism: WebSockets**

WebSockets maintain a persistent, bidirectional connection between the server and each connected client. When the HR or system publishes a notification, the server pushes it instantly to all relevant connected clients without the client needing to poll.

**Why WebSockets over alternatives:**
- **Polling**: Client repeatedly asks "any new notifications?" — wastes bandwidth, adds latency, hammers the DB
- **Server-Sent Events (SSE)**: One-directional (server → client only), simpler but less flexible
- **WebSockets**: Full-duplex, low latency, ideal for real-time two-way communication

**High-Level Architecture:**

```
Client (Browser)
    |
    | WebSocket connection (ws://)
    |
WebSocket Server (Node.js + ws / socket.io)
    |
    | Publishes events
    |
Message Broker (Redis Pub/Sub)
    |
    | Subscribers
    |
Notification Service  ──────►  Database (PostgreSQL)
    |
    | REST API
    |
HR / Admin Panel
```

**Flow:**
1. HR clicks "Notify All" → hits REST API on Notification Service
2. Notification Service saves to DB and publishes event to Redis channel
3. WebSocket Server is subscribed to Redis — receives event
4. WebSocket Server pushes notification to all connected student clients
5. Students receive notification in real-time without refreshing

**Scalability consideration:**
Using Redis Pub/Sub as the broker means multiple WebSocket server instances can all subscribe to the same channel — horizontally scalable.

---

## Stage 2

### Notification App Backend Design

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications/top?n=10 | Get top N priority notifications |
| GET | /api/notifications | Get all notifications |
| PATCH | /api/notifications/:id/read | Mark notification as read |

**Folder Structure:**
```
notification_app_be/
├── config/         # App configuration, env vars
├── handler/        # HTTP request/response controllers
├── repository/     # External API and DB calls
├── service/        # Business logic (priority scoring)
├── route/          # Express route definitions
├── middleware/     # Error handling, auth, logging
├── utils/          # MinHeap, helper functions
└── index.js        # Entry point
```

**Key Design Decisions:**
- No user authentication required (pre-authorised per evaluation rules)
- Logging middleware integrated at every layer (handler, service, repository)
- Priority scoring: `typeWeight × recencyScore` with weights Placement=3, Result=2, Event=1
- Min-heap of size N used for efficient top-N selection

---

## Stage 3

### SQL Query Analysis

**The original query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Is this query accurate?**
Yes, the logic is correct — it fetches unread notifications for a specific student ordered by newest first.

**Why is it slow?**
With 50,000 students and 5,000,000 notifications:
- No indexes exist on `studentID`, `isRead`, or `createdAt`
- The database performs a **full table scan** — scanning all 5M rows to find matches
- `ORDER BY createdAt DESC` on an unindexed column requires an in-memory sort of all matched rows
- `SELECT *` fetches all columns including large text fields that may not be needed

**What would you change?**

1. Add a composite index:
```sql
CREATE INDEX idx_notifications_student_unread
ON notifications (studentID, isRead, createdAt DESC);
```
This index covers all three clauses (WHERE + ORDER BY) — the query becomes an **index scan** instead of a full table scan. Estimated improvement: from seconds to milliseconds.

2. Replace `SELECT *` with specific columns:
```sql
SELECT id, message, notificationType, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

3. Add pagination to avoid loading thousands of rows at once:
```sql
LIMIT 20 OFFSET 0;
```

**Likely computation cost improvement:**
- Before: O(N) full scan = ~5M row reads
- After: O(log N + K) index lookup where K = matching rows ≈ dramatically faster

**Should we add indexes on EVERY column?**
**No.** This advice is not effective. Indexes:
- Speed up **reads** but slow down **writes** (INSERT/UPDATE/DELETE must update every index)
- Consume significant disk space
- The query planner can be confused by too many indexes and choose suboptimally

Only index columns that are frequently used in WHERE, JOIN, or ORDER BY clauses.

**Query to find all students who got a Placement notification in the last 7 days:**
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';
```

Add a supporting index:
```sql
CREATE INDEX idx_notif_type_created
ON notifications (notificationType, createdAt DESC);
```

---

## Stage 4

### Caching Strategy for Notification Fetching

**Problem:** Notifications are fetched on every page load for every student, overwhelming the database.

**Proposed Solutions:**

### Strategy 1: Redis Cache per Student
Cache each student's unread notifications in Redis with a TTL.

```
Request → Check Redis cache
  Hit  → Return cached data (fast, no DB hit)
  Miss → Query DB → Store in Redis (TTL: 60s) → Return
```

**On new notification:** Invalidate that student's cache key so next request is fresh.

- ✅ Dramatic DB load reduction
- ✅ Sub-millisecond response for cache hits
- ⚠️ Tradeoff: Stale data for up to TTL duration; cache invalidation logic needed

### Strategy 2: Pagination
Instead of fetching ALL notifications on page load, fetch only the first page (e.g., 20 items).

```sql
SELECT ... LIMIT 20 OFFSET 0;
```

- ✅ Less data transferred and processed per request
- ✅ Simple to implement
- ⚠️ Tradeoff: Multiple requests needed to see older notifications

### Strategy 3: Push over Pull (WebSockets)
Instead of fetching on page load, load notifications once at login and then receive new ones via WebSocket push.

- ✅ Eliminates repeated page-load DB queries entirely
- ✅ Real-time delivery
- ⚠️ Tradeoff: More complex infrastructure (WebSocket server, Redis Pub/Sub)

### Recommended Combination:
1. **On login**: Fetch last 20 notifications (paginated) and cache in Redis
2. **New arrivals**: Pushed via WebSocket, appended to client state
3. **Cache invalidation**: On new notification event, clear Redis key for that student

This eliminates the DB query on every page load while keeping data fresh.

---

## Stage 5

### Bulk Notification Redesign

**Problems with the original pseudocode:**
```
for student_id in 50,000:
  send_email()   # sequential
  save_to_db()
  push_to_app()
```

1. **Sequential processing** — 50,000 iterations one by one is extremely slow
2. **No error handling** — if email fails for student 200, what happens to students 201–50,000?
3. **Tight coupling** — email sending and DB saving are in the same transaction; if one fails, the whole operation is unclear
4. **No retry mechanism** — the 200 failed emails are simply lost
5. **Blocking** — the HR waits for all 50,000 operations to complete before getting a response

**Should DB save and email happen together?**
No. They are independent concerns:
- DB save is fast and local — should always succeed
- Email sending depends on an external service — can fail, be slow, or rate-limited
- Coupling them means an email failure could cause a missed DB record, or vice versa

**Redesigned Approach using a Message Queue:**

```
function notify_all(student_ids, message):
  for student_id in student_ids:
    enqueue("notification_queue", { student_id, message })
  return { status: "queued", count: len(student_ids) }
  # Returns immediately — HR doesn't wait

// Worker (runs concurrently, multiple instances)
worker():
  while true:
    job = dequeue("notification_queue")
    
    // Save to DB first — fast and reliable
    save_to_db(job.student_id, job.message)
    
    // Send email — with retry on failure
    result = send_email(job.student_id, job.message)
    if result.failed:
      enqueue("retry_queue", { ...job, attempts: job.attempts + 1 })
    
    // Push in-app notification
    push_to_app(job.student_id, job.message)
```

**What happens to the 200 failed emails?**
- They are moved to a **dead letter queue (DLQ)**
- A retry worker picks them up and retries with exponential backoff
- After N retries, they are flagged for manual review
- Crucially: the other 49,800 students are NOT affected

**Revised Pseudocode:**
```
function notify_all(student_ids, message):
  batch_id = generate_uuid()
  for student_id in student_ids:
    enqueue("notification_queue", {
      batch_id,
      student_id,
      message,
      attempts: 0
    })
  return { status: "processing", batch_id, total: len(student_ids) }

email_worker():  # Run N parallel instances
  job = dequeue("notification_queue")
  save_to_db(job)
  try:
    send_email(job)
    push_to_app(job)
  catch error:
    if job.attempts < 3:
      enqueue("notification_queue", { ...job, attempts: job.attempts + 1 })
    else:
      enqueue("dead_letter_queue", job)
      log_error("email failed after 3 attempts", job.student_id)
```

---

## Stage 6

### Priority Inbox Implementation

**Approach:**

Priority score is calculated as:
```
score = typeWeight × recencyScore × 100

typeWeight:  Placement = 3, Result = 2, Event = 1
recencyScore = 1 / (1 + ageInMinutes)
```

This ensures:
- Placement notifications always rank above Result, which ranks above Event at the same recency
- Newer notifications rank higher within the same type
- The combined score balances both type importance and freshness

**Efficient Top-N Maintenance using Min-Heap:**

A min-heap of size N is used instead of sorting all notifications:
- Heap always contains the current top-N candidates
- The root (minimum) of the heap is the "weakest" notification in our top-N
- For each new notification: if its score > root's score → eject root, insert new
- Time complexity: O(M log N) where M = total notifications, N = top count
- Much better than O(M log M) full sort when N << M

**For continuously arriving notifications:**
The same heap structure handles dynamic updates efficiently. Each new notification is compared against the heap root in O(1) and inserted in O(log N) if it qualifies.

**Code Location:** `notification_app_be/`

**API:** `GET /api/notifications/top?n=10`

See implementation in:
- `service/notificationService.js` — scoring and heap logic
- `utils/minHeap.js` — min-heap data structure
- `handler/notificationHandler.js` — HTTP layer