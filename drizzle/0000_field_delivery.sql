CREATE TABLE field_readers (
  reader TEXT PRIMARY KEY NOT NULL,
  expires INTEGER NOT NULL,
  qa INTEGER NOT NULL CHECK (qa IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX field_readers_expiry ON field_readers(expires);
--> statement-breakpoint
CREATE TABLE field_sessions (
  reader TEXT NOT NULL REFERENCES field_readers(reader) ON DELETE CASCADE,
  started INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  day_et TEXT NOT NULL,
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  creative TEXT NOT NULL,
  html_at INTEGER,
  pdf_at INTEGER,
  community_at INTEGER,
  PRIMARY KEY (reader, started)
);
--> statement-breakpoint
CREATE INDEX field_sessions_day ON field_sessions(day_et, source, medium);
--> statement-breakpoint
CREATE TABLE field_private_daily (
  day_et TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('landing', 'html', 'pdf')),
  responses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_et, surface)
);
