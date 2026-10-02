-- The portal shows what is going on within spirituality, personal development and mental health in one
-- region at a time (first: Østjylland). It belongs to no organizer: every source is an organizer's own
-- public calendar, read as it is, and every organizer is shown on equal terms (docs/BLUEPRINT.md).

CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL DEFAULT 'ostjylland',
  name TEXT NOT NULL,
  website TEXT,
  -- An iCal (.ics) or RSS address.
  feed_url TEXT NOT NULL,
  -- Where the organizer's events take place when an event names no address of its own.
  default_address TEXT,
  default_topic TEXT NOT NULL,
  -- Optional filters for an organizer whose calendar holds more than the portal's themes: an event is
  -- shown only if its text holds one of the include words, and never if it holds an exclude word.
  include_words TEXT,
  exclude_words TEXT,
  -- Reserved for a possible later benefit text (e.g. a member discount). Not shown.
  benefit TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  contact_email TEXT,
  note TEXT,
  last_sync_at_ms INTEGER,
  last_sync_ok INTEGER CHECK (last_sync_ok IS NULL OR last_sync_ok IN (0, 1)),
  last_sync_message TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;

-- One row per place, found once from its address and reused by every event there.
CREATE TABLE venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address_key TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  lat REAL,
  lng REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'found', 'not_found', 'manual')),
  attempts INTEGER NOT NULL DEFAULT 0,
  geocoded_at_ms INTEGER,
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180))
) STRICT;

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  source_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at_ms INTEGER NOT NULL,
  ends_at_ms INTEGER,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  online INTEGER NOT NULL DEFAULT 0 CHECK (online IN (0, 1)),
  location TEXT,
  venue_id INTEGER REFERENCES venues(id),
  description TEXT,
  link TEXT,
  image_url TEXT,
  topic TEXT NOT NULL,
  -- The organizer's price when the event text states it plainly; NULL when unknown.
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  content_hash TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  removed_at_ms INTEGER,
  first_seen_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (source_id, source_uid)
) STRICT;

CREATE INDEX idx_events_starts ON events(starts_at_ms);

-- Clicks on to the organizer, per Copenhagen day, without anything about who clicked.
CREATE TABLE clicks (
  day TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  event_id INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source_id, event_id)
) STRICT;

-- One run of a scheduled job per slot, however many Workers wake up.
CREATE TABLE job_claims (
  job_key TEXT NOT NULL,
  slot INTEGER NOT NULL,
  claimed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (job_key, slot)
) STRICT;

CREATE TABLE login_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  at_ms INTEGER NOT NULL
) STRICT;
