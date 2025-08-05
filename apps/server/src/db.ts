import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, Theme, ThemeSearchQuery, UsageConfig, UsageSnapshot } from './types';
import { MigrationRunner } from './migrations';

let db: Database;
let migrationRunner: MigrationRunner;

export function initDatabase(): void {
  db = new Database('events.db');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');  // Enable foreign key constraints
  
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
  
  // Check if chat column exists, add it if not (for migration)
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasChatColumn = columns.some((col: any) => col.name === 'chat');
    if (!hasChatColumn) {
      db.exec('ALTER TABLE events ADD COLUMN chat TEXT');
    }
    
    // Check if summary column exists, add it if not (for migration)
    const hasSummaryColumn = columns.some((col: any) => col.name === 'summary');
    if (!hasSummaryColumn) {
      db.exec('ALTER TABLE events ADD COLUMN summary TEXT');
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }
  
  // Create indexes for common queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)');
  
  // Create themes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      description TEXT,
      colors TEXT NOT NULL,
      isPublic INTEGER NOT NULL DEFAULT 0,
      authorId TEXT,
      authorName TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      tags TEXT,
      downloadCount INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      ratingCount INTEGER DEFAULT 0
    )
  `);
  
  // Create theme shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_shares (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      shareToken TEXT NOT NULL UNIQUE,
      expiresAt INTEGER,
      isPublic INTEGER NOT NULL DEFAULT 0,
      allowedUsers TEXT,
      createdAt INTEGER NOT NULL,
      accessCount INTEGER DEFAULT 0,
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create theme ratings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_ratings (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt INTEGER NOT NULL,
      UNIQUE(themeId, userId),
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for theme tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_isPublic ON themes(isPublic)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_createdAt ON themes(createdAt)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_shares_token ON theme_shares(shareToken)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_ratings_theme ON theme_ratings(themeId)');

  // Initialize and run migrations
  migrationRunner = new MigrationRunner(db);
  migrationRunner.migrate().catch(error => {
    console.error('❌ Migration failed:', error);
    throw error;
  });
}

export function insertEvent(event: HookEvent): HookEvent {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const timestamp = event.timestamp || Date.now();
  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp
  );
  
  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp
  };
}

export function getFilterOptions(): FilterOptions {
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM events ORDER BY source_app').all() as { source_app: string }[];
  const sessionIds = db.prepare('SELECT DISTINCT session_id FROM events ORDER BY session_id DESC LIMIT 100').all() as { session_id: string }[];
  const hookEventTypes = db.prepare('SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type').all() as { hook_event_type: string }[];
  
  return {
    source_apps: sourceApps.map(row => row.source_app),
    session_ids: sessionIds.map(row => row.session_id),
    hook_event_types: hookEventTypes.map(row => row.hook_event_type)
  };
}

export function getRecentEvents(limit: number = 100): HookEvent[] {
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(limit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp
  })).reverse();
}

// Theme database functions
export function insertTheme(theme: Theme): Theme {
  const stmt = db.prepare(`
    INSERT INTO themes (id, name, displayName, description, colors, isPublic, authorId, authorName, createdAt, updatedAt, tags, downloadCount, rating, ratingCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    theme.id,
    theme.name,
    theme.displayName,
    theme.description || null,
    JSON.stringify(theme.colors),
    theme.isPublic ? 1 : 0,
    theme.authorId || null,
    theme.authorName || null,
    theme.createdAt,
    theme.updatedAt,
    JSON.stringify(theme.tags),
    theme.downloadCount || 0,
    theme.rating || 0,
    theme.ratingCount || 0
  );
  
  return theme;
}

export function updateTheme(id: string, updates: Partial<Theme>): boolean {
  const allowedFields = ['displayName', 'description', 'colors', 'isPublic', 'updatedAt', 'tags'];
  const setClause = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => `${key} = ?`)
    .join(', ');
  
  if (!setClause) return false;
  
  const values = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => {
      if (key === 'colors' || key === 'tags') {
        return JSON.stringify(updates[key as keyof Theme]);
      }
      if (key === 'isPublic') {
        return updates[key as keyof Theme] ? 1 : 0;
      }
      return updates[key as keyof Theme];
    });
  
  const stmt = db.prepare(`UPDATE themes SET ${setClause} WHERE id = ?`);
  const result = stmt.run(...values, id);
  
  return result.changes > 0;
}

export function getTheme(id: string): Theme | null {
  const stmt = db.prepare('SELECT * FROM themes WHERE id = ?');
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  };
}

export function getThemes(query: ThemeSearchQuery = {}): Theme[] {
  let sql = 'SELECT * FROM themes WHERE 1=1';
  const params: any[] = [];
  
  if (query.isPublic !== undefined) {
    sql += ' AND isPublic = ?';
    params.push(query.isPublic ? 1 : 0);
  }
  
  if (query.authorId) {
    sql += ' AND authorId = ?';
    params.push(query.authorId);
  }
  
  if (query.query) {
    sql += ' AND (name LIKE ? OR displayName LIKE ? OR description LIKE ?)';
    const searchTerm = `%${query.query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  // Add sorting
  const sortBy = query.sortBy || 'created';
  const sortOrder = query.sortOrder || 'desc';
  const sortColumn = {
    name: 'name',
    created: 'createdAt',
    updated: 'updatedAt',
    downloads: 'downloadCount',
    rating: 'rating'
  }[sortBy] || 'createdAt';
  
  sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
  
  // Add pagination
  if (query.limit) {
    sql += ' LIMIT ?';
    params.push(query.limit);
    
    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }
  }
  
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  }));
}

export function deleteTheme(id: string): boolean {
  const stmt = db.prepare('DELETE FROM themes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function incrementThemeDownloadCount(id: string): boolean {
  const stmt = db.prepare('UPDATE themes SET downloadCount = downloadCount + 1 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Usage configuration functions
export function getUsageConfig(): UsageConfig | null {
  try {
    const stmt = db.prepare('SELECT * FROM usage_config WHERE is_active = 1 LIMIT 1');
    const row = stmt.get() as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      plan: row.plan,
      custom_limit_tokens: row.custom_limit_tokens,
      view: row.view,
      timezone: row.timezone,
      time_format: row.time_format,
      theme: row.theme,
      refresh_rate: row.refresh_rate,
      refresh_per_second: row.refresh_per_second,
      reset_hour: row.reset_hour,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    console.error('Error getting usage config:', error);
    return null;
  }
}

export function updateUsageConfig(updates: Partial<UsageConfig>): boolean {
  try {
    const allowedFields = [
      'plan', 'custom_limit_tokens', 'view', 'timezone', 'time_format', 
      'theme', 'refresh_rate', 'refresh_per_second', 'reset_hour'
    ];
    
    const setFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key) && updates[key as keyof UsageConfig] !== undefined)
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (!setFields) return false;
    
    const values = Object.keys(updates)
      .filter(key => allowedFields.includes(key) && updates[key as keyof UsageConfig] !== undefined)
      .map(key => updates[key as keyof UsageConfig]);
    
    // Always update the timestamp
    const sql = `UPDATE usage_config SET ${setFields}, updated_at = unixepoch() WHERE is_active = 1`;
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating usage config:', error);
    return false;
  }
}

export function resetUsageConfig(): boolean {
  try {
    const stmt = db.prepare(`
      UPDATE usage_config 
      SET plan = 'custom', 
          view = 'realtime', 
          timezone = 'auto', 
          time_format = 'auto', 
          theme = 'auto', 
          refresh_rate = 10, 
          refresh_per_second = 0.75, 
          reset_hour = NULL,
          custom_limit_tokens = NULL,
          updated_at = unixepoch()
      WHERE is_active = 1
    `);
    const result = stmt.run();
    return result.changes > 0;
  } catch (error) {
    console.error('Error resetting usage config:', error);
    return false;
  }
}

// Usage snapshot functions
export function insertUsageSnapshot(snapshot: Omit<UsageSnapshot, 'id'>): UsageSnapshot | null {
  try {
    const stmt = db.prepare(`
      INSERT INTO usage_snapshots (session_id, snapshot_data, snapshot_type, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    
    const timestamp = snapshot.timestamp || Date.now();
    const result = stmt.run(
      snapshot.session_id,
      snapshot.snapshot_data,
      snapshot.snapshot_type,
      timestamp
    );
    
    return {
      id: result.lastInsertRowid as number,
      ...snapshot,
      timestamp
    };
  } catch (error) {
    console.error('Error inserting usage snapshot:', error);
    return null;
  }
}

export function getUsageSnapshots(
  sessionId?: string, 
  limit: number = 100, 
  hoursBack: number = 24
): UsageSnapshot[] {
  try {
    let sql = `
      SELECT id, session_id, snapshot_data, snapshot_type, timestamp
      FROM usage_snapshots
      WHERE timestamp >= ?
    `;
    const params: any[] = [Date.now() - (hoursBack * 60 * 60 * 1000)];
    
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      session_id: row.session_id,
      snapshot_data: row.snapshot_data,
      snapshot_type: row.snapshot_type,
      timestamp: row.timestamp
    }));
  } catch (error) {
    console.error('Error getting usage snapshots:', error);
    return [];
  }
}

export function getUsageSnapshotsBySession(sessionId: string): UsageSnapshot[] {
  try {
    const stmt = db.prepare(`
      SELECT id, session_id, snapshot_data, snapshot_type, timestamp
      FROM usage_snapshots
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all(sessionId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      session_id: row.session_id,
      snapshot_data: row.snapshot_data,
      snapshot_type: row.snapshot_type,
      timestamp: row.timestamp
    }));
  } catch (error) {
    console.error('Error getting usage snapshots by session:', error);
    return [];
  }
}

export function deleteOldUsageSnapshots(daysOld: number = 30): number {
  try {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const stmt = db.prepare('DELETE FROM usage_snapshots WHERE timestamp < ?');
    const result = stmt.run(cutoffTime);
    return result.changes;
  } catch (error) {
    console.error('Error deleting old usage snapshots:', error);
    return 0;
  }
}

// Migration management functions
export function getMigrationRunner(): MigrationRunner {
  return migrationRunner;
}

export function getMigrationStatus() {
  return migrationRunner ? migrationRunner.getStatus() : null;
}

export async function runMigrations(): Promise<void> {
  if (migrationRunner) {
    await migrationRunner.migrate();
  }
}

export async function rollbackMigrations(targetVersion?: number): Promise<void> {
  if (migrationRunner) {
    await migrationRunner.rollback(targetVersion);
  }
}

export function validateDatabase(): boolean {
  return migrationRunner ? migrationRunner.validateDatabase() : false;
}