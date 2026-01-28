# LTIP Database Layer Design Document

**Date**: 2026-01-28
**Work Package**: WP2 - Database Layer
**Duration**: 4 days
**Dependencies**: WP1 (Complete)
**Author**: ODIN Agent

---

## 1. Executive Summary

This document defines the database layer architecture for LTIP, optimized for **cost efficiency** while handling large text-heavy bill data and traffic spikes during high-profile legislation.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Full-text Search | PostgreSQL tsvector | $0 vs Elasticsearch $30-100/mo |
| Caching | Single Redis + namespacing | vs dual instances, simpler ops |
| Bill Text Storage | Object Storage (S3/R2) + CDN | Offload large text, handle spikes |
| ORM | Prisma | Type-safe, excellent migrations |
| Cost Target | $0-40/month | vs original $90-280/month |

---

## 2. Architecture Overview

```
                                  [CDN - Cloudflare]
                                         |
                                         v
[Next.js Frontend] <---> [Express API] <---> [Redis Cache]
                              |               (cache:* / bull:*)
                              |
                              v
                     [PostgreSQL 16]
                     - Bills, Legislators, Votes
                     - Full-text search (tsvector)
                     - Denormalized counts
                              |
                              v
                     [Object Storage]
                     - S3/R2/MinIO
                     - Bill text versions
                     - GPO PDFs
```

### 2.1 Data Flow Diagram

```
[Congress.gov API]     [OpenStates API]     [LegiScan API]
       |                      |                   |
       v                      v                   v
[Data Ingestion Pipeline (Bull Queue)]
       |
       +---> [PostgreSQL] - Metadata, relationships, search vectors
       |
       +---> [Object Storage] - Full bill text (SHA-256 deduped)
       |
       +---> [Redis Cache] - Hot bills, session data, rate limits
```

### 2.2 Memory and Allocation Strategy

| Component | Memory | Storage | Notes |
|-----------|--------|---------|-------|
| PostgreSQL | 256MB-1GB | 10-50GB | Connection pooling (20 max) |
| Redis | 64-256MB | N/A | LRU eviction, namespaced keys |
| Object Storage | N/A | Pay-per-use | Lifecycle policies for old versions |

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```
[Congress] 1---* [Bill] *---* [Legislator] (via BillSponsor)
                   |
                   +---* [BillTextVersion]
                   +---* [BillAction]
                   +---* [Amendment]
                   +---* [RollCallVote] *---* [Vote] *---1 [Legislator]
                   +---* [CommitteeReferral] *---1 [Committee]
                   +---* [Subject] (via BillSubject)

[Legislator] 1---* [PartyChange]
             1---* [CommitteeMembership] *---1 [Committee]

[Committee] 1---* [Committee] (self-referential for subcommittees)

[User] 1---* [Subscription]
       1---* [ApiKey]
```

### 3.2 Core Enums

```prisma
enum Party {
  D   // Democrat
  R   // Republican
  I   // Independent
  L   // Libertarian
  G   // Green
  O   // Other
}

enum Chamber {
  SENATE
  HOUSE
}

enum BillType {
  HR      // House Bill
  S       // Senate Bill
  HRES    // House Resolution
  SRES    // Senate Resolution
  HJRES   // House Joint Resolution
  SJRES   // Senate Joint Resolution
  HCONRES // House Concurrent Resolution
  SCONRES // Senate Concurrent Resolution
}

enum BillStatus {
  INTRODUCED
  IN_COMMITTEE
  REPORTED_BY_COMMITTEE
  PASSED_HOUSE
  PASSED_SENATE
  RESOLVING_DIFFERENCES
  TO_PRESIDENT
  SIGNED_INTO_LAW
  VETOED
  VETO_OVERRIDDEN
  POCKET_VETOED
  FAILED
  WITHDRAWN
  ENACTED
}

enum VoteType {
  ROLL_CALL
  VOICE
  UNANIMOUS_CONSENT
  DIVISION
}

enum VoteCategory {
  PASSAGE
  AMENDMENT
  PROCEDURAL
  CLOTURE
  NOMINATION
  TREATY
  VETO_OVERRIDE
  MOTION_TO_RECOMMIT
  MOTION_TO_TABLE
  IMPEACHMENT
}

enum VotePosition {
  YEA
  NAY
  NOT_VOTING
  PRESENT
}

enum VoteResult {
  PASSED
  FAILED
  AGREED_TO
  REJECTED
}

enum DataSource {
  CONGRESS_GOV
  OPENSTATES
  LEGISCAN
  GPO
  MANUAL
}

enum DataQuality {
  VERIFIED
  UNVERIFIED
  PARTIAL
  STALE
}

enum TextFormat {
  XML
  HTML
  TXT
  PDF
}

enum EndReason {
  TERM_ENDED
  RESIGNED
  DIED
  EXPELLED
  REMOVED
  APPOINTED_ELSEWHERE
}

enum SubscriptionType {
  BILL
  LEGISLATOR
  SUBJECT
  COMMITTEE
  KEYWORD
}

enum CommitteeType {
  STANDING
  SELECT
  JOINT
  SUBCOMMITTEE
  SPECIAL
}
```

### 3.3 Core Models

#### Congress Model
```prisma
model Congress {
  number          Int       @id
  startDate       DateTime
  endDate         DateTime?
  houseMajority   Party?
  senateMajority  Party?
  bills           Bill[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

#### Legislator Model
```prisma
model Legislator {
  id              String    @id // Bioguide ID (e.g., "A000360")
  firstName       String
  lastName        String
  middleName      String?
  fullName        String
  nickName        String?
  suffix          String?

  // Cross-reference for same person across terms
  personId        String?   // Links same person across different terms

  // Current status
  party           Party
  chamber         Chamber
  state           String    @db.Char(2)
  district        Int?      // Null for senators

  // Special cases
  isVotingMember  Boolean   @default(true) // False for DC, territories
  leadershipRole  String?   // Speaker, Majority Leader, etc.

  // Term info
  termStart       DateTime?
  termEnd         DateTime?
  inOffice        Boolean   @default(true)
  endReason       EndReason?

  // Contact
  website         String?
  phone           String?
  address         String?

  // Social
  twitterHandle   String?
  facebookId      String?
  youtubeId       String?

  // Data provenance
  dataSource      DataSource
  lastSyncedAt    DateTime?

  // Full-text search
  searchVector    Unsupported("tsvector")?

  // Relations
  sponsoredBills  BillSponsor[]
  votes           Vote[]
  partyHistory    PartyChange[]
  committees      CommitteeMembership[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([party])
  @@index([chamber])
  @@index([state])
  @@index([inOffice])
  @@index([personId])
}
```

#### Bill Model
```prisma
model Bill {
  id              String       @id // Format: "hr-1234-118"
  congressNumber  Int
  billType        BillType
  billNumber      Int

  // Titles
  title           String       // Official title
  shortTitle      String?      // Popular/short title

  // Content
  summary         String?      @db.Text

  // Status tracking
  status          BillStatus
  introducedDate  DateTime
  lastActionDate  DateTime?

  // Cross-congress tracking (reintroduced bills)
  previousVersionId String?

  // Policy categorization
  policyAreaId    String?

  // Denormalized counts for performance
  sponsorCount    Int          @default(0)
  cosponsorsD     Int          @default(0)
  cosponsorsR     Int          @default(0)
  cosponsorsI     Int          @default(0)
  voteCountYea    Int          @default(0)
  voteCountNay    Int          @default(0)
  amendmentCount  Int          @default(0)

  // Data provenance
  dataSource      DataSource
  dataQuality     DataQuality  @default(UNVERIFIED)
  lastSyncedAt    DateTime?

  // Full-text search
  searchVector    Unsupported("tsvector")?

  // Relations
  congress        Congress     @relation(fields: [congressNumber], references: [number])
  policyArea      PolicyArea?  @relation(fields: [policyAreaId], references: [id])
  previousVersion Bill?        @relation("BillVersions", fields: [previousVersionId], references: [id])
  laterVersions   Bill[]       @relation("BillVersions")
  sponsors        BillSponsor[]
  textVersions    BillTextVersion[]
  actions         BillAction[]
  amendments      Amendment[]
  rollCallVotes   RollCallVote[]
  referrals       CommitteeReferral[]
  subjects        BillSubject[]
  cboScores       CboScore[]
  subscriptions   Subscription[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([congressNumber, billType, billNumber])
  @@index([status])
  @@index([introducedDate])
  @@index([lastActionDate])
  @@index([policyAreaId])
}
```

#### Vote Models
```prisma
model RollCallVote {
  id              String       @id // Format: "h2024-123" or "s2024-456"
  billId          String?      // Nullable - some votes aren't on bills
  chamber         Chamber
  congressNumber  Int
  session         Int
  rollNumber      Int

  voteType        VoteType
  voteCategory    VoteCategory
  question        String       // What was being voted on
  result          VoteResult

  // Vote counts
  yeas            Int
  nays            Int
  present         Int          @default(0)
  notVoting       Int          @default(0)

  // Edge case: VP tie-breaker
  tieBreakerVp    String?

  voteDate        DateTime

  // Data provenance
  dataSource      DataSource

  // Relations
  bill            Bill?        @relation(fields: [billId], references: [id])
  individualVotes Vote[]

  createdAt       DateTime     @default(now())

  @@unique([chamber, congressNumber, session, rollNumber])
  @@index([billId])
  @@index([voteDate])
  @@index([voteCategory])
}

model Vote {
  id              String       @id @default(cuid())
  rollCallId      String
  legislatorId    String
  position        VotePosition

  // Edge cases
  isProxy         Boolean      @default(false) // COVID-era proxy voting
  pairedWithId    String?      // Traditional vote pairing

  // Relations
  rollCall        RollCallVote @relation(fields: [rollCallId], references: [id])
  legislator      Legislator   @relation(fields: [legislatorId], references: [id])
  pairedWith      Legislator?  @relation("VotePair", fields: [pairedWithId], references: [id])

  @@unique([rollCallId, legislatorId])
  @@index([legislatorId])
  @@index([position])
}
```

#### Supporting Models
```prisma
model BillSponsor {
  id              String     @id @default(cuid())
  billId          String
  legislatorId    String
  isPrimary       Boolean    @default(false)
  cosponsorDate   DateTime?
  withdrawnDate   DateTime?  // Cosponsors can withdraw

  bill            Bill       @relation(fields: [billId], references: [id])
  legislator      Legislator @relation(fields: [legislatorId], references: [id])

  @@unique([billId, legislatorId])
  @@index([legislatorId])
}

model BillTextVersion {
  id              String     @id @default(cuid())
  billId          String
  versionCode     String     // "ih", "rh", "eh", "rs", "es", "enr", etc.
  versionName     String     // "Introduced in House", "Enrolled Bill", etc.

  // Storage
  textUrl         String     // S3/R2 URL
  textHash        String     // SHA-256 for deduplication
  textFormat      TextFormat
  pageCount       Int?
  wordCount       Int?

  publishedDate   DateTime

  bill            Bill       @relation(fields: [billId], references: [id])

  @@unique([billId, versionCode])
  @@index([textHash])
}

model BillAction {
  id              String     @id @default(cuid())
  billId          String
  actionDate      DateTime
  actionCode      String?    // Congress.gov action code
  actionText      String
  chamber         Chamber?

  // Committee action
  committeeId     String?

  bill            Bill       @relation(fields: [billId], references: [id])
  committee       Committee? @relation(fields: [committeeId], references: [id])

  @@index([billId, actionDate])
}

model Amendment {
  id                String     @id // Format: "hamdt-123-118" or "samdt-456-118"
  billId            String
  chamber           Chamber
  congressNumber    Int
  amendmentNumber   Int

  purpose           String?
  description       String?    @db.Text
  status            String

  // 2nd degree amendments
  parentAmendmentId String?

  sponsorId         String?

  // Vote result if voted on
  rollCallVoteId    String?

  offeredDate       DateTime?

  bill              Bill       @relation(fields: [billId], references: [id])
  parentAmendment   Amendment? @relation("AmendmentTree", fields: [parentAmendmentId], references: [id])
  childAmendments   Amendment[] @relation("AmendmentTree")
  sponsor           Legislator? @relation(fields: [sponsorId], references: [id])

  @@unique([chamber, congressNumber, amendmentNumber])
  @@index([billId])
}

model PartyChange {
  id              String     @id @default(cuid())
  legislatorId    String
  fromParty       Party
  toParty         Party
  changeDate      DateTime
  reason          String?

  legislator      Legislator @relation(fields: [legislatorId], references: [id])

  @@index([legislatorId])
  @@index([changeDate])
}

model Committee {
  id              String           @id // Thomas ID (e.g., "HSAG")
  name            String
  chamber         Chamber
  type            CommitteeType

  // Subcommittee hierarchy
  parentId        String?

  jurisdiction    String?          @db.Text

  parent          Committee?       @relation("CommitteeHierarchy", fields: [parentId], references: [id])
  subcommittees   Committee[]      @relation("CommitteeHierarchy")
  members         CommitteeMembership[]
  referrals       CommitteeReferral[]
  actions         BillAction[]
  subscriptions   Subscription[]

  @@index([chamber])
  @@index([parentId])
}

model CommitteeMembership {
  id              String     @id @default(cuid())
  committeeId     String
  legislatorId    String
  role            String?    // Chair, Ranking Member, Member
  startDate       DateTime
  endDate         DateTime?

  committee       Committee  @relation(fields: [committeeId], references: [id])
  legislator      Legislator @relation(fields: [legislatorId], references: [id])

  @@unique([committeeId, legislatorId, startDate])
}

model CommitteeReferral {
  id              String     @id @default(cuid())
  billId          String
  committeeId     String
  referralDate    DateTime
  isPrimary       Boolean    @default(false)

  bill            Bill       @relation(fields: [billId], references: [id])
  committee       Committee  @relation(fields: [committeeId], references: [id])

  @@unique([billId, committeeId])
}

model PolicyArea {
  id              String     @id @default(cuid())
  name            String     @unique
  bills           Bill[]
}

model Subject {
  id              String     @id @default(cuid())
  name            String     @unique

  // Hierarchical taxonomy
  parentId        String?

  parent          Subject?   @relation("SubjectHierarchy", fields: [parentId], references: [id])
  children        Subject[]  @relation("SubjectHierarchy")
  bills           BillSubject[]
  subscriptions   Subscription[]

  @@index([parentId])
}

model BillSubject {
  id              String     @id @default(cuid())
  billId          String
  subjectId       String
  isPrimary       Boolean    @default(false)

  bill            Bill       @relation(fields: [billId], references: [id])
  subject         Subject    @relation(fields: [subjectId], references: [id])

  @@unique([billId, subjectId])
}

model CboScore {
  id              String     @id @default(cuid())
  billId          String
  scoreDate       DateTime
  costEstimate    Decimal?   @db.Decimal(15, 2) // In millions
  deficitImpact   Decimal?   @db.Decimal(15, 2)
  timeframe       String?    // "10 years", "5 years"
  reportUrl       String?

  bill            Bill       @relation(fields: [billId], references: [id])

  @@index([billId])
}
```

#### User and Subscription Models
```prisma
model User {
  id              String     @id @default(cuid())
  email           String     @unique
  passwordHash    String?    // Null for OAuth-only users

  // Rate limiting
  rateLimit       Int        @default(100) // Requests per minute

  subscriptions   Subscription[]
  apiKeys         ApiKey[]

  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model ApiKey {
  id              String     @id @default(cuid())
  userId          String
  keyHash         String     @unique // SHA-256 of actual key
  name            String     // User-friendly name
  lastUsedAt      DateTime?
  expiresAt       DateTime?

  user            User       @relation(fields: [userId], references: [id])

  createdAt       DateTime   @default(now())

  @@index([keyHash])
}

model Subscription {
  id              String           @id @default(cuid())
  userId          String
  type            SubscriptionType

  // Polymorphic foreign keys (only one set)
  billId          String?
  legislatorId    String?
  subjectId       String?
  committeeId     String?
  keyword         String?

  user            User             @relation(fields: [userId], references: [id])
  bill            Bill?            @relation(fields: [billId], references: [id])
  legislator      Legislator?      @relation(fields: [legislatorId], references: [id])
  subject         Subject?         @relation(fields: [subjectId], references: [id])
  committee       Committee?       @relation(fields: [committeeId], references: [id])

  createdAt       DateTime         @default(now())

  @@unique([userId, type, billId, legislatorId, subjectId, committeeId, keyword])
}
```

---

## 4. Full-Text Search Strategy

### 4.1 PostgreSQL tsvector Implementation

```sql
-- Bills search vector trigger
CREATE OR REPLACE FUNCTION bills_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.short_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER bills_search_update
  BEFORE INSERT OR UPDATE OF title, short_title, summary ON bills
  FOR EACH ROW EXECUTE FUNCTION bills_search_vector_trigger();

CREATE INDEX bills_search_idx ON bills USING GIN(search_vector);

-- Legislators search vector trigger
CREATE OR REPLACE FUNCTION legislators_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.first_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.last_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.state, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER legislators_search_update
  BEFORE INSERT OR UPDATE OF full_name, first_name, last_name, state ON legislators
  FOR EACH ROW EXECUTE FUNCTION legislators_search_vector_trigger();

CREATE INDEX legislators_search_idx ON legislators USING GIN(search_vector);
```

### 4.2 Search Query Pattern

```typescript
// Type-safe search with Prisma raw query
async function searchBills(query: string, limit = 20, offset = 0) {
  const sanitizedQuery = query.replace(/[^\w\s]/g, '').trim();
  const tsQuery = sanitizedQuery.split(/\s+/).join(' & ');

  return prisma.$queryRaw`
    SELECT
      id, title, short_title, status, introduced_date,
      ts_rank(search_vector, to_tsquery('english', ${tsQuery})) as rank
    FROM bills
    WHERE search_vector @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC, introduced_date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}
```

---

## 5. Caching Strategy

### 5.1 Redis Key Namespacing

```
cache:bill:{id}              - Bill metadata (TTL: 5min, hot bills: 30min)
cache:bill:{id}:votes        - Vote counts (TTL: 1min during active voting)
cache:legislator:{id}        - Legislator profile (TTL: 1hr)
cache:search:{hash}          - Search results (TTL: 5min)
bull:ingestion:*             - Job queue for data ingestion
bull:notification:*          - Job queue for notifications
session:{id}                 - User sessions (TTL: 24hr)
ratelimit:{ip}               - Rate limit counters (TTL: 1min)
```

### 5.2 Cache-Aside Pattern

```typescript
async function getBill(id: string): Promise<Bill> {
  const cacheKey = `cache:bill:${id}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch from DB
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { sponsors: true, textVersions: true }
  });

  if (!bill) throw new NotFoundError('Bill not found');

  // Adaptive TTL based on activity
  const ttl = isHotBill(bill) ? 1800 : 300; // 30min vs 5min
  await redis.setex(cacheKey, ttl, JSON.stringify(bill));

  return bill;
}

function isHotBill(bill: Bill): boolean {
  const daysSinceAction = daysSince(bill.lastActionDate);
  return daysSinceAction < 7 || bill.status === 'TO_PRESIDENT';
}
```

---

## 6. Denormalization Strategy

### 6.1 Database Triggers for Count Maintenance

```sql
-- Trigger to update sponsor count on bill
CREATE OR REPLACE FUNCTION update_bill_sponsor_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bills SET sponsor_count = sponsor_count + 1 WHERE id = NEW.bill_id;

    -- Update party counts
    UPDATE bills b SET
      cosponsors_d = cosponsors_d + CASE WHEN l.party = 'D' THEN 1 ELSE 0 END,
      cosponsors_r = cosponsors_r + CASE WHEN l.party = 'R' THEN 1 ELSE 0 END,
      cosponsors_i = cosponsors_i + CASE WHEN l.party NOT IN ('D', 'R') THEN 1 ELSE 0 END
    FROM legislators l
    WHERE b.id = NEW.bill_id AND l.id = NEW.legislator_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bills SET sponsor_count = sponsor_count - 1 WHERE id = OLD.bill_id;

    UPDATE bills b SET
      cosponsors_d = cosponsors_d - CASE WHEN l.party = 'D' THEN 1 ELSE 0 END,
      cosponsors_r = cosponsors_r - CASE WHEN l.party = 'R' THEN 1 ELSE 0 END,
      cosponsors_i = cosponsors_i - CASE WHEN l.party NOT IN ('D', 'R') THEN 1 ELSE 0 END
    FROM legislators l
    WHERE b.id = OLD.bill_id AND l.id = OLD.legislator_id;
  END IF;

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER bill_sponsor_count_trigger
  AFTER INSERT OR DELETE ON bill_sponsors
  FOR EACH ROW EXECUTE FUNCTION update_bill_sponsor_count();

-- Trigger to update vote counts
CREATE OR REPLACE FUNCTION update_bill_vote_counts() RETURNS trigger AS $$
BEGIN
  UPDATE bills b SET
    vote_count_yea = (
      SELECT COUNT(*) FROM votes v
      JOIN roll_call_votes rcv ON v.roll_call_id = rcv.id
      WHERE rcv.bill_id = b.id AND v.position = 'YEA'
    ),
    vote_count_nay = (
      SELECT COUNT(*) FROM votes v
      JOIN roll_call_votes rcv ON v.roll_call_id = rcv.id
      WHERE rcv.bill_id = b.id AND v.position = 'NAY'
    )
  WHERE b.id = (SELECT bill_id FROM roll_call_votes WHERE id = NEW.roll_call_id);

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER bill_vote_count_trigger
  AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION update_bill_vote_counts();
```

---

## 7. Implementation Plan

### Task Breakdown (ODIN Methodology)

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable | Dependencies | Risk |
|----|------|--------|---------------------|---------------------|--------------|------|
| T2.1 | Create Prisma schema file | 0.5d | All 25+ models defined with relations | `prisma validate` passes | None | LOW |
| T2.2 | Run initial migration | 0.25d | Tables created in PostgreSQL | `prisma migrate dev` succeeds | T2.1 | LOW |
| T2.3 | Create SQL triggers for search vectors | 0.5d | Full-text search works | Search query returns results | T2.2 | MEDIUM |
| T2.4 | Create SQL triggers for denormalized counts | 0.5d | Counts update automatically | Insert sponsor -> count increments | T2.2 | MEDIUM |
| T2.5 | Configure Redis with namespacing | 0.25d | Redis connects, keys namespaced | `redis-cli keys "cache:*"` works | None | LOW |
| T2.6 | Implement repository layer | 1d | Type-safe CRUD for all entities | Unit tests pass | T2.2 | LOW |
| T2.7 | Create seed data scripts | 0.5d | Sample data loads | 100 bills, 100 legislators seeded | T2.2 | LOW |
| T2.8 | Implement connection pooling | 0.25d | Pool handles concurrent connections | Load test with 50 connections | T2.2 | LOW |
| T2.9 | Add database health checks | 0.25d | Health endpoint reports DB status | `/health` returns DB metrics | T2.2 | LOW |

**Total: 4 days**

### Risk Assessment

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| tsvector performance on large datasets | MEDIUM | MEDIUM | 9 | Partial indexes, BRIN indexes for date ranges |
| Redis memory exhaustion | LOW | HIGH | 8 | maxmemory policy, key expiration, monitoring |
| Migration conflicts | LOW | MEDIUM | 6 | Version control migrations, test in staging |
| Trigger complexity | MEDIUM | LOW | 6 | Thorough testing, EXPLAIN ANALYZE |

---

## 8. Testing Strategy

### 8.1 Unit Tests
- Repository CRUD operations
- Search vector generation
- Cache key generation

### 8.2 Integration Tests
- End-to-end data flow: API -> Repository -> Prisma -> PostgreSQL
- Full-text search accuracy
- Cache invalidation

### 8.3 Performance Tests
- Search query <500ms with 100k bills
- Concurrent connection handling (50+)
- Cache hit ratio >80% under load

---

## 9. Monitoring

### 9.1 Key Metrics
- Query latency (p50, p95, p99)
- Cache hit/miss ratio
- Connection pool utilization
- Slow query log (>100ms)

### 9.2 Alerts
- Connection pool exhaustion (>90% utilized)
- Cache miss rate >50%
- Query latency p99 >1s

---

## 10. Appendix

### A. Bill Version Codes

| Code | Name | Description |
|------|------|-------------|
| ih | Introduced in House | Original introduction |
| is | Introduced in Senate | Original introduction |
| rh | Reported in House | Committee report |
| rs | Reported in Senate | Committee report |
| eh | Engrossed in House | Passed chamber |
| es | Engrossed in Senate | Passed chamber |
| enr | Enrolled Bill | Final version sent to President |

### B. Congress.gov Action Codes

| Code | Description |
|------|-------------|
| 1000 | Introduced |
| 2000 | Referred to Committee |
| 5000 | Reported by Committee |
| 8000 | Passed/Agreed to in House |
| 17000 | Passed/Agreed to in Senate |
| 28000 | Presented to President |
| 36000 | Signed by President |

---

**Document Status**: APPROVED
**Next Step**: Implementation
