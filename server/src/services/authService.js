import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'

const SALT_ROUNDS = 10
const JWT_EXPIRY = '7d'

class AuthService {
  getJwtSecret() {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.warn('JWT_SECRET not configured, using default (not secure for production)')
      return 'maihomecenter-dev-secret-change-in-production'
    }
    return secret
  }

  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash)
  }

  generateToken(payload) {
    return jwt.sign(payload, this.getJwtSecret(), { expiresIn: JWT_EXPIRY })
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.getJwtSecret())
    } catch (error) {
      return null
    }
  }

  async login(houseId, password) {
    const result = await query(
      'SELECT id, house_id, password_hash, name FROM houses WHERE house_id = $1',
      [houseId]
    )

    if (result.rows.length === 0) {
      throw new Error('Invalid house ID or password')
    }

    const house = result.rows[0]
    const isValid = await this.verifyPassword(password, house.password_hash)

    if (!isValid) {
      throw new Error('Invalid house ID or password')
    }

    const token = this.generateToken({
      id: house.id,
      houseId: house.house_id,
      name: house.name
    })

    return {
      token,
      house: {
        id: house.id,
        houseId: house.house_id,
        name: house.name
      }
    }
  }

  async createHouse(houseId, password, name = null) {
    const passwordHash = await this.hashPassword(password)

    const result = await query(
      `INSERT INTO houses (house_id, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, house_id, name, created_at`,
      [houseId, passwordHash, name]
    )

    return result.rows[0]
  }

  async updateHousePassword(id, newPassword) {
    const passwordHash = await this.hashPassword(newPassword)

    await query(
      'UPDATE houses SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    )
  }

  async getHouses() {
    const result = await query(
      'SELECT id, house_id, name, created_at FROM houses ORDER BY created_at DESC'
    )
    return result.rows
  }

  async getHouseById(id) {
    const result = await query(
      'SELECT id, house_id, name, created_at FROM houses WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  async deleteHouse(id) {
    const result = await query('DELETE FROM houses WHERE id = $1', [id])
    return result.rowCount > 0
  }
}

export default new AuthService()
