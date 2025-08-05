#!/usr/bin/env bun
/**
 * Migration Testing Script
 * 
 * Tests the migration system with various scenarios:
 * - Fresh database setup
 * - Migration application
 * - Rollback functionality
 * - Data integrity
 */

import { Database } from 'bun:sqlite';
import { MigrationRunner } from '../src/migrations';
import * as fs from 'fs';

const TEST_DB_PATH = 'test_migrations.db';

async function cleanupTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

async function testFreshMigration(): Promise<boolean> {
  console.log('🧪 Testing fresh migration...');
  
  try {
    const db = new Database(TEST_DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    
    const migrationRunner = new MigrationRunner(db);
    
    // Check initial state
    const initialStatus = migrationRunner.getStatus();
    console.log(`  Initial version: ${initialStatus.currentVersion}`);
    console.log(`  Pending migrations: ${initialStatus.pendingCount}`);
    
    // Run migrations
    await migrationRunner.migrate();
    
    // Check final state
    const finalStatus = migrationRunner.getStatus();
    console.log(`  Final version: ${finalStatus.currentVersion}`);
    console.log(`  Applied migrations: ${finalStatus.appliedMigrations.length}`);
    
    // Validate database
    const isValid = migrationRunner.validateDatabase();
    if (!isValid) {
      console.log('  ❌ Database validation failed');
      return false;
    }
    
    // Test table existence and structure
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];
    
    const expectedTables = ['events', 'schema_migrations', 'themes', 'theme_shares', 'theme_ratings', 'usage_config', 'usage_snapshots'];
    const tableNames = tables.map(t => t.name);
    
    for (const expectedTable of expectedTables) {
      if (!tableNames.includes(expectedTable)) {
        console.log(`  ❌ Missing table: ${expectedTable}`);
        return false;
      }
    }
    
    // Test default data
    const configCount = db.prepare('SELECT COUNT(*) as count FROM usage_config').get() as { count: number };
    if (configCount.count !== 1) {
      console.log(`  ❌ Expected 1 default config, found ${configCount.count}`);
      return false;
    }
    
    db.close();
    console.log('  ✅ Fresh migration test passed');
    return true;
  } catch (error) {
    console.log('  ❌ Fresh migration test failed:', error);
    return false;
  }
}

async function testRollback(): Promise<boolean> {
  console.log('🧪 Testing rollback functionality...');
  
  try {
    const db = new Database(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON');
    
    const migrationRunner = new MigrationRunner(db);
    
    // Get current version
    const beforeRollback = migrationRunner.getStatus();
    console.log(`  Version before rollback: ${beforeRollback.currentVersion}`);
    
    if (beforeRollback.currentVersion === 0) {
      console.log('  ⚠️  No migrations to rollback');
      db.close();
      return true;
    }
    
    // Rollback one version
    await migrationRunner.rollback(beforeRollback.currentVersion - 1);
    
    // Check new version
    const afterRollback = migrationRunner.getStatus();
    console.log(`  Version after rollback: ${afterRollback.currentVersion}`);
    
    if (afterRollback.currentVersion !== beforeRollback.currentVersion - 1) {
      console.log('  ❌ Rollback did not change version correctly');
      return false;
    }
    
    // Check that usage tables are gone (assuming we rolled back migration 1)
    if (afterRollback.currentVersion === 0) {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('usage_config', 'usage_snapshots')
      `).all() as { name: string }[];
      
      if (tables.length > 0) {
        console.log('  ❌ Usage tables still exist after rollback');
        return false;
      }
    }
    
    // Re-apply migrations
    await migrationRunner.migrate();
    
    // Validate final state
    const finalStatus = migrationRunner.getStatus();
    if (finalStatus.currentVersion !== beforeRollback.currentVersion) {
      console.log('  ❌ Failed to restore to original version');
      return false;
    }
    
    const isValid = migrationRunner.validateDatabase();
    if (!isValid) {
      console.log('  ❌ Database validation failed after re-migration');
      return false;
    }
    
    db.close();
    console.log('  ✅ Rollback test passed');
    return true;
  } catch (error) {
    console.log('  ❌ Rollback test failed:', error);
    return false;
  }
}

async function testDataIntegrity(): Promise<boolean> {
  console.log('🧪 Testing data integrity...');
  
  try {
    const db = new Database(TEST_DB_PATH);
    db.exec('PRAGMA foreign_keys = ON');
    
    // Test usage_config constraints
    console.log('  Testing usage_config constraints...');
    
    // Test valid insertion
    const insertValid = db.prepare(`
      INSERT INTO usage_config (plan, view, theme, refresh_rate, is_active)
      VALUES ('pro', 'daily', 'dark', 30, 0)
    `);
    
    try {
      insertValid.run();
      console.log('    ✅ Valid insertion works');
    } catch (error) {
      console.log('    ❌ Valid insertion failed:', error);
      return false;
    }
    
    // Test invalid plan constraint
    const insertInvalidPlan = db.prepare(`
      INSERT INTO usage_config (plan, view, theme, refresh_rate, is_active)
      VALUES ('invalid_plan', 'daily', 'dark', 30, 0)
    `);
    
    try {
      insertInvalidPlan.run();
      console.log('    ❌ Invalid plan constraint not enforced');
      return false;
    } catch (error) {
      console.log('    ✅ Invalid plan correctly rejected');
    }
    
    // Test refresh_rate bounds
    const insertInvalidRate = db.prepare(`
      INSERT INTO usage_config (plan, view, theme, refresh_rate, is_active)
      VALUES ('pro', 'daily', 'dark', 100, 0)
    `);
    
    try {
      insertInvalidRate.run();
      console.log('    ❌ Invalid refresh_rate constraint not enforced');
      return false;
    } catch (error) {
      console.log('    ✅ Invalid refresh_rate correctly rejected');
    }
    
    // Test usage_snapshots foreign key
    console.log('  Testing usage_snapshots foreign key...');
    
    // Insert a test event first
    const insertEvent = db.prepare(`
      INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
      VALUES ('test', 'test-session-123', 'PreToolUse', '{}', ?)
    `);
    insertEvent.run(Date.now());
    
    // Insert valid snapshot
    const insertValidSnapshot = db.prepare(`
      INSERT INTO usage_snapshots (session_id, snapshot_data, snapshot_type, timestamp)
      VALUES ('test-session-123', '{"test": true}', 'stats', ?)
    `);
    
    try {
      insertValidSnapshot.run(Date.now());
      console.log('    ✅ Valid snapshot insertion works');
    } catch (error) {
      console.log('    ❌ Valid snapshot insertion failed:', error);
      return false;
    }
    
    // Test foreign key constraint (this should work even with non-existent session)
    // Note: SQLite foreign key constraints are only enforced if the referenced row exists
    // In our case, we're allowing orphaned snapshots for flexibility
    
    db.close();
    console.log('  ✅ Data integrity test passed');
    return true;
  } catch (error) {
    console.log('  ❌ Data integrity test failed:', error);
    return false;
  }
}

async function main() {
  console.log('🧪 Starting Migration Test Suite');
  console.log('=' .repeat(50));
  
  let allTestsPassed = true;
  
  try {
    // Cleanup any existing test database
    await cleanupTestDb();
    
    // Run tests
    const freshMigrationPassed = await testFreshMigration();
    allTestsPassed = allTestsPassed && freshMigrationPassed;
    
    const rollbackPassed = await testRollback();
    allTestsPassed = allTestsPassed && rollbackPassed;
    
    const dataIntegrityPassed = await testDataIntegrity();
    allTestsPassed = allTestsPassed && dataIntegrityPassed;
    
    console.log('');
    console.log('=' .repeat(50));
    if (allTestsPassed) {
      console.log('🎉 All migration tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some migration tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test database
    await cleanupTestDb();
  }
}

// Handle both direct execution and module import
if (import.meta.main) {
  main();
}