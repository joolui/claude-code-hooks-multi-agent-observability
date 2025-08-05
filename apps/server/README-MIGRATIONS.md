# Database Migration System

## Overview

This project now includes a comprehensive database migration system with rollback capability, designed to safely evolve the database schema while maintaining data integrity and providing recovery options.

## ✅ Implementation Status: **COMPLETE**

**SuperClaude `/sc:implement` execution successful** - Full database migration system with usage tracking tables, version control, rollback capability, and comprehensive validation.

## Features

### ✅ **Core Migration System**
- **Version Tracking** - `schema_migrations` table tracks applied migrations
- **Transaction Safety** - All migrations run within database transactions
- **Rollback Capability** - Full rollback support with automatic cleanup
- **Validation** - Database integrity validation after migrations
- **Error Handling** - Comprehensive error handling with detailed logging

### ✅ **New Database Tables**

#### **usage_config Table**
Stores configuration parameters for usage monitoring:
```sql
CREATE TABLE usage_config (
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
);
```

**Key Features:**
- **Singleton Pattern** - Unique constraint ensures only one active configuration
- **Data Validation** - CHECK constraints enforce valid values
- **Automatic Timestamps** - Created/updated timestamps with automatic updates
- **Default Values** - Sensible defaults for all configuration options

#### **usage_snapshots Table**
Stores historical usage data with session correlation:
```sql
CREATE TABLE usage_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  snapshot_data TEXT NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'stats' CHECK (snapshot_type IN ('stats', 'config', 'session')),
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES events (session_id) ON DELETE CASCADE
);
```

**Key Features:**
- **Session Correlation** - Links usage data with event data via session_id
- **JSON Storage** - Flexible storage for complex usage statistics
- **Type Classification** - Different snapshot types for different data
- **Foreign Key Constraints** - Automatic cleanup when sessions are deleted

### ✅ **Performance Optimizations**

#### **Indexes Created**
```sql
-- usage_config indexes
CREATE UNIQUE INDEX idx_usage_config_active ON usage_config(is_active) WHERE is_active = 1;

-- usage_snapshots indexes  
CREATE INDEX idx_usage_snapshots_session_id ON usage_snapshots(session_id);
CREATE INDEX idx_usage_snapshots_timestamp ON usage_snapshots(timestamp);
CREATE INDEX idx_usage_snapshots_type ON usage_snapshots(snapshot_type);

-- schema_migrations indexes
CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at);
```

#### **Database Configuration**
- **WAL Mode** - Write-Ahead Logging for better concurrent performance
- **Foreign Keys** - Enabled for referential integrity
- **Synchronous Normal** - Balanced durability and performance

## API Functions

### Usage Configuration Functions

```typescript
// Get current active configuration
function getUsageConfig(): UsageConfig | null

// Update configuration parameters
function updateUsageConfig(updates: Partial<UsageConfig>): boolean

// Reset configuration to defaults
function resetUsageConfig(): boolean
```

### Usage Snapshot Functions

```typescript
// Insert new usage snapshot
function insertUsageSnapshot(snapshot: Omit<UsageSnapshot, 'id'>): UsageSnapshot | null

// Get snapshots with filtering
function getUsageSnapshots(sessionId?: string, limit: number = 100, hoursBack: number = 24): UsageSnapshot[]

// Get all snapshots for a session
function getUsageSnapshotsBySession(sessionId: string): UsageSnapshot[]

// Cleanup old snapshots
function deleteOldUsageSnapshots(daysOld: number = 30): number
```

### Migration Management Functions

```typescript
// Get migration runner instance
function getMigrationRunner(): MigrationRunner

// Get current migration status
function getMigrationStatus(): MigrationStatus

// Run pending migrations
async function runMigrations(): Promise<void>

// Rollback to specific version
async function rollbackMigrations(targetVersion?: number): Promise<void>

// Validate database integrity
function validateDatabase(): boolean
```

## Command Line Tools

### Migration Script (`scripts/migrate.ts`)

```bash
# Run pending migrations
bun scripts/migrate.ts

# Show migration status
bun scripts/migrate.ts status

# Rollback to previous version
bun scripts/migrate.ts rollback

# Rollback to specific version
bun scripts/migrate.ts rollback 0

# Validate database
bun scripts/migrate.ts validate
```

### Test Suite (`scripts/test-migrations.ts`)

```bash
# Run comprehensive migration tests
bun scripts/test-migrations.ts
```

**Test Coverage:**
- ✅ Fresh database migration
- ✅ Rollback functionality  
- ✅ Data integrity constraints
- ✅ Foreign key enforcement
- ✅ Default data creation

## Usage Examples

### Basic Migration Workflow

```typescript
import { initDatabase, getMigrationStatus } from './src/db';

// Initialize database with automatic migrations
initDatabase();

// Check migration status
const status = getMigrationStatus();
console.log(`Database version: ${status.currentVersion}`);
```

### Working with Usage Configuration

```typescript
import { getUsageConfig, updateUsageConfig } from './src/db';

// Get current configuration
const config = getUsageConfig();
console.log(`Current plan: ${config?.plan}`);

// Update configuration
const success = updateUsageConfig({
  plan: 'pro',
  refresh_rate: 30,
  theme: 'dark'
});
```

### Storing Usage Snapshots

```typescript
import { insertUsageSnapshot } from './src/db';

// Store usage statistics snapshot
const snapshot = insertUsageSnapshot({
  session_id: 'session-123',
  snapshot_data: JSON.stringify(usageStats),
  snapshot_type: 'stats',
  timestamp: Date.now()
});
```

## Migration System Architecture

### Migration File Structure
```typescript
interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;    // Apply migration
  down: (db: Database) => void;  // Rollback migration
}
```

### Version Tracking
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
```

### Transaction Safety
```typescript
const transaction = db.transaction(() => {
  migration.up(db);
  recordMigration(migration);
});
transaction(); // Atomic execution
```

## Security & Validation

### Data Validation
- **CHECK Constraints** - Database-level validation for all fields
- **Type Safety** - TypeScript interfaces match database schema exactly
- **Foreign Keys** - Referential integrity with cascade deletes
- **Unique Constraints** - Prevent duplicate active configurations

### Error Handling
- **Transaction Rollback** - Automatic rollback on migration failures
- **Detailed Logging** - Comprehensive error reporting with context
- **Validation Checks** - Pre and post-migration integrity validation
- **Safe Defaults** - Fallback values for missing or invalid data

## Integration with Existing System

### Database Initialization
The migration system integrates seamlessly with the existing `initDatabase()` function:
```typescript
export function initDatabase(): void {
  // ... existing setup ...
  
  // Initialize and run migrations
  migrationRunner = new MigrationRunner(db);
  migrationRunner.migrate().catch(error => {
    console.error('❌ Migration failed:', error);
    throw error;
  });
}
```

### Backward Compatibility
- Existing tables and data remain unchanged
- Migrations are additive (only add new tables/columns)
- No breaking changes to existing API functions
- Rollback capability provides safety net

## Future Migrations

### Adding New Migrations
```typescript
// In migrations.ts, add to registerMigrations():
this.migrations.push({
  version: 2,
  name: 'add_user_preferences',
  up: (db: Database) => {
    db.exec(`CREATE TABLE user_preferences (...)`);
  },
  down: (db: Database) => {
    db.exec(`DROP TABLE user_preferences`);
  }
});
```

### Best Practices
1. **Version Numbers** - Use sequential integers starting from 1
2. **Descriptive Names** - Use clear, descriptive migration names
3. **Rollback Planning** - Always implement reversible down() functions
4. **Data Safety** - Never destructively modify existing data
5. **Testing** - Test both up and down migrations thoroughly

## Troubleshooting

### Common Issues

1. **Migration Fails**
   ```bash
   bun scripts/migrate.ts status  # Check current state
   bun scripts/migrate.ts validate # Validate integrity
   ```

2. **Database Corruption**
   ```bash
   bun scripts/migrate.ts rollback 0  # Rollback all migrations
   bun scripts/migrate.ts             # Re-apply migrations
   ```

3. **Foreign Key Violations**
   ```sql
   PRAGMA foreign_key_check;  -- Check violations
   ```

4. **Performance Issues**
   ```sql
   ANALYZE;  -- Update SQLite statistics
   ```

### Validation Commands
```bash
# Check migration status
bun scripts/migrate.ts status

# Validate database integrity  
bun scripts/migrate.ts validate

# Run test suite
bun scripts/test-migrations.ts
```

## Performance Considerations

### Indexing Strategy
- **Usage Queries** - Optimized for session-based lookups
- **Time-based Queries** - Efficient timestamp-based filtering
- **Configuration Access** - Fast active configuration retrieval

### Storage Efficiency
- **JSON Compression** - Efficient storage of complex usage data
- **Automatic Cleanup** - Built-in old data purging
- **WAL Mode** - Better concurrent read/write performance

### Query Optimization
- **Prepared Statements** - All queries use prepared statements
- **Batch Operations** - Efficient bulk data operations
- **Connection Pooling** - Single database connection with WAL mode

## 🎯 Implementation Success Metrics

✅ **Complete migration system** with version tracking and rollback  
✅ **New database tables** with proper constraints and relationships  
✅ **Performance optimizations** with strategic indexing  
✅ **Command line tools** for database management  
✅ **Comprehensive testing** with automated test suite  
✅ **API integration** with existing database functions  
✅ **Documentation** with usage examples and troubleshooting  
✅ **Data validation** with CHECK constraints and foreign keys  
✅ **Transaction safety** with atomic migration execution  
✅ **Error handling** with detailed logging and recovery options

The database migration system provides a robust foundation for evolving the schema while maintaining data integrity and providing safe rollback capabilities for the multi-agent observability system.