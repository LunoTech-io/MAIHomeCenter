import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    await client.connect()
    console.log('Connected to database')

    const migrationPath = join(__dirname, 'migrations', '001_create_tables.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    console.log('Running migration...')
    await client.query(sql)

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()
