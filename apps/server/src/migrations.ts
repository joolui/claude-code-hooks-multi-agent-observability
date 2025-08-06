import { Database } from 'bun:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
}

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: number;
}

/**
 * Migration system for database schema changes with rollback capability.
 * Provides version tracking, transaction safety, and systematic schema evolution.
 */
export class MigrationRunner {
  private db: Database;
  private migrations: Migration[] = [];

  constructor(db: Database) {
    this.db = db;
    this.initializeMigrationTable();
    this.registerMigrations();
  }

  /**
   * Initialize the schema_migrations table for tracking applied migrations.
   */
  private initializeMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);
    
    // Create index for performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at)');
  }

  /**
   * Register all available migrations in order.
   */
  private registerMigrations(): void {
    // Migration 001: Add usage tracking tables
    this.migrations.push({
      version: 1,
      name: 'add_usage_tracking_tables',
      up: (db: Database) => {
        // Create usage_config table
        db.exec(`
          CREATE TABLE IF NOT EXISTS usage_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan TEXT NOT NULL DEFAULT 'custom' CHECK (plan IN ('pro', 'max5', 'max20', 'custom')),
            custom_limit_tokens INTEGER CHECK (custom_limit_tokens IS NULL OR custom_limit_tokens > 0),
            view TEXT NOT NULL DEFAULT 'realtime' CHECK (view IN ('realtime', 'daily', 'monthly', 'session')),
            timezone TEXT NOT NULL DEFAULT 'auto',
            time_format TEXT NOT NULL DEFAULT 'auto' CHECK (time_format IN ('12h', '24h', 'auto')),
            theme TEXT NOT NULL DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'classic', 'auto')),
            refresh_rate INTEGER NOT NULL DEFAULT 10 CHECK (refresh_rate >= 1 AND refresh_rate <= 60),
            refresh_per_second REAL NOT NULL DEFAULT 0.75 CHECK (refresh_per_second >= 0.1 AND refresh_per_second <= 20.0),
            reset_hour INTEGER CHECK (reset_hour IS NULL OR (reset_hour >= 0 AND reset_hour <= 23)),
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
          )
        `);

        // Create unique constraint to ensure only one active config
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_config_active ON usage_config(is_active) WHERE is_active = 1');
        
        // Create usage_snapshots table
        db.exec(`
          CREATE TABLE IF NOT EXISTS usage_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            snapshot_data TEXT NOT NULL,
            snapshot_type TEXT NOT NULL DEFAULT 'stats' CHECK (snapshot_type IN ('stats', 'config', 'session')),
            timestamp INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `);

        // Create indexes for usage_snapshots
        db.exec('CREATE INDEX IF NOT EXISTS idx_usage_snapshots_session_id ON usage_snapshots(session_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_usage_snapshots_timestamp ON usage_snapshots(timestamp)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_usage_snapshots_type ON usage_snapshots(snapshot_type)');
        
        // Insert default configuration
        db.exec(`
          INSERT INTO usage_config (
            plan, view, timezone, time_format, theme, refresh_rate, refresh_per_second, is_active
          ) VALUES (
            'custom', 'realtime', 'auto', 'auto', 'auto', 10, 0.75, 1
          )
        `);
      },
      down: (db: Database) => {
        // Drop tables in reverse order (considering foreign keys)
        db.exec('DROP TABLE IF EXISTS usage_snapshots');
        db.exec('DROP TABLE IF EXISTS usage_config');
      }
    });

    // Future migrations can be added here
    // this.migrations.push({
    //   version: 2,
    //   name: 'add_user_preferences',
    //   up: (db: Database) => { ... },
    //   down: (db: Database) => { ... }
    // });
  }

  /**
   * Get the current database schema version.
   */
  public getCurrentVersion(): number {
    try {
      const result = this.db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
      return result.version || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get all applied migrations.
   */
  public getAppliedMigrations(): MigrationRecord[] {
    try {
      return this.db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all() as MigrationRecord[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get pending migrations that need to be applied.
   */
  public getPendingMigrations(): Migration[] {
    const currentVersion = this.getCurrentVersion();
    return this.migrations.filter(migration => migration.version > currentVersion);
  }

  /**
   * Apply a single migration with transaction safety.
   */
  private applyMigration(migration: Migration): void {
    const transaction = this.db.transaction(() => {
      try {
        // Apply the migration
        migration.up(this.db);
        
        // Record the migration
        this.db.prepare(`
          INSERT INTO schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(migration.version, migration.name, Date.now());
        
        console.log(`✅ Applied migration ${migration.version}: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${migration.version}: ${migration.name}`, error);
        throw error;
      }
    });
    
    transaction();
  }

  /**
   * Rollback a single migration with transaction safety.
   */
  private rollbackMigration(migration: Migration): void {
    const transaction = this.db.transaction(() => {
      try {
        // Apply the rollback
        migration.down(this.db);
        
        // Remove the migration record
        this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
        
        console.log(`⏪ Rolled back migration ${migration.version}: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed to rollback migration ${migration.version}: ${migration.name}`, error);
        throw error;
      }
    });
    
    transaction();
  }

  /**
   * Run all pending migrations.
   */
  public async migrate(): Promise<void> {
    const pendingMigrations = this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('✅ Database is up to date. No migrations needed.');
      return;
    }

    console.log(`🔄 Applying ${pendingMigrations.length} pending migration(s)...`);
    
    for (const migration of pendingMigrations) {
      this.applyMigration(migration);
    }
    
    console.log(`🎉 Successfully applied ${pendingMigrations.length} migration(s)`);
  }

  /**
   * Rollback to a specific version.
   */
  public async rollback(targetVersion?: number): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    const rollbackToVersion = targetVersion !== undefined ? targetVersion : currentVersion - 1;
    
    if (rollbackToVersion >= currentVersion) {
      console.log('❌ Target version must be lower than current version');
      return;
    }
    
    if (rollbackToVersion < 0) {
      console.log('❌ Cannot rollback to negative version');
      return;
    }

    // Find migrations to rollback (in reverse order)
    const migrationsToRollback = this.migrations
      .filter(migration => migration.version > rollbackToVersion && migration.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback

    if (migrationsToRollback.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    console.log(`🔄 Rolling back ${migrationsToRollback.length} migration(s) to version ${rollbackToVersion}...`);
    
    for (const migration of migrationsToRollback) {
      this.rollbackMigration(migration);
    }
    
    console.log(`🎉 Successfully rolled back to version ${rollbackToVersion}`);
  }

  /**
   * Get migration status information.
   */
  public getStatus(): {
    currentVersion: number;
    latestVersion: number;
    pendingCount: number;
    appliedMigrations: MigrationRecord[];
    pendingMigrations: Migration[];
  } {
    const currentVersion = this.getCurrentVersion();
    const latestVersion = Math.max(...this.migrations.map(m => m.version), 0);
    const appliedMigrations = this.getAppliedMigrations();
    const pendingMigrations = this.getPendingMigrations();

    return {
      currentVersion,
      latestVersion,
      pendingCount: pendingMigrations.length,
      appliedMigrations,
      pendingMigrations
    };
  }

  /**
   * Validate database integrity after migrations.
   */
  public validateDatabase(): boolean {
    try {
      // Check that all expected tables exist
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];
      
      const tableNames = tables.map(t => t.name);
      
      // Check for required tables
      const requiredTables = ['events', 'schema_migrations', 'themes', 'theme_shares', 'theme_ratings'];
      const currentVersion = this.getCurrentVersion();
      
      // Add usage tables if migration 1 is applied
      if (currentVersion >= 1) {
        requiredTables.push('usage_config', 'usage_snapshots');
      }
      
      for (const table of requiredTables) {
        if (!tableNames.includes(table)) {
          console.error(`❌ Required table missing: ${table}`);
          return false;
        }
      }
      
      // Check foreign key constraints
      const fkViolations = this.db.prepare('PRAGMA foreign_key_check').all();
      if (fkViolations.length > 0) {
        console.error('❌ Foreign key constraint violations:', fkViolations);
        return false;
      }
      
      console.log('✅ Database validation passed');
      return true;
    } catch (error) {
      console.error('❌ Database validation failed:', error);
      return false;
    }
  }
}