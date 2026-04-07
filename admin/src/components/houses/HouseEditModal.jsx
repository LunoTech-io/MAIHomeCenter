import { useState, useEffect, useRef } from 'react'
import { updateHouse } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function initSchedule(schedule) {
  const s = schedule || {}
  const result = {}
  for (const day of DAYS) {
    result[day] = {
      high: s[day]?.high || '',
      low: s[day]?.low || '',
    }
  }
  return result
}

function scheduleToPayload(schedule) {
  const hasAny = DAYS.some(d => schedule[d].high || schedule[d].low)
  if (!hasAny) return null
  const result = {}
  for (const day of DAYS) {
    result[day] = {
      high: schedule[day].high || null,
      low: schedule[day].low || null,
    }
  }
  return result
}

function HouseEditModal({ house, onClose, onUpdated }) {
  const { t } = useLanguage()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  const [form, setForm] = useState({
    name: house.name || '',
    latitude: house.latitude || '',
    longitude: house.longitude || '',
    city: house.city || '',
  })
  const [schedule, setSchedule] = useState(() => initSchedule(house.tariff_schedule))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleScheduleChange = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  const copyToAll = (sourceDay) => {
    setSchedule(prev => {
      const source = prev[sourceDay]
      const next = {}
      for (const day of DAYS) {
        next[day] = { ...source }
      }
      return next
    })
  }

  const clearAllTariffs = () => {
    setSchedule(initSchedule(null))
  }

  // Initialize leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const lat = parseFloat(form.latitude) || 52.09
    const lng = parseFloat(form.longitude) || 5.12

    const map = L.map(mapRef.current).setView([lat, lng], form.latitude ? 15 : 7)
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    if (form.latitude && form.longitude) {
      markerRef.current = L.marker([lat, lng]).addTo(map)
    }

    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.latlng
      setForm(prev => ({
        ...prev,
        latitude: newLat.toFixed(6),
        longitude: newLng.toFixed(6),
      }))

      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng])
      } else {
        markerRef.current = L.marker([newLat, newLng]).addTo(map)
      }
    })

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const lat = parseFloat(form.latitude)
    const lng = parseFloat(form.longitude)
    if (isNaN(lat) || isNaN(lng)) return

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map)
    }
    map.setView([lat, lng], map.getZoom())
  }, [form.latitude, form.longitude])

  const clearCoordinates = () => {
    setForm(prev => ({ ...prev, latitude: '', longitude: '' }))
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const updated = await updateHouse(house.id, {
        ...form,
        tariffSchedule: scheduleToPayload(schedule),
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content house-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('houses.editHouse')}: {house.house_id}</h2>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="survey-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="edit-name">{t('houses.name')}</label>
              <input
                type="text"
                id="edit-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t('houses.namePlaceholder')}
              />
            </div>

            <div className="form-section-label">{t('houses.location')}</div>

            <div className="map-container" ref={mapRef} />

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-latitude">{t('houses.latitude')}</label>
                <input
                  type="text"
                  id="edit-latitude"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="52.090000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-longitude">{t('houses.longitude')}</label>
                <input
                  type="text"
                  id="edit-longitude"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="5.120000"
                />
              </div>
              {(form.latitude || form.longitude) && (
                <div className="form-group" style={{ flex: '0 0 auto', paddingTop: 24 }}>
                  <button type="button" className="clear-coords-btn" onClick={clearCoordinates}>
                    {t('houses.clearCoordinates')}
                  </button>
                </div>
              )}
            </div>

            <div className="form-section-label">
              {t('houses.tariffTimes')}
              <button type="button" className="clear-coords-btn" style={{ marginLeft: 12, fontSize: 12 }} onClick={clearAllTariffs}>
                {t('houses.clearAll')}
              </button>
            </div>

            <div className="tariff-schedule">
              {DAYS.map((day, i) => (
                <div key={day} className="tariff-day-row">
                  <span className="tariff-day-label">{t(`houses.day.${day}`)}</span>
                  <input
                    type="time"
                    value={schedule[day].high}
                    onChange={(e) => handleScheduleChange(day, 'high', e.target.value)}
                    title={t('houses.tariffHighStart')}
                  />
                  <input
                    type="time"
                    value={schedule[day].low}
                    onChange={(e) => handleScheduleChange(day, 'low', e.target.value)}
                    title={t('houses.tariffLowStart')}
                  />
                  {i === 0 && (
                    <button type="button" className="copy-all-btn" onClick={() => copyToAll(day)}>
                      {t('houses.copyToAll')}
                    </button>
                  )}
                </div>
              ))}
              <div className="tariff-schedule-header">
                <span></span>
                <span className="tariff-col-label">{t('houses.highStart')}</span>
                <span className="tariff-col-label">{t('houses.lowStart')}</span>
              </div>
            </div>

            <p className="form-hint">{t('houses.tariffHint')}</p>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="send-btn" disabled={saving}>
              {saving ? t('houses.saving') : t('houses.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HouseEditModal
