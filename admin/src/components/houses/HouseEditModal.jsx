import { useState, useEffect, useRef } from 'react'
import { updateHouse } from '../../services/api'
import { useLanguage } from '../../contexts/LanguageContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon (leaflet assets aren't bundled by vite automatically)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function formatTime(val) {
  if (!val) return ''
  // PostgreSQL TIME comes as "HH:MM:SS" or "HH:MM"
  return val.slice(0, 5)
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
    tariffHighStart: formatTime(house.tariff_high_start),
    tariffLowStart: formatTime(house.tariff_low_start),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
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

    // Fix map rendering in modal (tiles may not load without this)
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Sync marker when lat/lng inputs change manually
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
      const updated = await updateHouse(house.id, form)
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

            <div className="form-section-label">{t('houses.tariffTimes')}</div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-tariffHighStart">{t('houses.tariffHighStart')}</label>
                <input
                  type="time"
                  id="edit-tariffHighStart"
                  name="tariffHighStart"
                  value={form.tariffHighStart}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-tariffLowStart">{t('houses.tariffLowStart')}</label>
                <input
                  type="time"
                  id="edit-tariffLowStart"
                  name="tariffLowStart"
                  value={form.tariffLowStart}
                  onChange={handleChange}
                />
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
