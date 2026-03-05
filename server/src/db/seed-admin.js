import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import pg from 'pg'

dotenv.config()

async function seedAdmin() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const username = process.argv[2] || 'admin'
  const password = process.argv[3] || 'admin'
  const organization = process.argv[4] || 'ou'
  const name = process.argv[5] || 'Admin'

  const client = new pg.Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    await client.connect()

    const passwordHash = await bcrypt.hash(password, 10)

    await client.query(
      `INSERT INTO admins (username, password_hash, organization, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, organization = $3, name = $4`,
      [username, passwordHash, organization, name]
    )

    console.log(`Admin user "${username}" created/updated (org: ${organization})`)
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seedAdmin()
