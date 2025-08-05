#!/usr/bin/env bun
/**
 * Database Migration Management Script
 * 
 * Usage:
 *   bun scripts/migrate.ts                    # Run pending migrations
 *   bun scripts/migrate.ts status             # Show migration status
 *   bun scripts/migrate.ts rollback [version] # Rollback to version (default: previous)
 *   bun scripts/migrate.ts validate           # Validate database integrity
 *   bun scripts/migrate.ts reset              # Reset database (DANGER!)
 */

import { Database } from 'bun:sqlite';
import { MigrationRunner } from '../src/migrations';

async function main() {
  const command = process.argv[2] || 'migrate';
  const arg = process.argv[3];

  // Initialize database connection
  const db = new Database('events.db');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');

  const migrationRunner = new MigrationRunner(db);

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        console.log('🔄 Running database migrations...');
        await migrationRunner.migrate();
        console.log('✅ Migration complete!');
        break;

      case 'status':
        console.log('📊 Database Migration Status');
        console.log('=' .repeat(50));
        const status = migrationRunner.getStatus();
        console.log(`Current Version: ${status.currentVersion}`);
        console.log(`Latest Version: ${status.latestVersion}`);
        console.log(`Pending Migrations: ${status.pendingCount}`);
        console.log('');
        
        if (status.appliedMigrations.length > 0) {
          console.log('Applied Migrations:');
          for (const migration of status.appliedMigrations) {
            const date = new Date(migration.applied_at).toLocaleString();
            console.log(`  ✅ ${migration.version}: ${migration.name} (${date})`);
          }
        }
        
        if (status.pendingMigrations.length > 0) {
          console.log('\nPending Migrations:');
          for (const migration of status.pendingMigrations) {
            console.log(`  ⏳ ${migration.version}: ${migration.name}`);
          }
        }
        break;

      case 'rollback':
      case 'down':
        const targetVersion = arg ? parseInt(arg) : undefined;
        console.log(`🔄 Rolling back database${targetVersion !== undefined ? ` to version ${targetVersion}` : ''}...`);
        await migrationRunner.rollback(targetVersion);
        console.log('✅ Rollback complete!');
        break;

      case 'validate':
        console.log('🔍 Validating database integrity...');
        const isValid = migrationRunner.validateDatabase();
        if (isValid) {
          console.log('✅ Database validation passed!');
          process.exit(0);
        } else {
          console.log('❌ Database validation failed!');
          process.exit(1);
        }
        
      case 'reset':
        console.log('⚠️  WARNING: This will completely reset the database!');
        console.log('All data will be lost. Are you sure? (Type "yes" to continue)');
        // In a real script, you'd want to add interactive confirmation
        // For now, we'll just show the warning
        console.log('❌ Reset cancelled for safety. Implement interactive confirmation if needed.');
        break;

      case 'create':
        console.log('📝 Migration creation not implemented in this script.');
        console.log('Add new migrations directly to the migrations.ts file.');
        break;

      default:
        console.log('❌ Unknown command:', command);
        console.log('');
        console.log('Available commands:');
        console.log('  migrate   - Run pending migrations');
        console.log('  status    - Show migration status');
        console.log('  rollback  - Rollback to previous version');
        console.log('  validate  - Validate database integrity');
        console.log('  reset     - Reset database (DANGER!)');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Handle both direct execution and module import
if (import.meta.main) {
  main();
}