import authService from '../services/authService.js'

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  const payload = authService.verifyToken(token)

  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  req.house = payload
  next()
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    const payload = authService.verifyToken(token)
    if (payload) {
      req.house = payload
    }
  }

  next()
}

export default { authenticateToken, optionalAuth }
