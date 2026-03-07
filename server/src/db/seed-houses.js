import crypto from 'crypto'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import pg from 'pg'

dotenv.config()

function generatePassword() {
  return crypto.randomBytes(12).toString('base64url')
}

const houses = [
  { houseId: 'woning16', name: 'WONING 16', organization: 'ou' },
  { houseId: 'weller1', name: 'Weller 1', organization: 'weller' },
  { houseId: 'weller2', name: 'Weller 2', organization: 'weller' },
  { houseId: 'weller3', name: 'Weller 3', organization: 'weller' },
  { houseId: 'weller4', name: 'Weller 4', organization: 'weller' },
  { houseId: 'weller5', name: 'Weller 5', organization: 'weller' },
  { houseId: 'wonenzuid1', name: 'Wonen Zuid 1', organization: 'wonenzuid' },
  { houseId: 'wonenzuid2', name: 'Wonen Zuid 2', organization: 'wonenzuid' },
  { houseId: 'wonenzuid3', name: 'Wonen Zuid 3', organization: 'wonenzuid' },
  { houseId: 'wonenzuid4', name: 'Wonen Zuid 4', organization: 'wonenzuid' },
  { houseId: 'wonenzuid5', name: 'Wonen Zuid 5', organization: 'wonenzuid' },
  { houseId: 'wonenlimburg1', name: 'Wonen in Limburg 1', organization: 'wonenlimburg' },
  { houseId: 'wonenlimburg2', name: 'Wonen in Limburg 2', organization: 'wonenlimburg' },
  { houseId: 'wonenlimburg3', name: 'Wonen in Limburg 3', organization: 'wonenlimburg' },
  { houseId: 'wonenlimburg4', name: 'Wonen in Limburg 4', organization: 'wonenlimburg' },
  { houseId: 'wonenlimburg5', name: 'Wonen in Limburg 5', organization: 'wonenlimburg' },
]

const orgAdmins = [
  { username: 'weller-admin', organization: 'weller', name: 'Weller Admin' },
  { username: 'wonenzuid-admin', organization: 'wonenzuid', name: 'Wonen Zuid Admin' },
  { username: 'wonenlimburg-admin', organization: 'wonenlimburg', name: 'Wonen Limburg Admin' },
]

async function seedHouses() {
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

    console.log('\n=== House Credentials ===\n')

    // Seed houses with unique passwords
    for (const h of houses) {
      const password = generatePassword()
      const passwordHash = await bcrypt.hash(password, 10)
      await client.query(
        `INSERT INTO houses (house_id, password_hash, name, organization)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (house_id) DO UPDATE SET password_hash = $2, name = $3, organization = $4`,
        [h.houseId, passwordHash, h.name, h.organization]
      )
      console.log(`  ${h.houseId.padEnd(20)} ${password}`)
    }

    console.log('\n=== Admin Credentials ===\n')

    // Seed org-specific admin users with unique passwords
    for (const a of orgAdmins) {
      const password = generatePassword()
      const adminHash = await bcrypt.hash(password, 10)
      await client.query(
        `INSERT INTO admins (username, password_hash, organization, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, organization = $3, name = $4`,
        [a.username, adminHash, a.organization, a.name]
      )
      console.log(`  ${a.username.padEnd(25)} ${password}`)
    }

    console.log(`\nSeeded ${houses.length} houses and ${orgAdmins.length} org admins.`)
    console.log('IMPORTANT: Save the credentials above — they cannot be recovered.\n')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seedHouses()
