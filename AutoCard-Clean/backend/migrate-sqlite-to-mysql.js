/**
 * Script to migrate data from SQLite to MySQL
 * 
 * Usage:
 * 1. Make sure Railway MySQL is set up and DATABASE_URL is updated in .env
 * 2. Run: node migrate-sqlite-to-mysql.js
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// Connect to SQLite
const sqliteDb = new Database(join(__dirname, 'prisma', 'dev.db'), { readonly: true });

async function migrate() {
  try {
    console.log('🚀 Starting migration from SQLite to MySQL...\n');

    // Get all tables
    const tables = [
      'users',
      'employee_profiles',
      'customer_profiles',
      'departments',
      'shifts',
      'locations',
      'roster_entries',
      'attendance',
      'leave_types',
      'leave_balances',
      'leave_requests',
      'holidays',
      'employee_requests',
      'projects',
      'project_assignments',
      'access_controls',
      'module_permissions',
      'contact_submissions'
    ];

    for (const table of tables) {
      try {
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
        
        if (rows.length === 0) {
          console.log(`⏭️  Skipping ${table} (empty)`);
          continue;
        }

        console.log(`📦 Migrating ${table}: ${rows.length} rows...`);

        // Use raw SQL to insert data
        for (const row of rows) {
          const columns = Object.keys(row).join(', ');
          const placeholders = Object.keys(row).map(() => '?').join(', ');
          const values = Object.values(row);

          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
              ...values
            );
          } catch (err) {
            console.error(`   ❌ Error inserting row in ${table}:`, err.message);
          }
        }

        console.log(`   ✅ ${table} migrated successfully\n`);
      } catch (err) {
        console.error(`❌ Error migrating ${table}:`, err.message, '\n');
      }
    }

    console.log('🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
    sqliteDb.close();
  }
}

migrate();
