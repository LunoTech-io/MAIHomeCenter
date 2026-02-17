import { Router } from 'express'
import twinService from '../services/twinService.js'

const router = Router()

// POST /api/twin/sensor-data — Store sensor readings from ML server
router.post('/sensor-data', async (req, res) => {
  try {
    const { houseId, timestamp, rooms } = req.body

    if (!houseId || !timestamp || !rooms) {
      return res.status(400).json({ error: 'houseId, timestamp, and rooms are required' })
    }

    await twinService.storeSensorData(houseId, timestamp, rooms)
    res.json({ success: true })
  } catch (error) {
    console.error('Error storing sensor data:', error)
    res.status(500).json({ error: 'Failed to store sensor data' })
  }
})

// POST /api/twin/predictions — Store prediction results from ML server
router.post('/predictions', async (req, res) => {
  try {
    const { houseId, prediction } = req.body

    if (!houseId || !prediction) {
      return res.status(400).json({ error: 'houseId and prediction are required' })
    }

    const result = await twinService.storePrediction(houseId, prediction)
    res.status(201).json(result)
  } catch (error) {
    console.error('Error storing prediction:', error)
    res.status(500).json({ error: 'Failed to store prediction' })
  }
})

// GET /api/twin/state/:houseId — Get latest room states
router.get('/state/:houseId', async (req, res) => {
  try {
    const rooms = await twinService.getLatestState(req.params.houseId)
    res.json({ houseId: req.params.houseId, rooms })
  } catch (error) {
    console.error('Error fetching twin state:', error)
    res.status(500).json({ error: 'Failed to fetch twin state' })
  }
})

// GET /api/twin/predictions/:houseId/latest — Get latest prediction
router.get('/predictions/:houseId/latest', async (req, res) => {
  try {
    const prediction = await twinService.getLatestPrediction(req.params.houseId)

    if (!prediction) {
      return res.status(404).json({ error: 'No predictions found' })
    }

    res.json(prediction)
  } catch (error) {
    console.error('Error fetching prediction:', error)
    res.status(500).json({ error: 'Failed to fetch prediction' })
  }
})

// GET /api/twin/sensor-data/:houseId — Get sensor history
router.get('/sensor-data/:houseId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const data = await twinService.getSensorHistory(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, data })
  } catch (error) {
    console.error('Error fetching sensor history:', error)
    res.status(500).json({ error: 'Failed to fetch sensor history' })
  }
})

export default router
