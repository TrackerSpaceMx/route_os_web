import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UsersContent from '../components/UsersContent'
import PointsContent from '../components/PointsContent'
import DriversContent from '../components/DriversContent'
import TripAssignmentContent from '../components/TripAssignmentContent'
import MonitoringContent from '../components/MonitoringContent'
import ProtocolsContent from '../components/ProtocolsContent'
import Sidebar, { VIEW_TITLES } from '../components/Sidebar'
import type { View } from '../components/Sidebar'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import styles from './IndexPage.module.css'
import cv from './RouteConfigView.module.css'
import ui from '../components/UsersView.module.css'   // layout, filtros, tabla, paginación (mismo diseño que Conductores/Puntos)
import m  from '../components/UsersModal.module.css'  // modales
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

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length < 2) return
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true })
  }, [positions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const numberedIcon = (n: number) =>
  L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);border:2.5px solid #fff;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(29,78,216,0.55),0 1px 3px rgba(0,0,0,0.3);cursor:grab">${n}</div>`,
  })

// Icono para puntos existentes en el mapa (no agregados aún)
const existingPointIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#0f172a;border:2.5px solid #38bdf8;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(56,189,248,0.4);cursor:pointer">
    <div style="width:7px;height:7px;border-radius:50%;background:#38bdf8"></div>
  </div>`,
})

// Icono para puntos existentes ya agregados a la ruta
const existingPointAddedIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#0f172a;border:2.5px solid #4ade80;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(74,222,128,0.4)">
    <div style="width:7px;height:7px;border-radius:50%;background:#4ade80"></div>
  </div>`,
})

// Icono semitransparente para puntos medios arrastrables
const midpointIcon = L.divIcon({
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: `<div style="width:16px;height:16px;border-radius:50%;background:white;border:3px solid #3b82f6;box-shadow:0 1px 6px rgba(59,130,246,0.6);cursor:grab;opacity:0.85;transition:opacity 0.15s"></div>`,
})

// ── Muestra puntos existentes en el mapa al hacer zoom ───────────────────────
interface PointData2 { point_id: string; point_name: string; category: string; coordinates: [number, number]; radius: number }
function MapPoints({
  points, waypoints, onAdd
}: {
  points: PointData2[]
  waypoints: { point_id?: string }[]
  onAdd: (p: PointData2) => void
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoom: () => setZoom(map.getZoom()) })

  if (zoom < 13) return null

  return (
    <>
      {points.map(p => {
        const added = waypoints.some(w => w.point_id === p.point_id)
        return (
          <Marker
            key={p.point_id}
            position={p.coordinates}
            icon={added ? existingPointAddedIcon : existingPointIcon}
            eventHandlers={{
              click: () => { if (!added) onAdd(p) }
            }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <strong>{p.point_name}</strong>
              <br />
              {p.category} · r={p.radius}m{added ? ' · en la ruta' : ''}
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}

// ── Corredor visual (ancho en metros, escalado por zoom) ──────────────────────
function CorridorPolyline({ positions, widthMeters }: { positions: [number, number][]; widthMeters: number }) {
  const map = useMap()
  const [weight, setWeight] = useState(20)

  const recalc = useCallback(() => {
    if (positions.length < 2) return
    const zoom = map.getZoom()
    const lat = positions[Math.floor(positions.length / 2)][0]
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
    setWeight(Math.max(6, Math.round((widthMeters * 2) / mpp)))
  }, [map, positions, widthMeters])

  useEffect(() => { recalc() }, [recalc])
  useMapEvents({ zoom: recalc, moveend: recalc })

  if (positions.length < 2) return null
  return (
    <Polyline
      positions={positions}
      pathOptions={{ color: '#3b82f6', weight, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }}
    />
  )
}

// Distancia en línea recta entre dos coordenadas (km)
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

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

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

const ROUTES_PAGE_SIZE = 8

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
  const [page,    setPage]    = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROUTES_PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * ROUTES_PAGE_SIZE, page * ROUTES_PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const colSpan = isAdmin ? 4 : 3

  return (
    <>
      <div className={ui.page}>
        {/* Encabezado */}
        <div className={ui.header}>
          <div>
            <h2 className={ui.title}>Mis rutas</h2>
            <p className={ui.subtitle}>
              {loading ? 'Cargando...' : `${routes.length} ${routes.length === 1 ? 'ruta registrada' : 'rutas registradas'}`}
            </p>
          </div>
          {isAdmin && (
            <button className={ui.btnPrimary} onClick={onCreateNew}>
              <IconPlus /> Nueva Ruta
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className={ui.filters}>
          <label className={ui.searchWrap}>
            <IconSearch />
            <input
              className={ui.searchInput}
              type="text"
              placeholder="Buscar por nombre de ruta o creador..."
              aria-label="Buscar rutas"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Tabla */}
        <div className={ui.tableCard}>
          <div className={ui.tableScroll}>
            <table className={ui.table} style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Creado por</th>
                  <th>Fecha de creación</th>
                  {isAdmin && <th className={ui.thActions}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}><span className={ui.spinner} />Cargando rutas...</td>
                  </tr>
                ) : error ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}>⚠️ {error}</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}>
                      No se encontraron rutas
                      <span className={ui.stateHint}>
                        {isAdmin && routes.length === 0
                          ? 'Crea la primera con "Nueva Ruta".'
                          : 'Prueba con otro nombre de ruta o creador.'}
                      </span>
                    </td>
                  </tr>
                ) : paginated.map(route => (
                  <tr
                    key={route.route_id}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    aria-label={`Ver puntos de ${route.route_name}`}
                    onClick={() => openWaypoints(route)}
                    onKeyDown={e => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWaypoints(route) }
                    }}
                  >
                    <td>
                      <div className={ui.userCell}>
                        <div className={ui.avatar}>{routeInitials(route.route_name)}</div>
                        <div className={ui.userName}>{route.route_name}</div>
                      </div>
                    </td>
                    <td>{route.created_by}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatRouteDate(route.creation_date)}</td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className={ui.actions}>
                          <button
                            className={ui.action}
                            title="Ver puntos de la ruta"
                            aria-label={`Ver puntos de ${route.route_name}`}
                            onClick={() => openWaypoints(route)}
                          >
                            <IconEye />
                          </button>
                          <button
                            className={`${ui.action} ${ui.actionDanger}`}
                            title="Eliminar ruta"
                            aria-label={`Eliminar ${route.route_name}`}
                            onClick={() => openDeleteRoute(route)}
                          >
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

          {filtered.length > ROUTES_PAGE_SIZE && (
            <div className={ui.pagination}>
              <span className={ui.pageInfo}>
                Página {page} de {totalPages} · {filtered.length} rutas
              </span>
              <div className={ui.pageButtons}>
                <button className={ui.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                <button className={ui.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: eliminar ruta ── */}
      {deleteRoute && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !deleting) closeDeleteRoute() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="alertdialog" aria-modal="true" aria-labelledby="route-delete-title">
            <div className={m.header}>
              <h2 id="route-delete-title" className={m.title}>Eliminar ruta</h2>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeDeleteRoute} disabled={deleting}><IconClose /></button>
            </div>
            <div className={m.body}>
              <p className={m.message}>
                ¿Estás seguro de que deseas eliminar la ruta <strong>{deleteRoute.route_name}</strong>?
                Esta acción no se puede deshacer.
              </p>
              {deleteError && <p className={m.error} role="alert">{deleteError}</p>}
            </div>
            <div className={m.footer}>
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeDeleteRoute} disabled={deleting}>Cancelar</button>
              <button type="button" className={`${m.btn} ${m.btnDanger}`} onClick={confirmDeleteRoute} disabled={deleting}>
                <IconTrash />
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: puntos de la ruta ── */}
      {viewRoute && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget) closeWaypoints() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="dialog" aria-modal="true" aria-labelledby="route-points-title">
            <div className={m.header}>
              <div>
                <h2 id="route-points-title" className={m.title}>Puntos de la ruta</h2>
                <p className={m.subtitle}>{viewRoute.route_name}</p>
              </div>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeWaypoints}><IconClose /></button>
            </div>
            <div className={m.body}>
              {waypointsLoading ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#8b97ad' }}>
                  <span className={ui.spinner} />Cargando puntos...
                </div>
              ) : waypointsError ? (
                <p className={m.error} role="alert">{waypointsError}</p>
              ) : waypoints.length === 0 ? (
                <p className={m.message}>Esta ruta no tiene puntos registrados.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                  {waypoints.map(wp => (
                    <div
                      key={wp.waypoint_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', background: '#222527',
                        border: '1px solid #27374c', borderRadius: '8px',
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
            </div>
            <div className={m.footer}>
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeWaypoints}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── RouteConfigContent ─────────────────────────────────────────────────────────
function RouteConfigContent({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const CDMX: [number, number] = [19.4326, -99.1332]
  const { token } = useAuth()

  interface PointData { id: number; point_id: string; point_name: string; category: string; coordinates: [number, number]; radius: number }
  const [points,      setPoints]      = useState<PointData[]>([])
  const [pointSearch, setPointSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [routeName,   setRouteName]   = useState('')
  const [routeMode,   setRouteMode]   = useState<'search' | 'draw'>('draw')
  const [waypoints, setWaypoints]     = useState<Waypoint[]>([])
  const [flyTo,     setFlyTo]         = useState<[number, number] | null>(null)
  const [nextId,    setNextId]        = useState(1)
  const [expanded,  setExpanded]      = useState<number | null>(null)
  const [addSearch, setAddSearch]     = useState('')
  const [addSearchError, setAddSearchError] = useState<string | null>(null)
  const [adding,    setAdding]        = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [mapExpanded,   setMapExpanded]   = useState(false)
  const [showCorridor,  setShowCorridor]  = useState(false)
  // Mostrar/ocultar los puntos de interés ya guardados (GET /points) sobre el mapa
  const [showExisting,  setShowExisting]  = useState(true)
  const [corridorWidth, setCorridorWidth] = useState(10)
  const [mapSearch,   setMapSearch]   = useState('')
  const [mapSearching, setMapSearching] = useState(false)
  const [mapSearchError, setMapSearchError] = useState<string | null>(null)
  // Menú contextual (click derecho sobre marcador)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; wpId: number } | null>(null)

  // Campos del encabezado que se envían en POST /routes (ver confirmFinalize).
  interface ClientOption { id: string | number; name: string }
  const [clients,   setClients]   = useState<ClientOption[]>([])
  const [clientId,  setClientId]  = useState('')

  // Load existing points
  useEffect(() => {
    fetch(`${API}/points`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.status === 204 ? { data: [] } : r.json())
      .then((d: { data: PointData[] }) => setPoints(d.data ?? []))
      .catch(() => {})
  }, [token])

  // Load companies (mismo endpoint que Usuarios)
  useEffect(() => {
    fetch(`${API}/clients-assinged`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { data: [] })
      .then((d: { data?: ClientOption[] }) => {
        const list = Array.isArray(d.data) ? d.data : []
        setClients(list)
        if (list.length === 1) setClientId(String(list[0].id))
      })
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

  // Tramos y totales (línea recta, 30 km/h de promedio urbano)
  const legs = waypoints.slice(1).map((w, i) => {
    const km = haversineKm(waypoints[i], w)
    return { km, min: Math.max(1, Math.round((km / 30) * 60)) }
  })
  const totalKm  = legs.reduce((acc, l) => acc + l.km, 0)
  const totalMin = legs.reduce((acc, l) => acc + l.min, 0)

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

  const resetHeader = () => {
    setRouteName('')
    if (clients.length !== 1) setClientId('')
  }

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

  const handleMapSearch = async () => {
    if (!mapSearch.trim()) return
    setMapSearching(true)
    setMapSearchError(null)
    try {
      const coordMatch = mapSearch.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]), lng = parseFloat(coordMatch[2])
        if (!isNaN(lat) && !isNaN(lng)) { setFlyTo([lat, lng]); setMapSearch(''); return }
      }
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearch)}&format=json&limit=1&countrycodes=mx`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = await res.json()
      if (data.length) {
        setFlyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        setMapSearch('')
      } else {
        setMapSearchError('Dirección no encontrada')
        setTimeout(() => setMapSearchError(null), 3000)
      }
    } catch { setMapSearchError('Error al buscar') }
    finally { setMapSearching(false) }
  }

  const openFinalize = () => {
    setSubmitted(true)
    if (!routeName.trim())             return setSaveMsg({ type: 'err', text: 'Escribe un nombre para la ruta.' })
    if (clients.length > 0 && !clientId) return setSaveMsg({ type: 'err', text: 'Selecciona una empresa.' })
    if (waypoints.length < 2)          return setSaveMsg({ type: 'err', text: 'Agrega al menos 2 puntos a la ruta.' })

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

      for (const [idx, r] of finalizeRows.entries()) {
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
          id: idx + 1,
          point_id: pid,
          point_name: r.name.trim(),
        })
      }

      // Empresa elegida (el id se envía tal cual lo devuelve la API)
      const client = clients.find(c => String(c.id) === clientId)

      const body = {
        route_name: routeName.trim(),
        points: resolvedPoints,
        client_id: client?.id ?? null,
        client_name: client?.name ?? null,
        // La ubicación de inicio es el point_id del primer punto de la ruta
        starting_location: resolvedPoints[0]?.point_id ?? null,
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
      setTimeout(() => { clearAll(); resetHeader(); setSaveMsg(null); setSubmitted(false); onSaved() }, 1800)
    } catch (e: any) {
      setFinalizeError(e.message ?? 'Error al guardar la ruta.')
    } finally {
      setFinalizing(false)
    }
  }

  const polyline: [number, number][] = waypoints.map(w => [w.lat, w.lng])
  const nameMissing    = submitted && !routeName.trim()
  const clientMissing  = submitted && clients.length > 0 && !clientId
  const pointsMissing  = submitted && waypoints.length < 2

  const goTo = (wp: Waypoint) => { setFlyTo([wp.lat, wp.lng]); setExpanded(wp.id) }

  return (
    <div className={cv.page}>
      <header className={cv.header}>
        <h2 className={cv.title}>Crear nueva ruta</h2>
        <p className={cv.subtitle}>Captura los datos generales, traza el recorrido y fija el radio de llegada de cada punto.</p>
      </header>

      {/* ── Información general ── */}
      <section className={cv.card}>
        <div className={cv.cardHead}>
          <span className={cv.cardIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
            </svg>
          </span>
          <h3 className={cv.cardTitle}>Información general</h3>
        </div>
        <div className={cv.cardBody}>
          <div className={cv.grid}>
            <div className={`${cv.field} ${cv.span2}`}>
              <label className={cv.label} htmlFor="route-name">Nombre de la ruta<span className={cv.req}>*</span></label>
              <input
                id="route-name"
                className={`${cv.input} ${nameMissing ? cv.inputInvalid : ''}`}
                placeholder="Ej. Aeropuerto Nacional"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
                aria-invalid={nameMissing}
              />
              {nameMissing && <p className={cv.error}>Escribe un nombre para la ruta</p>}
            </div>

            <div className={cv.field}>
              <label className={cv.label} htmlFor="route-company">
                Empresa{clients.length > 0 && <span className={cv.req}>*</span>}
              </label>
              <div className={cv.inputWrap}>
                <span className={cv.inputIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
                  </svg>
                </span>
                <select
                  id="route-company"
                  className={`${cv.select} ${cv.selectWithIcon} ${clientMissing ? cv.inputInvalid : ''}`}
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  disabled={clients.length === 0}
                  aria-invalid={clientMissing}
                >
                  <option value="">{clients.length === 0 ? 'Sin empresas disponibles' : 'Selecciona una empresa'}</option>
                  {clients.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
              {clientMissing && <p className={cv.error}>Selecciona una empresa</p>}
            </div>

            <div className={cv.field}>
              <label className={cv.label} htmlFor="route-start">Ubicación de inicio</label>
              <div className={cv.inputWrap}>
                <span className={cv.inputIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <input
                  id="route-start"
                  className={`${cv.input} ${cv.inputWithIcon} ${cv.inputReadonly}`}
                  value={waypoints[0]?.name ?? ''}
                  placeholder="Se completa con el primer punto"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ruta y geocercas ── */}
      <section className={cv.card}>
        <div className={cv.cardHead}>
          <span className={cv.cardIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" />
            </svg>
          </span>
          <div>
            <h3 className={cv.cardTitle}>Ruta y geocercas</h3>
            <p className={cv.cardHint}>Cada punto se convierte en una geocerca con radio de llegada.</p>
          </div>
        </div>

        <div className={cv.builder}>
          {/* Panel izquierdo */}
          <div className={cv.panel}>
            <div className={cv.panelTop}>
              <div className={cv.segmented} role="group" aria-label="Modo de ruta">
                <button type="button" className={`${cv.segBtn} ${routeMode === 'draw' ? cv.segOn : ''}`} onClick={() => setRouteMode('draw')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  Dibujar en mapa
                </button>
                <button type="button" className={`${cv.segBtn} ${routeMode === 'search' ? cv.segOn : ''}`} onClick={() => setRouteMode('search')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  Puntos existentes
                </button>
              </div>

              {routeMode === 'draw' ? (
                <div className={cv.field}>
                  <div className={cv.searchRow}>
                    <div className={cv.inputWrap}>
                      <span className={cv.inputIcon}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                      </span>
                      <input
                        ref={addInputRef}
                        className={`${cv.input} ${cv.inputWithIcon} ${addSearch ? cv.hasClear : ''}`}
                        placeholder="Dirección o 19.4326, -99.1332"
                        aria-label="Buscar dirección o coordenadas"
                        value={addSearch}
                        onChange={e => { setAddSearch(e.target.value); setAddSearchError(null) }}
                        onKeyDown={e => e.key === 'Enter' && handleAddSearch()}
                      />
                      {addSearch && (
                        <button type="button" className={cv.clearBtn} aria-label="Borrar búsqueda" onClick={() => { setAddSearch(''); setAddSearchError(null) }}>✕</button>
                      )}
                    </div>
                    <button type="button" className={`${cv.btn} ${cv.btnPrimary} ${cv.btnSm}`} onClick={handleAddSearch} disabled={adding || !addSearch.trim()}>
                      {adding ? <span className={cv.spinner} /> : 'Agregar'}
                    </button>
                  </div>
                  {addSearchError
                    ? <p className={cv.error}>{addSearchError}</p>
                    : <p className={cv.hint}>También puedes hacer clic en el mapa para colocar puntos.</p>}
                </div>
              ) : (
                <div className={cv.field}>
                  <div className={cv.inputWrap}>
                    <span className={cv.inputIcon}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    </span>
                    <input
                      className={`${cv.input} ${cv.inputWithIcon}`}
                      placeholder={points.length === 0 ? 'No hay puntos creados' : `Buscar entre ${points.length} puntos`}
                      aria-label="Buscar punto existente"
                      value={pointSearch}
                      disabled={points.length === 0}
                      onChange={e => { setPointSearch(e.target.value); setShowDropdown(true) }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    />
                    {showDropdown && filteredPoints.length > 0 && (
                      <div className={cv.dropdown}>
                        {filteredPoints.map(p => {
                          const already = waypoints.some(w => w.point_id === p.point_id)
                          return (
                            <button key={p.id} type="button" className={cv.dropItem} disabled={already} onMouseDown={() => !already && addPointAsWaypoint(p)}>
                              <span className={cv.dropInfo}>
                                <span className={cv.dropName}>{p.point_name}</span>
                                <span className={cv.dropMeta}>{p.category} · radio {p.radius} m{already ? ' · ya agregado' : ''}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {showDropdown && pointSearch && filteredPoints.length === 0 && (
                      <div className={cv.dropdown}><div className={cv.dropEmpty}>Sin resultados para "{pointSearch}"</div></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={cv.listHead}>
              <span className={cv.listTitle}>
                Puntos de la ruta<span className={cv.req}>*</span>
              </span>
              <span className={`${cv.count} ${pointsMissing ? cv.countErr : ''}`}>{waypoints.length}</span>
            </div>

            <div className={cv.list}>
              {waypoints.length === 0 && (
                <p className={`${cv.empty} ${pointsMissing ? cv.emptyErr : ''}`}>
                  {pointsMissing
                    ? 'Agrega al menos 2 puntos para poder guardar la ruta.'
                    : routeMode === 'draw'
                      ? 'Aún no hay puntos. Haz clic en el mapa o busca una dirección para empezar.'
                      : 'Aún no hay puntos. Busca uno de tus puntos de interés para agregarlo.'}
                </p>
              )}
              {waypoints.length === 1 && pointsMissing && (
                <p className={cv.emptyErr} style={{ padding: '0 16px 10px', fontSize: 12 }}>
                  Agrega al menos un punto más.
                </p>
              )}
              {waypoints.map((wp, idx) => (
                <div key={wp.id}>
                  <div className={`${cv.stop} ${expanded === wp.id ? cv.stopOn : ''}`}>
                    <div className={cv.stopRow} onClick={() => setExpanded(expanded === wp.id ? null : wp.id)}>
                      <span className={cv.badge}>{idx + 1}</span>
                      <div className={cv.stopInfo}>
                        <div className={cv.stopName}>
                          <span>{wp.name}</span>
                          {wp.isStart && <span className={cv.tag}>Inicio</span>}
                        </div>
                        <div className={cv.stopAddr}>{wp.address}</div>
                      </div>
                      <button type="button" className={`${cv.iconBtn} ${cv.iconBtnDanger}`} aria-label={`Quitar ${wp.name}`} onClick={e => { e.stopPropagation(); removeWaypoint(wp.id) }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                    {expanded === wp.id && (
                      <div className={cv.stopDetails}>
                        {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
                        <div style={{ marginTop: 8 }}>
                          <button type="button" className={`${cv.btn} ${cv.btnGhost} ${cv.btnSm}`} onClick={() => setFlyTo([wp.lat, wp.lng])}>Ver en el mapa</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {legs[idx] && (
                    <div className={cv.stopLeg}>{legs[idx].km.toFixed(1)} km · {formatDuration(legs[idx].min)}</div>
                  )}
                </div>
              ))}
            </div>

            <div className={cv.panelFoot}>
              <button type="button" className={`${cv.btn} ${cv.btnGhost}`} onClick={clearAll} disabled={waypoints.length === 0}>Quitar todos los puntos</button>
            </div>
          </div>

          {/* Mapa */}
          <div className={`${cv.mapArea} ${mapExpanded ? cv.mapAreaExpanded : ''}`}
            onClick={() => ctxMenu && setCtxMenu(null)}>

            {/* ── Buscador flotante ── */}
            <div className={cv.mapSearchBar}>
              <div className={cv.mapSearchWrap}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b97ad" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  className={cv.mapSearchInput}
                  placeholder="Buscar dirección en el mapa…"
                  value={mapSearch}
                  onChange={e => { setMapSearch(e.target.value); setMapSearchError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
                />
                {mapSearch && (
                  <button type="button" className={cv.mapSearchClear} onClick={() => setMapSearch('')}>✕</button>
                )}
              </div>
              <button
                type="button"
                className={cv.mapSearchBtn}
                onClick={handleMapSearch}
                disabled={mapSearching || !mapSearch.trim()}
              >
                {mapSearching
                  ? <span className={cv.spinner} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                }
              </button>
              {mapSearchError && <span className={cv.mapSearchErr}>{mapSearchError}</span>}
            </div>

            {/* ── Menú contextual (click derecho en marcador) ── */}
            {ctxMenu && (
              <div
                className={cv.ctxMenu}
                style={{ top: ctxMenu.y, left: ctxMenu.x }}
                onMouseLeave={() => setCtxMenu(null)}
              >
                <button
                  type="button"
                  className={cv.ctxItem}
                  onClick={() => { removeWaypoint(ctxMenu.wpId); setCtxMenu(null) }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </svg>
                  Quitar punto
                </button>
              </div>
            )}

            <MapContainer ref={setMap} center={CDMX} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapClickHandler onMapClick={handleMapClick} />
              {flyTo && <FlyToWaypoint lat={flyTo[0]} lng={flyTo[1]} />}
              {/* Puntos existentes visibles al hacer zoom ≥ 13 */}
              {showExisting && (
                <MapPoints
                  points={points}
                  waypoints={waypoints}
                  onAdd={addPointAsWaypoint}
                />
              )}

              {/* Corredor visual */}
              {showCorridor && polyline.length > 1 && (
                <CorridorPolyline positions={polyline} widthMeters={corridorWidth} />
              )}

              {polyline.length > 1 && (
                <>
                  {/* Sombra de la línea */}
                  <Polyline positions={polyline} pathOptions={{ color: '#1e40af', weight: 10, opacity: 0.18 }} />
                  {/* Línea principal */}
                  <Polyline positions={polyline} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />
                  {/* Brillo central */}
                  <Polyline positions={polyline} pathOptions={{ color: '#93c5fd', weight: 1.5, opacity: 0.7 }} />
                </>
              )}

              {/* Puntos medios arrastrables (modo dibujar) */}
              {routeMode === 'draw' && waypoints.length >= 2 && waypoints.slice(1).map((wp, idx) => {
                const prev = waypoints[idx]
                const midLat = (prev.lat + wp.lat) / 2
                const midLng = (prev.lng + wp.lng) / 2
                return (
                  <Marker
                    key={`mid-${prev.id}-${wp.id}`}
                    position={[midLat, midLng]}
                    icon={midpointIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const latlng = (e.target as L.Marker).getLatLng()
                        const newWp: Waypoint = {
                          id: nextId,
                          lat: latlng.lat,
                          lng: latlng.lng,
                          name: `${routeName.trim() || 'P'}${nextId}`,
                          address: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
                          isStart: false,
                        }
                        setNextId(n => n + 1)
                        setWaypoints(wps => [
                          ...wps.slice(0, idx + 1),
                          newWp,
                          ...wps.slice(idx + 1),
                        ])
                      }
                    }}
                  />
                )
              })}

              {/* Marcadores numerados arrastrables */}
              {waypoints.map((wp, idx) => (
                <Marker
                  key={wp.id}
                  position={[wp.lat, wp.lng]}
                  icon={numberedIcon(idx + 1)}
                  draggable={routeMode === 'draw'}
                  eventHandlers={{
                    click: () => goTo(wp),
                    contextmenu: (e) => {
                      e.originalEvent.preventDefault()
                      const mapEl = (e.target as L.Marker)._map?.getContainer()
                      if (!mapEl) return
                      const rect = mapEl.getBoundingClientRect()
                      setCtxMenu({
                        x: e.originalEvent.clientX - rect.left,
                        y: e.originalEvent.clientY - rect.top,
                        wpId: wp.id,
                      })
                    },
                    dragend: (e) => {
                      const latlng = (e.target as L.Marker).getLatLng()
                      setWaypoints(wps => wps.map(w =>
                        w.id === wp.id
                          ? { ...w, lat: latlng.lat, lng: latlng.lng, address: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}` }
                          : w
                      ))
                    }
                  }}
                />
              ))}
            </MapContainer>

            {routeMode === 'draw' && <div className={cv.mapHint}>Haz clic · <kbd style={{fontSize:'11px',opacity:.7}}>clic derecho</kbd> para borrar</div>}
            {points.length > 0 && <div className={cv.mapZoomHint}>Acerca el mapa (zoom 13+) para ver los puntos existentes</div>}

            {/* ── Panel corredor ── */}
            {polyline.length > 1 && (
              <div className={cv.corridorPanel}>
                <button
                  type="button"
                  className={`${cv.corridorToggle} ${showCorridor ? cv.corridorOn : ''}`}
                  onClick={() => setShowCorridor(v => !v)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M3 12h18M3 6h18M3 18h18"/>
                  </svg>
                  Corredor
                  <span className={cv.corridorBadge}>{corridorWidth} m</span>
                </button>
                {showCorridor && (
                  <div className={cv.corridorSliderWrap}>
                    <span className={cv.corridorMin}>10 m</span>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={1}
                      value={corridorWidth}
                      onChange={e => setCorridorWidth(Number(e.target.value))}
                      className={cv.corridorSlider}
                      aria-label="Ancho del corredor en metros"
                    />
                    <span className={cv.corridorMax}>50 m</span>
                  </div>
                )}
              </div>
            )}

            <div className={cv.mapControls}>
              {/* Expandir / contraer — siempre visible */}
              <button
                type="button"
                className={cv.mapBtnExpand}
                aria-label={mapExpanded ? 'Contraer mapa' : 'Expandir mapa'}
                title={mapExpanded ? 'Contraer' : 'Expandir mapa'}
                onClick={() => { setMapExpanded(e => !e); setTimeout(() => map?.invalidateSize(), 50) }}
              >
                {mapExpanded
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                }
              </button>
              {/* Mostrar / ocultar puntos de interés guardados */}
              <button
                type="button"
                className={cv.mapBtnExpand}
                aria-label={showExisting ? 'Ocultar puntos guardados' : 'Mostrar puntos guardados'}
                aria-pressed={showExisting}
                title={showExisting ? 'Ocultar puntos guardados' : 'Mostrar puntos guardados'}
                style={showExisting ? { color: '#60a5fa', borderColor: '#3b82f6' } : undefined}
                onClick={() => setShowExisting(v => !v)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                  {!showExisting && <path d="M3 3l18 18" />}
                </svg>
              </button>
              <div className={cv.mapBtnGroup}>
                <button type="button" className={cv.mapBtn} aria-label="Acercar" onClick={() => map?.zoomIn()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                <button type="button" className={cv.mapBtn} aria-label="Alejar" onClick={() => map?.zoomOut()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
              </div>
            </div>

            {waypoints.length > 0 && (
              <div className={cv.legs}>
                <div className={cv.legsHead}>
                  <span>Tramos de la ruta</span>
                  {waypoints.length > 1 && <span><strong>{totalKm.toFixed(1)} km</strong> · {formatDuration(totalMin)} de manejo</span>}
                </div>
                <div className={cv.legsScroll}>
                  {waypoints.map((wp, idx) => (
                    <div key={wp.id} className={cv.legStep}>
                      {idx > 0 && legs[idx - 1] && (
                        <div className={cv.legConn}>
                          <span>{legs[idx - 1].km.toFixed(1)} km · {formatDuration(legs[idx - 1].min)}</span>
                          <span className={cv.legLine} />
                        </div>
                      )}
                      <button type="button" className={cv.legNode} onClick={() => goTo(wp)}>
                        <span className={cv.badge}>{idx + 1}</span>
                        <span className={cv.legName}>{wp.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {saveMsg && (
        <div className={`${cv.alert} ${saveMsg.type === 'ok' ? cv.alertOk : cv.alertErr}`} role="status">
          <span aria-hidden="true">{saveMsg.type === 'ok' ? '✓' : '⚠'}</span>
          {saveMsg.text}
        </div>
      )}

      <div className={cv.footerActions}>
        <button type="button" className={`${cv.btn} ${cv.btnGhost}`} onClick={() => { clearAll(); resetHeader(); setSubmitted(false); setSaveMsg(null); onCancel() }}>Cancelar</button>
        <button type="button" className={`${cv.btn} ${cv.btnPrimary}`} onClick={openFinalize}>Guardar ruta</button>
      </div>

      {/* ── Modal: finalizar ruta ── */}
      {showFinalize && (
        <div className={cv.overlay}>
          <div className={cv.dialog} role="dialog" aria-modal="true" aria-labelledby="finalize-title">
            <div className={cv.dialogHead}>
              <h3 className={cv.dialogTitle} id="finalize-title">Confirmar puntos de la ruta</h3>
              <p className={cv.dialogSub}>Revisa los puntos de la ruta. Los puntos nuevos también se guardarán como puntos de interés para reutilizarlos.</p>
            </div>

            <div className={cv.dialogBody}>
              {finalizeRows.map((r, idx) => (
                <div key={r.id} className={cv.pointCard}>
                  <div className={cv.pointTop}>
                    <span className={cv.badge}>{idx + 1}</span>
                    <span className={r.isNew ? cv.pillNew : cv.pillExisting}>{r.isNew ? 'Punto nuevo' : 'Punto existente'}</span>
                  </div>
                  <div className={cv.field}>
                    <label className={cv.label} htmlFor={`fin-name-${r.id}`}>Nombre</label>
                    <input id={`fin-name-${r.id}`} className={`${cv.input} ${cv.inputReadonly}`} value={r.name} readOnly />
                  </div>
                  {r.isNew && (
                    <div className={cv.pointGrid}>
                      <div className={cv.field}>
                        <label className={cv.label} htmlFor={`fin-cat-${r.id}`}>Categoría</label>
                        <select id={`fin-cat-${r.id}`} className={cv.select} value={r.category} onChange={e => updateFinalizeRow(r.id, 'category', e.target.value)}>
                          {POINT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div className={cv.field}>
                        <label className={cv.label} htmlFor={`fin-rad-${r.id}`}>Radio de llegada (m)</label>
                        <input id={`fin-rad-${r.id}`} className={cv.input} type="number" min="1" value={r.radius} onChange={e => updateFinalizeRow(r.id, 'radius', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {finalizeError && (
                <div className={`${cv.alert} ${cv.alertErr}`} role="alert"><span aria-hidden="true">⚠</span>{finalizeError}</div>
              )}
            </div>

            <div className={cv.dialogFoot}>
              <button type="button" className={`${cv.btn} ${cv.btnGhost}`} onClick={() => setShowFinalize(false)} disabled={finalizing}>Cancelar</button>
              <button type="button" className={`${cv.btn} ${cv.btnPrimary}`} onClick={confirmFinalize} disabled={finalizing}>
                {finalizing ? 'Guardando…' : 'Guardar ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
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
      <Sidebar
        activeView={activeView}
        isAdmin={isAdmin}
        onNavigate={navTo}
        onLogout={handleLogout}
      />

      {/* ── Main ── */}
      <div className={styles.mainWrapper}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{VIEW_TITLES[activeView]}</h1>
          <div className={styles.topbarRight}>
            <div className={styles.searchBar}>
              <IconSearch />
              <input type="text" placeholder="Buscar viajes, conductores..." className={styles.searchInput} />
            </div>
            <button className={styles.bellBtn} aria-label="Notificaciones"><IconBell /></button>
            <span className={styles.divider} />
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
        <main className={styles.content}>
          {activeView === 'home'          && <HomeContent />}
          {activeView === 'route-config' && isAdmin && (
            <RouteConfigContent
              onSaved={() => { setRoutesReloadToken(n => n + 1); navTo('my-routes') }}
              onCancel={() => navTo('my-routes')}
            />
          )}
          {activeView === 'my-routes'     && (
            <MyRoutesContent
              onCreateNew={() => navTo('route-config')}
              reloadToken={routesReloadToken}
              isAdmin={isAdmin}
            />
          )}
          {activeView === 'trip-assignment' && <TripAssignmentContent />}
          {activeView === 'live-tracking' && <MonitoringContent />}
          {activeView === 'users'         && <UsersContent />}
          {activeView === 'drivers'       && <DriversContent />}
          {activeView === 'points'        && <PointsContent />}
          {activeView === 'protocols'     && <ProtocolsContent />}
        </main>
      </div>
    </div>
  )
}