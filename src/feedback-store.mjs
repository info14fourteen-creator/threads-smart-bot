import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class FeedbackStore {
  constructor(path = "data/feedback.sqlite") {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        event_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        parent_id TEXT,
        username TEXT,
        language TEXT,
        text TEXT NOT NULL,
        created_at TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_type, source_id)
      );
      CREATE INDEX IF NOT EXISTS events_type_created_idx ON events(event_type, created_at);
      CREATE INDEX IF NOT EXISTS events_username_idx ON events(username);
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY,
        event_id INTEGER NOT NULL,
        captured_at TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        UNIQUE(event_id, captured_at),
        FOREIGN KEY(event_id) REFERENCES events(id)
      );
      CREATE TABLE IF NOT EXISTS profile_proposals (
        id INTEGER PRIMARY KEY,
        created_at TEXT NOT NULL,
        source_window TEXT NOT NULL,
        proposal_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'proposed'
      );
    `);
  }

  recordEvent({ eventType, sourceId, parentId = null, username = null, language = "unknown", text, createdAt = null, isBot = false, metadata = {} }) {
    if (!eventType || !sourceId || !text) return null;
    const result = this.db.prepare(`
      INSERT INTO events (event_type, source_id, parent_id, username, language, text, created_at, is_bot, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_type, source_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        username = excluded.username,
        language = excluded.language,
        text = excluded.text,
        created_at = excluded.created_at,
        is_bot = excluded.is_bot,
        metadata_json = excluded.metadata_json,
        last_seen_at = CURRENT_TIMESTAMP
    `).run(eventType, sourceId, parentId, username, language, text, createdAt, isBot ? 1 : 0, JSON.stringify(metadata));
    if (result.lastInsertRowid) return Number(result.lastInsertRowid);
    return this.db.prepare("SELECT id FROM events WHERE event_type = ? AND source_id = ?").get(eventType, sourceId)?.id || null;
  }

  recordMetric({ eventId, capturedAt = new Date().toISOString(), metrics = {} }) {
    if (!eventId) return;
    this.db.prepare(`
      INSERT OR REPLACE INTO metrics (event_id, captured_at, metrics_json)
      VALUES (?, ?, ?)
    `).run(eventId, capturedAt, JSON.stringify(metrics));
  }

  saveProfileProposal({ sourceWindow, proposal, createdAt = new Date().toISOString(), status = "proposed" }) {
    this.db.prepare(`
      INSERT INTO profile_proposals (created_at, source_window, proposal_json, status)
      VALUES (?, ?, ?, ?)
    `).run(createdAt, sourceWindow, JSON.stringify(proposal), status);
  }

  summary() {
    const events = this.db.prepare("SELECT event_type, language, COUNT(*) AS count FROM events GROUP BY event_type, language ORDER BY event_type, language").all();
    const proposals = this.db.prepare("SELECT status, COUNT(*) AS count FROM profile_proposals GROUP BY status ORDER BY status").all();
    return { events, proposals };
  }

  learningExamples({ limit = 100 } = {}) {
    return this.db.prepare(`
      SELECT event_type, source_id, parent_id, username, language, text, created_at, metadata_json
      FROM events
      WHERE event_type IN ('manual_post', 'manual_reply', 'bot_reply')
      ORDER BY COALESCE(created_at, first_seen_at) DESC
      LIMIT ?
    `).all(Math.max(1, Math.min(1000, limit))).map((row) => ({
      ...row,
      metadata: JSON.parse(row.metadata_json || "{}"),
    }));
  }

  close() {
    this.db.close();
  }
}
