import pg from 'pg'
const { Pool } = pg

let pool = null

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      console.warn('DATABASE_URL not configured. Database features will be unavailable.')
      return null
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    console.log('PostgreSQL connection pool created')
  }

  return pool
}

export async function query(text, params) {
  const pool = getPool()
  if (!pool) {
    throw new Error('Database not configured')
  }

  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start

  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount })
  }

  return result
}

export async function getClient() {
  const pool = getPool()
  if (!pool) {
    throw new Error('Database not configured')
  }
  return pool.connect()
}

export default { getPool, query, getClient }
