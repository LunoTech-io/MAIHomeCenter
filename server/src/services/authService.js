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
      'SELECT id, house_id, password_hash, name, tariff_schedule FROM houses WHERE house_id = $1',
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
        name: house.name,
        tariff_schedule: house.tariff_schedule
      }
    }
  }

  async createHouse(houseId, password, name = null, organization = 'ou') {
    const passwordHash = await this.hashPassword(password)

    const result = await query(
      `INSERT INTO houses (house_id, password_hash, name, organization)
       VALUES ($1, $2, $3, $4)
       RETURNING id, house_id, name, organization, tariff_schedule, created_at`,
      [houseId, passwordHash, name, organization]
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
      `SELECT h.id, h.house_id, h.name, h.organization, h.latitude, h.longitude, h.city, h.tariff_schedule, h.created_at,
              COALESCE((SELECT SUM(points) FROM house_point_events WHERE house_id = h.id), 0)::int AS points
       FROM houses h
       ORDER BY h.created_at DESC`
    )
    return result.rows
  }

  async getHousesByOrganization(org) {
    if (org === 'ou') {
      return this.getHouses()
    }
    const result = await query(
      `SELECT h.id, h.house_id, h.name, h.organization, h.latitude, h.longitude, h.city, h.tariff_schedule, h.created_at,
              COALESCE((SELECT SUM(points) FROM house_point_events WHERE house_id = h.id), 0)::int AS points
       FROM houses h
       WHERE h.organization = $1
       ORDER BY h.created_at DESC`,
      [org]
    )
    return result.rows
  }

  async getHouseById(id) {
    const result = await query(
      'SELECT id, house_id, name, organization, latitude, longitude, city, tariff_schedule, created_at FROM houses WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  async updateHouse(id, fields) {
    const { name, latitude, longitude, city, tariffSchedule } = fields
    const result = await query(
      `UPDATE houses
       SET name = $2,
           latitude = $3,
           longitude = $4,
           city = $5,
           tariff_schedule = $6
       WHERE id = $1
       RETURNING id, house_id, name, organization, latitude, longitude, city, tariff_schedule, created_at`,
      [id, name || null, latitude || null, longitude || null, city || null, tariffSchedule ? JSON.stringify(tariffSchedule) : null]
    )
    return result.rows[0] || null
  }

  async deleteHouse(id) {
    const result = await query('DELETE FROM houses WHERE id = $1', [id])
    return result.rowCount > 0
  }

  // =====================
  // Admin methods
  // =====================

  async adminLogin(username, password, ip = 'unknown') {
    const result = await query(
      'SELECT id, username, password_hash, organization, name FROM admins WHERE username = $1',
      [username]
    )

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password')
    }

    const admin = result.rows[0]
    const isValid = await this.verifyPassword(password, admin.password_hash)

    if (!isValid) {
      throw new Error('Invalid username or password')
    }

    await query(
      'INSERT INTO admin_login_log (admin_id, username, ip_address) VALUES ($1, $2, $3)',
      [admin.id, admin.username, ip]
    )

    const token = this.generateToken({
      id: admin.id,
      username: admin.username,
      organization: admin.organization,
      role: 'admin'
    })

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        organization: admin.organization,
        name: admin.name
      }
    }
  }

  async getAdminById(id) {
    const result = await query(
      'SELECT id, username, organization, name, comfort_thresholds, created_at FROM admins WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  async updateComfortThresholds(adminId, thresholds) {
    const result = await query(
      `UPDATE admins SET comfort_thresholds = $2 WHERE id = $1
       RETURNING id, username, organization, name, comfort_thresholds`,
      [adminId, thresholds ? JSON.stringify(thresholds) : null]
    )
    return result.rows[0] || null
  }

  async getComfortThresholdsByOrganization(org) {
    const result = await query(
      'SELECT comfort_thresholds FROM admins WHERE organization = $1 AND comfort_thresholds IS NOT NULL LIMIT 1',
      [org]
    )
    return result.rows[0]?.comfort_thresholds || null
  }

  async createAdmin(username, password, organization = 'ou', name = null) {
    const passwordHash = await this.hashPassword(password)

    const result = await query(
      `INSERT INTO admins (username, password_hash, organization, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, organization, name, created_at`,
      [username, passwordHash, organization, name]
    )

    return result.rows[0]
  }
}

export default new AuthService()
