import { Router } from 'express'
import twinService from '../services/twinService.js'
import weatherService from '../services/weatherService.js'
import { generateHouseAnalysis, getLatestAnalysis, getAnalysisHistory } from '../services/analysisService.js'
import { authenticateAdmin } from '../middleware/authMiddleware.js'

const router = Router()

// POST /api/twin/sensor-data — Store sensor readings from ML server
router.post('/sensor-data', async (req, res) => {
  try {
    const { houseId, timestamp, rooms, meter, appliances, water } = req.body

    if (!houseId || !timestamp || !rooms) {
      return res.status(400).json({ error: 'houseId, timestamp, and rooms are required' })
    }

    await twinService.storeSensorData(houseId, timestamp, rooms, meter, appliances, water)
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
    const [rooms, weather] = await Promise.all([
      twinService.getLatestState(req.params.houseId),
      weatherService.getLatestWeather(req.params.houseId)
    ])
    res.json({ houseId: req.params.houseId, rooms, weather })
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

// GET /api/twin/sensor-data/:houseId/grouped — Get sensor history grouped by room (for charts)
router.get('/sensor-data/:houseId/grouped', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const result = await twinService.getSensorHistoryGrouped(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, ...result })
  } catch (error) {
    console.error('Error fetching grouped sensor history:', error)
    res.status(500).json({ error: 'Failed to fetch grouped sensor history' })
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

// GET /api/twin/meter-data/:houseId — Get electricity & gas meter history
router.get('/meter-data/:houseId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const data = await twinService.getMeterHistory(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, data })
  } catch (error) {
    console.error('Error fetching meter history:', error)
    res.status(500).json({ error: 'Failed to fetch meter history' })
  }
})

// GET /api/twin/appliance-data/:houseId — Get appliance power history
router.get('/appliance-data/:houseId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const result = await twinService.getApplianceHistory(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, ...result })
  } catch (error) {
    console.error('Error fetching appliance history:', error)
    res.status(500).json({ error: 'Failed to fetch appliance history' })
  }
})

// GET /api/twin/water-data/:houseId — Get water meter history
router.get('/water-data/:houseId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const data = await twinService.getWaterHistory(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, data })
  } catch (error) {
    console.error('Error fetching water history:', error)
    res.status(500).json({ error: 'Failed to fetch water history' })
  }
})

// GET /api/twin/weather/:houseId — Get latest outside temperature
router.get('/weather/:houseId', async (req, res) => {
  try {
    const weather = await weatherService.getLatestWeather(req.params.houseId)
    if (!weather) {
      return res.status(404).json({ error: 'No weather data found' })
    }
    res.json({ houseId: req.params.houseId, ...weather })
  } catch (error) {
    console.error('Error fetching weather:', error)
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// GET /api/twin/weather-history/:houseId?hours=N — Get outside temperature history
router.get('/weather-history/:houseId', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24
    const data = await weatherService.getWeatherHistory(req.params.houseId, hours)
    res.json({ houseId: req.params.houseId, data })
  } catch (error) {
    console.error('Error fetching weather history:', error)
    res.status(500).json({ error: 'Failed to fetch weather history' })
  }
})

// GET /api/twin/analysis/:houseId — Get latest saved analysis
router.get('/analysis/:houseId', authenticateAdmin, async (req, res) => {
  try {
    const latest = await getLatestAnalysis(req.params.houseId)
    if (!latest) return res.json(null)
    res.json({ houseId: req.params.houseId, analysis: latest.analysis, generatedBy: latest.generated_by, generatedAt: latest.created_at })
  } catch (error) {
    console.error('Error fetching analysis:', error)
    res.status(500).json({ error: 'Failed to fetch analysis' })
  }
})

// POST /api/twin/analysis/:houseId — Generate new AI analysis
router.post('/analysis/:houseId', authenticateAdmin, async (req, res) => {
  try {
    const analysis = await generateHouseAnalysis(req.params.houseId, req.admin.username)
    res.json({ houseId: req.params.houseId, analysis, generatedBy: req.admin.username, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Error generating analysis:', error)
    res.status(500).json({ error: 'Failed to generate analysis' })
  }
})

// GET /api/twin/analysis/:houseId/history — Get analysis history
router.get('/analysis/:houseId/history', authenticateAdmin, async (req, res) => {
  try {
    const history = await getAnalysisHistory(req.params.houseId)
    res.json(history)
  } catch (error) {
    console.error('Error fetching analysis history:', error)
    res.status(500).json({ error: 'Failed to fetch analysis history' })
  }
})

export default router
