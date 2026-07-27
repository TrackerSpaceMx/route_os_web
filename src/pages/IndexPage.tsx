import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UsersContent from '../components/UsersContent'
import PointsContent from '../components/PointsContent'
import DriversContent from '../components/DriversContent'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import styles from './IndexPage.module.css'
import rcStyles from './RouteConfig.module.css'
import listStyles from '../components/UsersContent.module.css'
import 'leaflet/dist/leaflet.css';

const API = 'http://localhost:8084'

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
const IconTripAssign = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 10h3.5l2.5 3v5h-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="7.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="17.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/>
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
const IconDrivers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
type View = 'home' | 'route-config' | 'my-routes' | 'trip-assignment' | 'live-tracking' | 'users' | 'drivers' | 'points' | 'customization' | 'settings'

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

// ── MyRoutesContent ────────────────────────────────────────────────────────────
interface RouteSummary {
  route_id: string
  route_name: string
  creation_date: string
  created_by: string
}

function formatRouteDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function routeInitials(name: string) { return name.slice(0, 2).toUpperCase() }

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

interface WaypointSummary {
  waypoint_id: string
  route_id: string
  waypoint_order: number
  waypoint_label: string
}

function MyRoutesContent({ onCreateNew, reloadToken, isAdmin }: { onCreateNew: () => void; reloadToken: number; isAdmin: boolean }) {
  const { token } = useAuth()
  const [routes,  setRoutes]  = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')

  const [viewRoute,        setViewRoute]        = useState<RouteSummary | null>(null)
  const [waypoints,        setWaypoints]        = useState<WaypointSummary[]>([])
  const [waypointsLoading, setWaypointsLoading] = useState(false)
  const [waypointsError,   setWaypointsError]   = useState<string | null>(null)

  const [deleteRoute,   setDeleteRoute]   = useState<RouteSummary | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  const fetchRoutes = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/routes`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 204) { setRoutes([]); return }
      if (!res.ok) throw new Error('Error al cargar las rutas')
      const json = await res.json()
      setRoutes(Array.isArray(json.data) ? json.data : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchRoutes() }, [token, reloadToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const openWaypoints = async (route: RouteSummary) => {
    setViewRoute(route)
    setWaypoints([])
    setWaypointsError(null)
    setWaypointsLoading(true)
    try {
      const res = await fetch(`${API}/routes/waypoints/${route.route_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 204) { setWaypoints([]); return }
      if (!res.ok) throw new Error('Error al cargar los puntos de la ruta')
      const json = await res.json()
      const data: WaypointSummary[] = Array.isArray(json.data) ? json.data : []
      setWaypoints(data.sort((a, b) => a.waypoint_order - b.waypoint_order))
    } catch (e: unknown) {
      setWaypointsError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setWaypointsLoading(false)
    }
  }

  const closeWaypoints = () => { setViewRoute(null); setWaypoints([]); setWaypointsError(null) }

  const openDeleteRoute = (route: RouteSummary) => {
    setDeleteRoute(route)
    setDeleteError(null)
  }
  const closeDeleteRoute = () => { setDeleteRoute(null); setDeleteError(null) }

  const confirmDeleteRoute = async () => {
    if (!deleteRoute) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${API}/routes/${deleteRoute.route_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo eliminar la ruta')
      setRoutes(rs => rs.filter(r => r.route_id !== deleteRoute.route_id))
      setDeleteRoute(null)
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = routes
    .filter(r =>
      r.route_name.toLowerCase().includes(search.toLowerCase()) ||
      r.created_by.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime())

  return (
    <>
      <div className={listStyles.header}>
        <div className={listStyles.headerLeft}>
          <h2>Mis Rutas</h2>
          <p>Administra las rutas configuradas para tu flotilla</p>
        </div>
        {isAdmin && (
          <button className={listStyles.btnAdd} onClick={onCreateNew}>
            <IconPlus /> Agregar Ruta
          </button>
        )}
      </div>

      <div className={listStyles.card}>
        <div className={listStyles.toolbar}>
          <div className={listStyles.searchWrap}>
            <IconSearch />
            <input
              className={listStyles.searchInput}
              type="text"
              placeholder="Buscar rutas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className={listStyles.showingText}>
            Mostrando {filtered.length} {filtered.length === 1 ? 'ruta' : 'rutas'}
          </span>
        </div>

        <table className={listStyles.table}>
          <thead>
            <tr>
              <th>Nombre</th><th>Creado por</th><th>Fecha de creación</th><th>Ver puntos de la ruta</th>
              {isAdmin && <th>Eliminar</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={listStyles.stateRow}><td colSpan={isAdmin ? 5 : 4}><span className={listStyles.spinner} />Cargando rutas...</td></tr>
            ) : error ? (
              <tr className={listStyles.stateRow}><td colSpan={isAdmin ? 5 : 4}>⚠️ {error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr className={listStyles.stateRow}><td colSpan={isAdmin ? 5 : 4}>{isAdmin ? 'No se encontraron rutas. Crea la primera con "Agregar Ruta".' : 'No se encontraron rutas.'}</td></tr>
            ) : filtered.map(route => (
              <tr key={route.route_id}>
                <td>
                  <div className={listStyles.userCell}>
                    <div className={listStyles.avatar}>{routeInitials(route.route_name)}</div>
                    <div className={listStyles.userNameText}>{route.route_name}</div>
                  </div>
                </td>
                <td>{route.created_by}</td>
                <td>{formatRouteDate(route.creation_date)}</td>
                <td>
                  <div className={listStyles.actions}>
                    <button className={listStyles.btnIcon} onClick={() => openWaypoints(route)} title="Ver puntos">
                      <IconEye />
                    </button>
                  </div>
                </td>
                {isAdmin && (
                  <td>
                    <div className={listStyles.actions}>
                      <button className={`${listStyles.btnIcon} ${listStyles.btnIconDanger}`}
                        onClick={() => openDeleteRoute(route)} title="Eliminar ruta">
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteRoute && (
        <div className={listStyles.overlay} onClick={closeDeleteRoute}>
          <div className={listStyles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={listStyles.modalTitle}>Eliminar ruta</h3>
            <p className={listStyles.deleteWarning}>
              ¿Seguro que quieres eliminar la ruta <strong>{deleteRoute.route_name}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && <p className={listStyles.errorMsg}>⚠️ {deleteError}</p>}
            <div className={listStyles.modalActions}>
              <button className={listStyles.btnCancel} onClick={closeDeleteRoute} disabled={deleting}>Cancelar</button>
              <button className={listStyles.btnDelete} onClick={confirmDeleteRoute} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewRoute && (
        <div className={listStyles.overlay} onClick={closeWaypoints}>
          <div className={listStyles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={listStyles.modalTitle}>Puntos de "{viewRoute.route_name}"</h3>

            {waypointsLoading ? (
              <div className={listStyles.stateRow}><span className={listStyles.spinner} />Cargando puntos...</div>
            ) : waypointsError ? (
              <p className={listStyles.errorMsg}>⚠️ {waypointsError}</p>
            ) : waypoints.length === 0 ? (
              <p className={listStyles.errorMsg}>Esta ruta no tiene puntos registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {waypoints.map(wp => (
                  <div
                    key={wp.waypoint_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', background: '#161c28',
                      border: '1px solid #1e2a3a', borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: '#0f2233', color: '#38BDF8', fontSize: '12px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      {wp.waypoint_order}
                    </div>
                    <span style={{ color: '#f1f5f9', fontSize: '13.5px' }}>{wp.waypoint_label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={listStyles.modalActions}>
              <button className={listStyles.btnCancel} onClick={closeWaypoints}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── RouteConfigContent ─────────────────────────────────────────────────────────
function RouteConfigContent({ onSaved }: { onSaved: () => void }) {
  const CDMX: [number, number] = [19.4326, -99.1332]
  const { token } = useAuth()

  interface PointData { id: number; point_id: string; point_name: string; category: string; coordinates: [number, number]; radius: number }
  const [points,      setPoints]      = useState<PointData[]>([])
  const [pointSearch, setPointSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [routeName,   setRouteName]   = useState('')
  const [activeDays,  setActiveDays]  = useState<number[]>([0,1,2,3,4])
  const [routeMode,   setRouteMode]   = useState<'search' | 'draw'>('draw')
  const [waypoints, setWaypoints]     = useState<Waypoint[]>([])
  const [flyTo,     setFlyTo]         = useState<[number, number] | null>(null)
  const [nextId,    setNextId]        = useState(1)
  const [expanded,  setExpanded]      = useState<number | null>(null)
  const [addSearch, setAddSearch]     = useState('')
  const [addSearchError, setAddSearchError] = useState<string | null>(null)
  const [adding,    setAdding]        = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

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
    if (waypoints.some(w => w.point_id === p.point_id)) {
      setPointSearch('')
      setShowDropdown(false)
      return
    }
    const id = nextId; setNextId(n => n + 1)
    const wp: Waypoint = {
      id, lat: p.coordinates[0], lng: p.coordinates[1],
      point_id: p.point_id,
      name: p.point_name,
      address: `${p.category} · r=${p.radius}m`,
      isStart: waypoints.length === 0,
    }
    setWaypoints(w => [...w, wp])
    setFlyTo([p.coordinates[0], p.coordinates[1]])
    setExpanded(id)
    setPointSearch('')
    setShowDropdown(false)
  }

  // Total stats
  const totalKm  = (waypoints.length * 12.4).toFixed(1)
  const totalMin = waypoints.length * 18
  const totalH   = Math.floor(totalMin / 60)
  const totalM   = totalMin % 60

  const handleMapClick = (lat: number, lng: number) => {
    if (routeMode !== 'draw') return
    if (!routeName.trim()) {
      setSaveMsg({ type: 'err', text: 'Escribe el nombre de la ruta antes de dibujar puntos.' })
      return
    }
    setSaveMsg(null)
    const id = nextId
    setNextId(n => n + 1)
    const wp: Waypoint = {
      id, lat, lng,
      name: `${routeName.trim()}${id}`,
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      isStart: waypoints.length === 0,
    }
    setWaypoints(w => [...w, wp])
    setExpanded(id)
  }

  const removeWaypoint = (id: number) => {
    setWaypoints(w => w.filter(p => p.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const handleAddSearch = async () => {
    if (!addSearch.trim()) return
    setAdding(true)
    try {
      // Detectar si es coordenadas: "19.4326, -99.1332" o "19.4326 -99.1332"
      const coordMatch = addSearch.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1])
        const lng = parseFloat(coordMatch[2])
        if (!isNaN(lat) && !isNaN(lng)) {
          if (!routeName.trim()) {
            setSaveMsg({ type: 'err', text: 'Escribe el nombre de la ruta antes de agregar puntos.' })
            setAdding(false)
            return
          }
          const id = nextId; setNextId(n => n + 1)
          const wp: Waypoint = {
            id, lat, lng,
            name: `${routeName.trim()}${id}`,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            isStart: waypoints.length === 0,
          }
          setWaypoints(w => [...w, wp])
          setFlyTo([lat, lng])
          setExpanded(id)
          setAddSearch('')
          return
        }
      }
      // Búsqueda por dirección con Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addSearch)}&format=json&limit=5&countrycodes=mx`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = await res.json()
      if (data.length) {
        const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon)
        const id = nextId; setNextId(n => n + 1)
        const wp: Waypoint = {
          id, lat, lng,
          name: data[0].display_name.split(',')[0],
          address: data[0].display_name.split(',').slice(0, 2).join(','),
          isStart: waypoints.length === 0,
        }
        setWaypoints(w => [...w, wp])
        setFlyTo([lat, lng])
        setExpanded(id)
        setAddSearch('')
      } else {
        setAddSearchError('No se encontró la dirección')
        setTimeout(() => setAddSearchError(null), 3000)
      }
    } finally { setAdding(false) }
  }

  const clearAll = () => { setWaypoints([]); setNextId(1); setExpanded(null) }

  const DAY_MAP = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const [saveMsg,   setSaveMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // ── Finalizar ruta (popup) ───────────────────────────────────────────────
  const POINT_CATEGORIES = [
    { value: 'airport',   label: 'Aeropuerto'  },
    { value: 'station',   label: 'Estación'    },
    { value: 'terminal',  label: 'Terminal'    },
    { value: 'warehouse', label: 'Almacén'     },
    { value: 'stop',      label: 'Parada'      },
    { value: 'other',     label: 'Otro'        },
  ]

  interface FinalizeRow {
    id: number
    name: string
    lat: number
    lng: number
    point_id?: string
    isNew: boolean
    category: string
    radius: string
  }

  const [showFinalize,   setShowFinalize]   = useState(false)
  const [finalizeRows,   setFinalizeRows]   = useState<FinalizeRow[]>([])
  const [finalizing,     setFinalizing]     = useState(false)
  const [finalizeError,  setFinalizeError]  = useState<string | null>(null)

  const openFinalize = () => {
    if (!routeName.trim())        return setSaveMsg({ type: 'err', text: 'Escribe un nombre para la ruta.' })
    if (waypoints.length < 2)     return setSaveMsg({ type: 'err', text: 'Agrega al menos 2 puntos.' })
    if (activeDays.length === 0)  return setSaveMsg({ type: 'err', text: 'Selecciona al menos un día activo.' })

    setSaveMsg(null)
    setFinalizeError(null)
    setFinalizeRows(waypoints.map(w => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
      point_id: w.point_id,
      isNew: !w.point_id,
      category: 'stop',
      radius: '100',
    })))
    setShowFinalize(true)
  }

  const updateFinalizeRow = (id: number, field: keyof FinalizeRow, value: string) => {
    setFinalizeRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const confirmFinalize = async () => {
    for (const r of finalizeRows) {
      if (!r.name.trim()) {
        setFinalizeError('Todos los puntos deben tener un nombre.')
        return
      }
      if (r.isNew && (!r.radius.trim() || isNaN(Number(r.radius)) || Number(r.radius) <= 0)) {
        setFinalizeError('El radio de los puntos nuevos debe ser un número mayor a 0.')
        return
      }
    }

    setFinalizing(true)
    setFinalizeError(null)

    try {
      const resolvedPoints: { id: number; point_id: string | null; point_name: string }[] = []

      for (const r of finalizeRows) {
        let pid: string | null = r.point_id ?? null

        if (r.isNew) {
          const res = await fetch(`${API}/points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              point_name:   r.name.trim(),
              category:     r.category,
              latidude:     String(r.lat),
              longitude:    String(r.lng),
              radius_meter: Number(r.radius),
            }),
          })
          if (!res.ok) {
            if (res.status === 409) {
              throw new Error(`El punto "${r.name}" ya existe. Elige otro nombre y vuelve a intentarlo.`)
            }
            throw new Error(`No se pudo crear el punto "${r.name}" (código ${res.status}).`)
          }

          const created = await res.json().catch(() => null) as { data?: { point_id?: string }; point_id?: string } | null
          pid = created?.data?.point_id ?? created?.point_id ?? null

          if (!pid) {
            // Fallback: el endpoint no devolvió el punto creado, lo buscamos por nombre + coordenadas
            const listRes = await fetch(`${API}/points`, { headers: { Authorization: `Bearer ${token}` } })
            const listJson: { data?: Record<string, unknown>[] } = listRes.status === 204 ? { data: [] } : await listRes.json()
            const match = (listJson.data ?? []).find(p =>
              p.point_name === r.name.trim() &&
              Array.isArray(p.coordinates) &&
              Math.abs(Number((p.coordinates as number[])[0]) - r.lat) < 0.001 &&
              Math.abs(Number((p.coordinates as number[])[1]) - r.lng) < 0.001
            )
            pid = (match?.point_id as string | undefined) ?? null
          }

          if (!pid) throw new Error(`El punto "${r.name}" se creó, pero no se pudo enlazar a la ruta.`)
        }

        resolvedPoints.push({
          id: r.id,
          point_id: pid,
          point_name: r.name.trim(),
        })
      }

      const body = {
        route_name: routeName.trim(),
        active_days: activeDays.sort((a,b) => a-b).map(i => DAY_MAP[i]),
        points: resolvedPoints,
      }

      const res = await fetch(`${API}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.status === 409) throw new Error(`Ya existe una ruta llamada "${routeName.trim()}". Elige otro nombre y vuelve a intentarlo.`)
      if (!res.ok) throw new Error(`Error al guardar (${res.status})`)

      setShowFinalize(false)
      setSaveMsg({ type: 'ok', text: '¡Ruta guardada correctamente!' })
      setTimeout(() => { clearAll(); setRouteName(''); setActiveDays([0,1,2,3,4]); setSaveMsg(null); onSaved() }, 1800)
    } catch (e: any) {
      setFinalizeError(e.message ?? 'Error al guardar la ruta.')
    } finally {
      setFinalizing(false)
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

          {/* Barra de búsqueda en modo dibujar */}
          {routeMode === 'draw' && (
            <div className={rcStyles.field}>
              <label className={rcStyles.label}>Buscar dirección o coordenadas</label>
              <div className={rcStyles.comboWrap}>
                <div className={rcStyles.comboInputRow}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={rcStyles.comboIcon}>
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <input
                    ref={addInputRef}
                    className={rcStyles.comboInput}
                    placeholder="Ej: Av. Insurgentes Sur 123 o 19.4326, -99.1332"
                    value={addSearch}
                    onChange={e => { setAddSearch(e.target.value); setAddSearchError(null) }}
                    onKeyDown={e => e.key === 'Enter' && handleAddSearch()}
                  />
                  {addSearch && (
                    <button className={rcStyles.comboClear} onClick={() => { setAddSearch(''); setAddSearchError(null) }}>✕</button>
                  )}
                </div>
                <button
                  className={rcStyles.btnSearchAddr}
                  onClick={handleAddSearch}
                  disabled={adding || !addSearch.trim()}
                >
                  {adding ? (
                    <span className={rcStyles.spinnerSm} />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                    </svg>
                  )}
                  {adding ? 'Buscando...' : 'Agregar punto'}
                </button>
                {addSearchError && (
                  <div className={rcStyles.comboEmpty}>{addSearchError}</div>
                )}
              </div>
            </div>
          )}

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
                    {filteredPoints.map(p => {
                      const alreadyAdded = waypoints.some(w => w.point_id === p.point_id)
                      return (
                        <button
                          key={p.id}
                          className={rcStyles.comboItem}
                          onMouseDown={() => !alreadyAdded && addPointAsWaypoint(p)}
                          disabled={alreadyAdded}
                          style={alreadyAdded ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                        >
                          <div className={rcStyles.comboItemIcon}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className={rcStyles.comboItemInfo}>
                            <span className={rcStyles.comboItemName}>{p.point_name}</span>
                            <span className={rcStyles.comboItemMeta}>
                              {p.category} · r={p.radius}m{alreadyAdded ? ' · Ya agregado' : ''}
                            </span>
                          </div>
                          {alreadyAdded ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={rcStyles.comboItemAdd}>
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
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
          <button className={rcStyles.btnSave} onClick={openFinalize}>
            Guardar ruta
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

      {/* ── Popup: finalizar ruta ── */}
      {showFinalize && (
        <div className={rcStyles.finalizeOverlay}>
          <div className={rcStyles.finalizeModal}>
            <div className={rcStyles.finalizeHeader}>
              <h3 className={rcStyles.finalizeTitle}>Finalizar ruta</h3>
              <p className={rcStyles.finalizeSubtitle}>
                Asigna un nombre a cada punto antes de guardar la ruta.
                Los puntos nuevos (dibujados o buscados) se guardarán también como puntos de interés reutilizables.
              </p>
            </div>

            <div className={rcStyles.finalizeBody}>
              {finalizeRows.map((r, idx) => (
                <div key={r.id} className={rcStyles.finalizeRow}>
                  <div className={rcStyles.finalizeRowTop}>
                    <div className={rcStyles.wpBadge}>{idx + 1}</div>
                    <span className={r.isNew ? rcStyles.finalizeTagNew : rcStyles.finalizeTagExisting}>
                      {r.isNew ? 'Punto nuevo' : 'Punto existente'}
                    </span>
                  </div>

                  <div className={rcStyles.field}>
                    <label className={rcStyles.labelSm}>Nombre</label>
                    <input
                      className={rcStyles.inputSm}
                      value={r.name}
                      onChange={e => updateFinalizeRow(r.id, 'name', e.target.value)}
                      placeholder="Nombre del punto"
                    />
                  </div>

                  {r.isNew && (
                    <div className={rcStyles.row}>
                      <div className={rcStyles.field}>
                        <label className={rcStyles.labelSm}>Categoría</label>
                        <div className={rcStyles.selectWrap}>
                          <select
                            className={rcStyles.select}
                            value={r.category}
                            onChange={e => updateFinalizeRow(r.id, 'category', e.target.value)}
                          >
                            {POINT_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className={rcStyles.field}>
                        <label className={rcStyles.labelSm}>Radio (m)</label>
                        <input
                          className={rcStyles.inputSm}
                          type="number"
                          min="1"
                          value={r.radius}
                          onChange={e => updateFinalizeRow(r.id, 'radius', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {finalizeError && (
              <div className={rcStyles.finalizeErr}>
                <span className={rcStyles.alertIcon}>⚠</span>{finalizeError}
              </div>
            )}

            <div className={rcStyles.finalizeActions}>
              <button className={rcStyles.finalizeBtnCancel} onClick={() => setShowFinalize(false)} disabled={finalizing}>
                Cancelar
              </button>
              <button className={rcStyles.finalizeBtnConfirm} onClick={confirmFinalize} disabled={finalizing}>
                {finalizing ? 'Guardando…' : 'Confirmar y guardar ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [activeView, setActiveView] = useState<View>('my-routes')
  const [routesReloadToken, setRoutesReloadToken] = useState(0)
  const isAdmin = user?.role === 'admin'

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
          {isAdmin && (
            <button className={`${styles.navItem} ${activeView === 'route-config' ? styles.navActive : ''}`} onClick={() => navTo('route-config')}>
              <IconRoute /><span>Crear Rutas</span>
            </button>
          )}

          <button className={`${styles.navItem} ${activeView === 'my-routes' ? styles.navActive : ''}`} onClick={() => navTo('my-routes')}>
            <IconList /><span>Mis Rutas</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'trip-assignment' ? styles.navActive : ''}`} onClick={() => navTo('trip-assignment')}>
            <IconTripAssign /><span>Asignación de Viajes</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'live-tracking' ? styles.navActive : ''}`} onClick={() => navTo('live-tracking')}>
            <IconTracking /><span>Live Tracking</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'users' ? styles.navActive : ''}`} onClick={() => navTo('users')}>
            <IconUsers /><span>Usuarios</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'drivers' ? styles.navActive : ''}`} onClick={() => navTo('drivers')}>
            <IconDrivers /><span>Conductores</span>
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
          {activeView === 'route-config' && isAdmin && (
            <RouteConfigContent
              onSaved={() => { setRoutesReloadToken(n => n + 1); navTo('my-routes') }}
            />
          )}
          {activeView === 'my-routes'     && (
            <MyRoutesContent
              onCreateNew={() => navTo('route-config')}
              reloadToken={routesReloadToken}
              isAdmin={isAdmin}
            />
          )}
          {activeView === 'trip-assignment' && <PlaceholderContent title="Asignación de Viajes" />}
          {activeView === 'live-tracking' && <PlaceholderContent title="Live Tracking" />}
          {activeView === 'users'         && <UsersContent />}
          {activeView === 'drivers'       && <DriversContent />}
          {activeView === 'points'        && <PointsContent />}
          {activeView === 'customization' && <PlaceholderContent title="Customization" />}
          {activeView === 'settings'      && <PlaceholderContent title="Settings" />}
        </main>
      </div>
    </div>
  )
}