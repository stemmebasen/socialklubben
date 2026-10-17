-- The scanner finds events the portal does not have yet: on organizers' websites (schema.org event data
-- and calendar links) and from visitors' tips. Nothing it finds is shown until the administration has
-- approved it (docs/decisions/0005-scanner.md).

-- An organizer with no calendar address: its events come from approved finds, one by one.
ALTER TABLE sources ADD COLUMN kind TEXT NOT NULL DEFAULT 'feed' CHECK (kind IN ('feed', 'manual'));

-- A web page the scanner reads once a week.
CREATE TABLE scan_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL DEFAULT 'ostjylland',
  url TEXT NOT NULL UNIQUE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  -- A calendar address found on the page; it can become an organizer whose calendar is read every hour.
  feed_url TEXT,
  -- Set once the site's calendar is an organizer: from then on the calendar is the truth, not the page.
  source_id INTEGER REFERENCES sources(id),
  last_scan_at_ms INTEGER,
  last_scan_ok INTEGER CHECK (last_scan_ok IS NULL OR last_scan_ok IN (0, 1)),
  last_scan_message TEXT,
  created_at_ms INTEGER NOT NULL
) STRICT;

-- One event found by the scanner or tipped by a visitor, waiting for the administration.
CREATE TABLE candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL DEFAULT 'ostjylland',
  origin TEXT NOT NULL CHECK (origin IN ('scan', 'tip')),
  site_id INTEGER REFERENCES scan_sites(id),
  -- The same find is only ever queued once, however often the page is read.
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  starts_at_ms INTEGER NOT NULL,
  ends_at_ms INTEGER,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  location TEXT,
  description TEXT,
  link TEXT,
  image_url TEXT,
  organizer TEXT,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  -- A tipper's e-mail, for questions only. Never shown on the site.
  contact TEXT,
  -- An event already shown that looks like the same one.
  duplicate_of INTEGER,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'rejected')),
  event_id INTEGER,
  created_at_ms INTEGER NOT NULL,
  decided_at_ms INTEGER
) STRICT;

CREATE INDEX idx_candidates_status ON candidates(status, starts_at_ms);
