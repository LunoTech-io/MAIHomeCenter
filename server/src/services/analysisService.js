import Anthropic from '@anthropic-ai/sdk'
import { query } from '../db/index.js'
import twinService from './twinService.js'
import weatherService from './weatherService.js'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert housing analyst for a social housing corporation in the Netherlands. You analyze sensor data from tenant homes and provide actionable recommendations.

You receive JSON data containing:
- Room temperatures, humidity, CO2 levels, motion detection, and thermostat setpoints
- Electricity draw/return (solar) and gas usage over 24 hours
- Appliance power consumption
- Outside weather temperature

Provide a concise analysis in markdown format with these sections:
1. **Temperature Assessment** — Which rooms are too cold/warm, gaps between setpoint and actual, patterns
2. **Air Quality & Humidity** — Any concerns, missing sensors
3. **Energy Overview** — Consumption patterns, solar production, gas usage context
4. **Key Concerns** — The most urgent issues ranked by priority
5. **Recommended Actions** — Specific, actionable steps for the housing corporation

Keep the tone professional but accessible. Use bullet points. Be specific about numbers.
Focus on what is actionable — insulation issues, heating system problems, tenant support needs, mold risks, etc.
If data is missing for some rooms/metrics, note it as a monitoring gap.
Write in English.`

export async function getAnalysisHistory(houseId, limit = 10) {
  const result = await query(
    'SELECT id, house_id, analysis, generated_by, created_at FROM house_analyses WHERE house_id = $1 ORDER BY created_at DESC LIMIT $2',
    [houseId, limit]
  )
  return result.rows
}

export async function getLatestAnalysis(houseId) {
  const result = await query(
    'SELECT id, house_id, analysis, generated_by, created_at FROM house_analyses WHERE house_id = $1 ORDER BY created_at DESC LIMIT 1',
    [houseId]
  )
  return result.rows[0] || null
}

export async function generateHouseAnalysis(houseId, generatedBy = null) {
  // Gather all data in parallel
  const [sensorData, twinState, meterData, applianceData, weatherData] = await Promise.all([
    twinService.getSensorHistory(houseId, 24).catch(() => null),
    twinService.getLatestState(houseId).catch(() => null),
    twinService.getMeterHistory(houseId, 24).catch(() => null),
    twinService.getApplianceHistory(houseId, 24).catch(() => null),
    weatherService.getLatestWeather(houseId).catch(() => null),
  ])

  const dataPayload = {
    houseId,
    currentState: twinState,
    outsideTemperature: weatherData?.temperature,
    sensorHistory: summarizeSensorData(sensorData),
    meterHistory: summarizeMeterData(meterData),
    appliances: summarizeApplianceData(applianceData),
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze this house data and provide recommendations:\n\n${JSON.stringify(dataPayload, null, 2)}`
      }
    ],
  })

  const analysisText = message.content[0].text

  // Save to database
  await query(
    'INSERT INTO house_analyses (house_id, analysis, generated_by) VALUES ($1, $2, $3)',
    [houseId, analysisText, generatedBy || null]
  )

  return analysisText
}

function summarizeSensorData(data) {
  if (!data?.data?.length) return null
  const rooms = data.rooms || []
  const summary = {}
  for (const room of rooms) {
    const temps = data.data.map(d => d[`${room}_temp`]).filter(v => v != null)
    const humids = data.data.map(d => d[`${room}_humidity`]).filter(v => v != null)
    const co2s = data.data.map(d => d[`${room}_co2`]).filter(v => v != null)
    const sets = data.data.map(d => d[`${room}_set`]).filter(v => v != null)
    summary[room] = {}
    if (temps.length) summary[room].temperature = { min: Math.min(...temps), max: Math.max(...temps), avg: +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) }
    if (humids.length) summary[room].humidity = { min: Math.min(...humids), max: Math.max(...humids), avg: +(humids.reduce((a, b) => a + b, 0) / humids.length).toFixed(0) }
    if (co2s.length) summary[room].co2 = { min: Math.min(...co2s), max: Math.max(...co2s), avg: +(co2s.reduce((a, b) => a + b, 0) / co2s.length).toFixed(0) }
    if (sets.length) summary[room].setpoint = sets[sets.length - 1]
  }
  return summary
}

function summarizeMeterData(data) {
  if (!data?.data?.length) return null
  const draws = data.data.map(d => d.positive_active_power).filter(v => v != null)
  const returns = data.data.map(d => d.negative_active_power).filter(v => v != null)
  const gas = data.data.map(d => d.gas_usage).filter(v => v != null)
  return {
    electricity: draws.length ? { min: Math.min(...draws), max: Math.max(...draws), avg: +(draws.reduce((a, b) => a + b, 0) / draws.length).toFixed(2) } : null,
    solarReturn: returns.length ? { min: Math.min(...returns), max: Math.max(...returns), avg: +(returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2) } : null,
    gas: gas.length ? { total: +(gas.reduce((a, b) => a + b, 0)).toFixed(3), readings: gas.length } : null,
  }
}

function summarizeApplianceData(data) {
  if (!data?.data?.length) return null
  const summary = {}
  for (const name of (data.appliances || [])) {
    const vals = data.data.map(d => d[name]).filter(v => v != null)
    if (vals.length) {
      summary[name] = { min: Math.min(...vals), max: Math.max(...vals), avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1), unit: 'W' }
    }
  }
  return summary
}
