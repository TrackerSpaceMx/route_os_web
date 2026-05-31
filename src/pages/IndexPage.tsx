import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UsersContent from '../components/UsersContent'
import PointsContent from '../components/PointsContent'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import styles from './IndexPage.module.css'
import rcStyles from './RouteConfig.module.css'
import 'leaflet/dist/leaflet.css';

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Iconos inline ──────────────────────────────────────────────────────────────
const IconRoute = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
  </svg>
)
const IconList = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconTracking = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
  </svg>
)
const IconCustom = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconPoints = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
  </svg>
)
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

// ── Tipos ──────────────────────────────────────────────────────────────────────
type View = 'home' | 'route-config' | 'my-routes' | 'live-tracking' | 'users' | 'points' | 'customization' | 'settings'

// ── Contenidos de cada vista ───────────────────────────────────────────────────
function HomeContent() {
  return (
    <div className={styles.homeContent}>
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeIcon}><IconRoute /></div>
        <h1 className={styles.welcomeTitle}>Bienvenido al Dashboard</h1>
        <p className={styles.welcomeSubtitle}>Has iniciado sesión correctamente en RouteOS</p>
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#22c55e' }} />
          <div><p className={styles.statValue}>1,240</p><p className={styles.statLabel}>Vehículos en línea</p></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#60a5fa' }} />
          <div><p className={styles.statValue}>98.6%</p><p className={styles.statLabel}>Cumplimiento de ruta hoy</p></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#facc15' }} />
          <div><p className={styles.statValue}>47</p><p className={styles.statLabel}>Rutas activas ahora</p></div>
        </div>
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Waypoint {
  id: number
  point_id?: string
  name: string
  address: string
  lat: number
  lng: number
  arrival: string
  dwell: string
  isStart?: boolean
}

// ── Map helpers ────────────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function FlyToWaypoint({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { if (lat && lng) map.flyTo([lat, lng], 14, { duration: 0.8 }) }, [lat, lng, map])
  return null
}

const numberedIcon = (n: number) =>
  L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#0d1117;border:2px solid #94a3b8;color:#f1f5f9;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${n}</div>`,
  })

// ── RouteConfigContent ─────────────────────────────────────────────────────────
function RouteConfigContent() {
  const CDMX: [number, number] = [19.4326, -99.1332]
  const { token } = useAuth()
  const API = 'http://localhost:8084'

  interface VehicleData { plate: string; driver: string }
  const [vehicles,    setVehicles]    = useState<VehicleData[]>([])
  const [loadingVeh,  setLoadingVeh]  = useState(false)
  interface PointData { id: number; point_id: string; point_name: string; category: string; coordinates: [number, number]; radius: number }
  const [points,      setPoints]      = useState<PointData[]>([])
  const [pointSearch, setPointSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [routeName,   setRouteName]   = useState('')
  const [activeDays,  setActiveDays]  = useState<number[]>([0,1,2,3,4])
  const [vehicle,     setVehicle]     = useState('')
  const [operator,    setOperator]    = useState('')
  const [customOp,    setCustomOp]    = useState('')
  const [routeMode,   setRouteMode]   = useState<'search' | 'draw'>('draw')
  const [waypoints, setWaypoints]     = useState<Waypoint[]>([])
  const [flyTo,     setFlyTo]         = useState<[number, number] | null>(null)
  const [nextId,    setNextId]        = useState(1)
  const [expanded,  setExpanded]      = useState<number | null>(null)
  const [addSearch, setAddSearch]     = useState('')
  const [adding,    setAdding]        = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Load vehicles
  useEffect(() => {
    setLoadingVeh(true)
    fetch(`${API}/vehicles`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.status === 204 ? [] : r.json().then((d: { data: VehicleData[] }) => d.data ?? []))
      .then(setVehicles)
      .catch(() => {})
      .finally(() => setLoadingVeh(false))
  }, [token])

  // Load existing points
  useEffect(() => {
    fetch(`${API}/points`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.status === 204 ? { data: [] } : r.json())
      .then((d: { data: PointData[] }) => setPoints(d.data ?? []))
      .catch(() => {})
  }, [token])

  const filteredPoints = points.filter(p =>
    p.point_name.toLowerCase().includes(pointSearch.toLowerCase())
  )

  const addPointAsWaypoint = (p: PointData) => {
    const id = nextId; setNextId(n => n + 1)
    const wp: Waypoint = {
      id, lat: p.coordinates[0], lng: p.coordinates[1],
      point_id: p.point_id,
      name: p.point_name,
      address: `${p.category} · r=${p.radius}m`,
      arrival: '', dwell: '',
      isStart: waypoints.length === 0,
    }
    setWaypoints(w => [...w, wp])
    setFlyTo([p.coordinates[0], p.coordinates[1]])
    setExpanded(id)
    setPointSearch('')
    setShowDropdown(false)
  }

  // Auto-fill operator when vehicle changes
  const handleVehicleChange = (plate: string) => {
    setVehicle(plate)
    const found = vehicles.find(v => v.plate === plate)
    if (found && found.driver !== 'Sin conductor asignado') {
      setOperator(found.driver)
      setCustomOp('')
    } else {
      setOperator('')
      setCustomOp('')
    }
  }

  // Total stats
  const totalKm  = (waypoints.length * 12.4).toFixed(1)
  const totalMin = waypoints.length * 18
  const totalH   = Math.floor(totalMin / 60)
  const totalM   = totalMin % 60

  const handleMapClick = (lat: number, lng: number) => {
    if (routeMode !== 'draw') return
    const id = nextId
    setNextId(n => n + 1)
    const wp: Waypoint = {
      id, lat, lng,
      name: waypoints.length === 0 ? 'Punto de inicio' : `Waypoint ${id}`,
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      arrival: '', dwell: '',
      isStart: waypoints.length === 0,
    }
    setWaypoints(w => [...w, wp])
    setExpanded(id)
  }

  const removeWaypoint = (id: number) => {
    setWaypoints(w => w.filter(p => p.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const updateWaypoint = (id: number, field: keyof Waypoint, val: string) => {
    setWaypoints(w => w.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  const handleAddSearch = async () => {
    if (!addSearch.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addSearch)}&format=json&limit=1&countrycodes=mx`, { headers: { 'Accept-Language': 'es' } })
      const data = await res.json()
      if (data.length) {
        const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon)
        const id = nextId; setNextId(n => n + 1)
        const wp: Waypoint = {
          id, lat, lng,
          name: data[0].display_name.split(',')[0],
          address: data[0].display_name.split(',').slice(0, 2).join(','),
          arrival: '', dwell: '',
          isStart: waypoints.length === 0,
        }
        setWaypoints(w => [...w, wp])
        setFlyTo([lat, lng])
        setExpanded(id)
        setAddSearch('')
      }
    } finally { setAdding(false) }
  }

  const clearAll = () => { setWaypoints([]); setNextId(1); setExpanded(null) }

  const DAY_MAP = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const saveRoute = async () => {
    if (!routeName.trim())        return setSaveMsg({ type: 'err', text: 'Escribe un nombre para la ruta.' })
    if (!vehicle)                 return setSaveMsg({ type: 'err', text: 'Selecciona un vehículo.' })
    if (waypoints.length < 2)     return setSaveMsg({ type: 'err', text: 'Agrega al menos 2 puntos.' })
    if (activeDays.length === 0)  return setSaveMsg({ type: 'err', text: 'Selecciona al menos un día activo.' })

    const body = {
      vehicle,
      driver: operator || customOp || 'Sin operador',
      route_name: routeName.trim(),
      active_days: activeDays.sort((a,b) => a-b).map(i => DAY_MAP[i]),
      points: waypoints.map(w => ({ id: w.id, point_id: w.point_id ?? null, point_name: w.name, dwell_time: w.dwell ? parseInt(w.dwell) : 0 })),
    }

    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`${API}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.status === 409) throw new Error('Ya existe una ruta con ese nombre.')
      if (!res.ok) throw new Error(`Error al guardar (${res.status})`)
      setSaveMsg({ type: 'ok', text: '¡Ruta guardada correctamente!' })
      setTimeout(() => { clearAll(); setRouteName(''); setVehicle(''); setOperator(''); setCustomOp(''); setActiveDays([0,1,2,3,4]); setSaveMsg(null) }, 1800)
    } catch (e: any) {
      setSaveMsg({ type: 'err', text: e.message ?? 'Error al guardar la ruta.' })
    } finally {
      setSaving(false)
    }
  }

  const polyline: [number, number][] = waypoints.map(w => [w.lat, w.lng])

  return (
    <div className={rcStyles.wrapper}>
      {/* ── Left panel ── */}
      <aside className={rcStyles.leftPanel}>
        <div className={rcStyles.panelHead}>
          <h2 className={rcStyles.title}>Crear nueva ruta</h2>
          <p className={rcStyles.subtitle}>Configura y traza tu ruta</p>
        </div>

        <div className={rcStyles.scrollArea}>
          {/* Route name */}
          <div className={rcStyles.field}>
            <label className={rcStyles.label}>Nombre de la ruta</label>
            <input
              className={rcStyles.input}
              placeholder="Aeropuerto Nacional"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
            />
          </div>

          {/* Días activos */}
          <div className={rcStyles.field}>
            <label className={rcStyles.label}>Días activos</label>
            <div className={rcStyles.daysRow}>
              {['L','M','M','J','V','S','D'].map((d, i) => (
                <button
                  key={i}
                  className={`${rcStyles.dayBtn} ${activeDays.includes(i) ? rcStyles.dayActive : ''}`}
                  onClick={() => setActiveDays(prev =>
                    prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                  )}
                  title={['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle + Operator */}
          <div className={rcStyles.row}>
            <div className={rcStyles.field}>
              <label className={rcStyles.label}>Vehículo</label>
              <div className={rcStyles.selectWrap}>
                <select className={rcStyles.select} value={vehicle} onChange={e => handleVehicleChange(e.target.value)} disabled={loadingVeh}>
                  <option value="">{loadingVeh ? 'Cargando...' : 'Seleccionar'}</option>
                  {vehicles.map(v => (
                    <option key={v.plate} value={v.plate}>{v.plate.trim()}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={rcStyles.field}>
              <label className={rcStyles.label}>Operador</label>
              {operator ? (
                <div className={rcStyles.operatorFilled}>
                  <span className={rcStyles.operatorName}>{operator}</span>
                  <button className={rcStyles.operatorClear} onClick={() => setOperator('')} title="Cambiar">✕</button>
                </div>
              ) : (
                <div className={rcStyles.operatorWrap}>
                  <input
                    className={rcStyles.input}
                    placeholder="Sin operador"
                    value={customOp}
                    onChange={e => setCustomOp(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Route Mode */}
          <div className={rcStyles.field}>
            <label className={rcStyles.label}>Route Mode</label>
            <div className={rcStyles.modeCards}>
              <button
                className={`${rcStyles.modeCard} ${routeMode === 'search' ? rcStyles.modeActive : ''}`}
                onClick={() => setRouteMode('search')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                </svg>
                <span className={rcStyles.modeLabel}>Crear ruta con puntos existentes</span>
              </button>
              <button
                className={`${rcStyles.modeCard} ${routeMode === 'draw' ? rcStyles.modeActive : ''}`}
                onClick={() => setRouteMode('draw')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className={rcStyles.modeLabel}>Dibujar nueva ruta</span>
                <span className={rcStyles.modeDesc}>Da click sobre el mapa para colocar nuevos puntos.</span>
              </button>
            </div>
          </div>

          {/* Combobox puntos existentes */}
          {routeMode === 'search' && (
            <div className={rcStyles.field}>
              <label className={rcStyles.label}>Agregar punto existente</label>
              <div className={rcStyles.comboWrap}>
                <div className={rcStyles.comboInputRow}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={rcStyles.comboIcon}>
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    className={rcStyles.comboInput}
                    placeholder={points.length === 0 ? 'No hay puntos creados' : `Buscar entre ${points.length} puntos...`}
                    value={pointSearch}
                    disabled={points.length === 0}
                    onChange={e => { setPointSearch(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  />
                  {pointSearch && (
                    <button className={rcStyles.comboClear} onClick={() => { setPointSearch(''); setShowDropdown(false) }}>✕</button>
                  )}
                </div>
                {showDropdown && filteredPoints.length > 0 && (
                  <div className={rcStyles.comboDropdown}>
                    {filteredPoints.map(p => (
                      <button key={p.id} className={rcStyles.comboItem} onMouseDown={() => addPointAsWaypoint(p)}>
                        <div className={rcStyles.comboItemIcon}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className={rcStyles.comboItemInfo}>
                          <span className={rcStyles.comboItemName}>{p.point_name}</span>
                          <span className={rcStyles.comboItemMeta}>{p.category} · r={p.radius}m</span>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={rcStyles.comboItemAdd}>
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && pointSearch && filteredPoints.length === 0 && (
                  <div className={rcStyles.comboEmpty}>Sin resultados para "{pointSearch}"</div>
                )}
              </div>
            </div>
          )}

          {/* Waypoints label */}
          <div className={rcStyles.wpHeader}>
            <span className={rcStyles.label}>Waypoints</span>
            <span className={rcStyles.wpCount}>{waypoints.length}</span>
          </div>

          {/* Waypoint list */}
          <div className={rcStyles.wpList}>
            {waypoints.length === 0 && (
              <p className={rcStyles.wpEmpty}>
                {routeMode === 'draw' ? 'Haz clic en el mapa para agregar waypoints' : 'Busca una ubicación para agregarla'}
              </p>
            )}
            {waypoints.map((wp, idx) => (
              <div key={wp.id} className={`${rcStyles.wpItem} ${expanded === wp.id ? rcStyles.wpExpanded : ''}`}>
                <div className={rcStyles.wpRow} onClick={() => setExpanded(expanded === wp.id ? null : wp.id)}>
                  <span className={rcStyles.dragDot}>⠿</span>
                  <div className={rcStyles.wpBadge}>{idx + 1}</div>
                  <div className={rcStyles.wpInfo}>
                    <div className={rcStyles.wpName}>
                      {wp.name}
                      {wp.isStart && <span className={rcStyles.startTag}>Start</span>}
                    </div>
                    <div className={rcStyles.wpAddress}>{wp.address}</div>
                  </div>
                  <button className={rcStyles.chevronBtn}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: expanded === wp.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button className={rcStyles.removeBtn} onClick={e => { e.stopPropagation(); removeWaypoint(wp.id) }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                {expanded === wp.id && (
                  <div className={rcStyles.wpDetails}>
                    <div className={rcStyles.row}>
                      <div className={rcStyles.field}>
                        <label className={rcStyles.labelSm}>Arrival</label>
                        <input className={rcStyles.inputSm} type="time" value={wp.arrival} onChange={e => updateWaypoint(wp.id, 'arrival', e.target.value)} />
                      </div>
                      <div className={rcStyles.field}>
                        <label className={rcStyles.labelSm}>Dwell (min)</label>
                        <input className={rcStyles.inputSm} type="number" min="0" placeholder="0" value={wp.dwell} onChange={e => updateWaypoint(wp.id, 'dwell', e.target.value)} />
                      </div>
                    </div>
                    <div className={rcStyles.wpCoords}>{wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}</div>
                  </div>
                )}
                {idx < waypoints.length - 1 && (
                  <div className={rcStyles.wpConnector}>
                    <div className={rcStyles.connLine} />
                    <span className={rcStyles.connLabel}>12.4km · 18 min</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        {saveMsg && (
          <div className={saveMsg.type === 'ok' ? rcStyles.alertOk : rcStyles.alertErr}>
            <span className={rcStyles.alertIcon}>{saveMsg.type === 'ok' ? '✓' : '⚠'}</span>
            {saveMsg.text}
          </div>
        )}
        <div className={rcStyles.actions}>
          <button className={rcStyles.btnClear} onClick={clearAll}>Limpiar</button>
          <button className={rcStyles.btnSave} onClick={saveRoute} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar ruta'}
          </button>
        </div>
      </aside>

      {/* ── Map area ── */}
      <div className={rcStyles.mapArea}>
        <MapContainer center={CDMX} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapClickHandler onMapClick={handleMapClick} />
          {flyTo && <FlyToWaypoint lat={flyTo[0]} lng={flyTo[1]} />}
          {polyline.length > 1 && (
            <Polyline positions={polyline} pathOptions={{ color: '#38BDF8', weight: 3, opacity: 0.9 }} />
          )}
          {waypoints.map((wp, idx) => (
            <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={numberedIcon(idx + 1)}
              eventHandlers={{ click: () => { setFlyTo([wp.lat, wp.lng]); setExpanded(wp.id) } }}
            />
          ))}
        </MapContainer>

        {/* Map controls */}
        <div className={rcStyles.mapControls}>
          <button className={rcStyles.mapBtn} title="Mi ubicación">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button className={rcStyles.mapBtn} title="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
          <button className={rcStyles.mapBtn} title="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </button>
          <button className={rcStyles.mapBtn} title="Capas">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className={rcStyles.mapBtn} title="Pantalla completa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Bottom waypoint bar */}
        {waypoints.length > 0 && (
          <div className={rcStyles.bottomBar}>
            <div className={rcStyles.bottomScroll}>
              {waypoints.map((wp, idx) => (
                <div key={wp.id} className={rcStyles.bottomStep}>
                  {idx > 0 && (
                    <div className={rcStyles.bottomConnector}>
                      <div className={rcStyles.bottomLine} />
                      <span className={rcStyles.bottomDist}>12.4km · 18min</span>
                      <div className={rcStyles.bottomLine} />
                    </div>
                  )}
                  <div className={rcStyles.bottomNode} onClick={() => { setFlyTo([wp.lat, wp.lng]); setExpanded(wp.id) }}>
                    <div className={rcStyles.bottomNum}>{idx + 1}</div>
                    <span className={rcStyles.bottomName}>{wp.name.length > 8 ? wp.name.slice(0, 8) + '…' : wp.name}</span>
                  </div>
                </div>
              ))}
            </div>
            {waypoints.length > 1 && (
              <div className={rcStyles.totalBox}>
                <span className={rcStyles.totalLabel}>Total</span>
                <span className={rcStyles.totalVal}>{totalKm} km</span>
                <span className={rcStyles.totalVal}>{totalH}h {totalM}m</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className={styles.placeholderContent}>
      <p className={styles.placeholderTitle}>{title}</p>
      <p className={styles.placeholderSub}>Próximamente disponible</p>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function IndexPage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<View>('home')

  const displayName = user?.username ?? 'Usuario'
  const displayRole = user?.role ?? ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const handleLogout = () => { logout(); navigate('/login') }
  const navTo = (view: View) => setActiveView(view)

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo} onClick={() => navTo('home')}>
          <IconRoute /><span>RouteOS</span>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${activeView === 'route-config' ? styles.navActive : ''}`} onClick={() => navTo('route-config')}>
            <IconRoute /><span>Crear Rutas</span>
          </button>

          <button className={`${styles.navItem} ${activeView === 'my-routes' ? styles.navActive : ''}`} onClick={() => navTo('my-routes')}>
            <IconList /><span>My Routes</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'live-tracking' ? styles.navActive : ''}`} onClick={() => navTo('live-tracking')}>
            <IconTracking /><span>Live Tracking</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'users' ? styles.navActive : ''}`} onClick={() => navTo('users')}>
            <IconUsers /><span>Usuarios</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'points' ? styles.navActive : ''}`} onClick={() => navTo('points')}>
            <IconPoints /><span>Puntos de interés</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'customization' ? styles.navActive : ''}`} onClick={() => navTo('customization')}>
            <IconCustom /><span>Customization</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'settings' ? styles.navActive : ''}`} onClick={() => navTo('settings')}>
            <IconSettings /><span>Settings</span>
          </button>
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <IconLogout /><span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.mainWrapper}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.searchBar}>
            <IconSearch />
            <input type="text" placeholder="Search routes, users, or vehicles..." className={styles.searchInput} />
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.bellBtn}><IconBell /></button>
            <div className={styles.userChip}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userRole}>{displayRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={activeView === 'route-config' ? styles.contentFull : styles.content}>
          {activeView === 'home'          && <HomeContent />}
          {activeView === 'route-config'  && <RouteConfigContent />}
          {activeView === 'my-routes'     && <PlaceholderContent title="My Routes" />}
          {activeView === 'live-tracking' && <PlaceholderContent title="Live Tracking" />}
          {activeView === 'users'         && <UsersContent />}
          {activeView === 'points'        && <PointsContent />}
          {activeView === 'customization' && <PlaceholderContent title="Customization" />}
          {activeView === 'settings'      && <PlaceholderContent title="Settings" />}
        </main>
      </div>
    </div>
  )
}