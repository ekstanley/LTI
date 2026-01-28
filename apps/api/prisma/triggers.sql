-- LTIP Database Triggers
-- Run this SQL after initial Prisma migration
-- These triggers maintain full-text search vectors and denormalized counts

-- ============================================================================
-- FULL-TEXT SEARCH TRIGGERS
-- ============================================================================

-- Bills search vector trigger
-- Weights: A (highest) = title/short_title, B = summary
CREATE OR REPLACE FUNCTION bills_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.short_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bills_search_update ON bills;
CREATE TRIGGER bills_search_update
  BEFORE INSERT OR UPDATE OF title, short_title, summary ON bills
  FOR EACH ROW EXECUTE FUNCTION bills_search_vector_trigger();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS bills_search_idx ON bills USING GIN(search_vector);

-- Legislators search vector trigger
-- Weights: A = full_name, B = first/last name, C = state
CREATE OR REPLACE FUNCTION legislators_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.first_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.last_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.state, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legislators_search_update ON legislators;
CREATE TRIGGER legislators_search_update
  BEFORE INSERT OR UPDATE OF full_name, first_name, last_name, state ON legislators
  FOR EACH ROW EXECUTE FUNCTION legislators_search_vector_trigger();

-- Create GIN index for legislators search
CREATE INDEX IF NOT EXISTS legislators_search_idx ON legislators USING GIN(search_vector);

-- ============================================================================
-- DENORMALIZATION TRIGGERS
-- ============================================================================

-- Update sponsor count when sponsors are added/removed
CREATE OR REPLACE FUNCTION update_bill_sponsor_count() RETURNS trigger AS $$
DECLARE
  leg_party "Party";
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the party of the legislator
    SELECT party INTO leg_party FROM legislators WHERE id = NEW.legislator_id;

    -- Update counts
    UPDATE bills SET
      sponsor_count = sponsor_count + 1,
      cosponsors_d = cosponsors_d + CASE WHEN leg_party = 'D' THEN 1 ELSE 0 END,
      cosponsors_r = cosponsors_r + CASE WHEN leg_party = 'R' THEN 1 ELSE 0 END,
      cosponsors_i = cosponsors_i + CASE WHEN leg_party NOT IN ('D', 'R') THEN 1 ELSE 0 END
    WHERE id = NEW.bill_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Get the party of the legislator
    SELECT party INTO leg_party FROM legislators WHERE id = OLD.legislator_id;

    -- Update counts
    UPDATE bills SET
      sponsor_count = GREATEST(0, sponsor_count - 1),
      cosponsors_d = GREATEST(0, cosponsors_d - CASE WHEN leg_party = 'D' THEN 1 ELSE 0 END),
      cosponsors_r = GREATEST(0, cosponsors_r - CASE WHEN leg_party = 'R' THEN 1 ELSE 0 END),
      cosponsors_i = GREATEST(0, cosponsors_i - CASE WHEN leg_party NOT IN ('D', 'R') THEN 1 ELSE 0 END)
    WHERE id = OLD.bill_id;
  END IF;

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_sponsor_count_trigger ON bill_sponsors;
CREATE TRIGGER bill_sponsor_count_trigger
  AFTER INSERT OR DELETE ON bill_sponsors
  FOR EACH ROW EXECUTE FUNCTION update_bill_sponsor_count();

-- Update vote counts when roll call votes are tallied
CREATE OR REPLACE FUNCTION update_bill_vote_counts() RETURNS trigger AS $$
DECLARE
  rcv_bill_id TEXT;
BEGIN
  -- Get the bill ID from the roll call vote
  SELECT bill_id INTO rcv_bill_id
  FROM roll_call_votes
  WHERE id = NEW.roll_call_id;

  -- Only update if this vote is associated with a bill
  IF rcv_bill_id IS NOT NULL THEN
    UPDATE bills SET
      vote_count_yea = (
        SELECT COUNT(*) FROM votes v
        JOIN roll_call_votes rcv ON v.roll_call_id = rcv.id
        WHERE rcv.bill_id = rcv_bill_id AND v.position = 'YEA'
      ),
      vote_count_nay = (
        SELECT COUNT(*) FROM votes v
        JOIN roll_call_votes rcv ON v.roll_call_id = rcv.id
        WHERE rcv.bill_id = rcv_bill_id AND v.position = 'NAY'
      )
    WHERE id = rcv_bill_id;
  END IF;

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_vote_count_trigger ON votes;
CREATE TRIGGER bill_vote_count_trigger
  AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION update_bill_vote_counts();

-- Update amendment count when amendments are added/removed
CREATE OR REPLACE FUNCTION update_bill_amendment_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bills SET amendment_count = amendment_count + 1 WHERE id = NEW.bill_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bills SET amendment_count = GREATEST(0, amendment_count - 1) WHERE id = OLD.bill_id;
  END IF;

  RETURN NULL;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bill_amendment_count_trigger ON amendments;
CREATE TRIGGER bill_amendment_count_trigger
  AFTER INSERT OR DELETE ON amendments
  FOR EACH ROW EXECUTE FUNCTION update_bill_amendment_count();

-- ============================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Partial index for active bills (commonly queried)
CREATE INDEX IF NOT EXISTS bills_active_idx ON bills (last_action_date DESC)
  WHERE status NOT IN ('SIGNED_INTO_LAW', 'VETOED', 'FAILED', 'WITHDRAWN', 'ENACTED');

-- Partial index for legislators currently in office
CREATE INDEX IF NOT EXISTS legislators_in_office_idx ON legislators (chamber, state)
  WHERE in_office = true;

-- BRIN index for time-series queries on actions
CREATE INDEX IF NOT EXISTS bill_actions_date_brin_idx ON bill_actions
  USING BRIN (action_date) WITH (pages_per_range = 128);

-- Composite index for common vote queries
CREATE INDEX IF NOT EXISTS votes_legislator_position_idx ON votes (legislator_id, position);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to search bills with ranking
CREATE OR REPLACE FUNCTION search_bills(
  query_text TEXT,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
) RETURNS TABLE (
  id TEXT,
  title TEXT,
  short_title TEXT,
  status "BillStatus",
  introduced_date TIMESTAMP,
  rank REAL
) AS $$
DECLARE
  ts_query tsquery;
BEGIN
  -- Convert input to tsquery, handling multiple words
  ts_query := plainto_tsquery('english', query_text);

  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.short_title,
    b.status,
    b.introduced_date,
    ts_rank(b.search_vector, ts_query) as rank
  FROM bills b
  WHERE b.search_vector @@ ts_query
  ORDER BY rank DESC, b.introduced_date DESC
  LIMIT limit_count
  OFFSET offset_count;
END
$$ LANGUAGE plpgsql STABLE;

-- Function to search legislators with ranking
CREATE OR REPLACE FUNCTION search_legislators(
  query_text TEXT,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
) RETURNS TABLE (
  id TEXT,
  full_name TEXT,
  party "Party",
  chamber "Chamber",
  state CHAR(2),
  rank REAL
) AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', query_text);

  RETURN QUERY
  SELECT
    l.id,
    l.full_name,
    l.party,
    l.chamber,
    l.state,
    ts_rank(l.search_vector, ts_query) as rank
  FROM legislators l
  WHERE l.search_vector @@ ts_query
  ORDER BY rank DESC, l.in_office DESC
  LIMIT limit_count
  OFFSET offset_count;
END
$$ LANGUAGE plpgsql STABLE;
