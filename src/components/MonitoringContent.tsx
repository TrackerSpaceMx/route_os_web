import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import s from './MonitoringContent.module.css'

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const API = 'http://localhost:8084'
const REFRESH_MS = 300_000   // 5 minutos

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Stop {
  stop_order: number
  name: string
  address: string
  lat: number
  lng: number
  scheduled_arrival?: string | null
  status?: string | null
}

interface Trip {
  id: string
  displayId: number
  folio: string
  tripStatus: string
  vehicleName: string
  vehiclePlate: string
  routeName: string
  clientId: string
  clientName: string
  driverId: string
  driverName: string
  employeeNumber: string
  photoUrl: string | null
  protocolName: string
  scheduledDeparture: string | null
  realDeparture: string | null
  etaPlanned: string | null
  eta: string | null
  departureDelayMin: number | null
  delayedStops: number
  doneStops: number
  totalStops: number
  phase: string | null
  lastLatitude: number | null
  lastLongitude: number | null
  lastSpeedKmh: number | null
  lastPositionAt: string | null
  riskScore: number
  openEvents: number
  status: string          // display_status
  onSchedule: boolean
}

interface Summary { active: number; atRisk: number; logistic: number; pending: number }

// ── Lectura segura de la respuesta ─────────────────────────────────────────────
const str = (v: unknown, d = ''): string => (v === null || v === undefined ? d : String(v))
const nul = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d }
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeTrip(r: Record<string, unknown>): Trip {
  return {
    id:                str(r.id),
    displayId:         num(r.display_id),
    folio:             str(r.folio, '—'),
    tripStatus:        str(r.trip_status),
    vehicleName:       str(r.vehicle_name),
    vehiclePlate:      str(r.vehicle_plate),
    routeName:         str(r.route_name),
    clientId:          str(r.client_id),
    clientName:        str(r.client_name),
    driverId:          str(r.driver_id),
    driverName:        str(r.driver_name, 'Sin operador'),
    employeeNumber:    str(r.employee_number),
    photoUrl:          nul(r.photo_url),
    protocolName:      str(r.protocol_name),
    scheduledDeparture: nul(r.scheduled_departure),
    realDeparture:     nul(r.real_departure),
    etaPlanned:        nul(r.eta_planned),
    eta:               nul(r.eta),
    departureDelayMin: numOrNull(r.departure_delay_min),
    // El backend lo devuelve como "delay_stops"; se acepta también "delayed_stops"
    delayedStops:      num(r.delay_stops ?? r.delayed_stops),
    doneStops:         num(r.done_stops),
    totalStops:        num(r.total_stops),
    phase:             nul(r.phase),
    lastLatitude:      numOrNull(r.last_latitude),
    lastLongitude:     numOrNull(r.last_longitude),
    lastSpeedKmh:      numOrNull(r.last_speed_kmh),
    lastPositionAt:    nul(r.last_position_at),
    riskScore:         Math.max(0, Math.min(100, num(r.risk_score))),
    openEvents:        num(r.open_events),
    status:            str(r.display_status, 'in_progress'),
    onSchedule:        r.on_schedule === true || Number(r.on_schedule) === 1,
  }
}

// Los contadores vienen dentro de cada viaje ("active_trips_sumary"); se toman del primero.
function readSummary(first: Record<string, unknown> | undefined, trips: Trip[]): Summary {
  const raw = (first?.active_trips_sumary ?? first?.active_trips_summary) as Record<string, unknown> | undefined
  if (raw && typeof raw === 'object') {
    return {
      active:   num(raw.active_trips),
      atRisk:   num(raw.in_risk),
      logistic: num(raw.logistic),
      pending:  num(raw.slopes ?? raw.pending),   // "slopes" = pendientes
    }
  }
  return {
    active:   trips.length,
    atRisk:   trips.filter(t => t.status === 'at_risk').length,
    logistic: trips.filter(t => t.status === 'logistic').length,
    pending:  trips.filter(t => t.status === 'pending').length,
  }
}

// ── Formato de fechas (se lee el texto tal cual: sin conversiones de zona horaria) ──
const DT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/

function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function fmtDateTime(v: string | null): string {
  if (!v) return '—'
  const m = DT.exec(v)
  if (!m) return '—'
  const [, date, time] = m
  if (date === todayLocal()) return time
  const [, mm, dd] = date.split('-')
  return `${dd}/${mm} ${time}`
}

// ── Estados ────────────────────────────────────────────────────────────────────
type Tone = 'green' | 'red' | 'amber' | 'blue' | 'orange'

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pending:     { label: 'Pendiente de salida', tone: 'amber'  },
  at_risk:     { label: 'En riesgo',           tone: 'red'    },
  logistic:    { label: 'Logístico',           tone: 'green'  },
  unloading:   { label: 'Descarga',            tone: 'orange' },
  in_progress: { label: 'En curso',            tone: 'blue'   },
}

function statusMeta(status: string): { label: string; tone: Tone } {
  if (STATUS_META[status]) return STATUS_META[status]
  const label = status.replace(/_/g, ' ')
  return { label: label.charAt(0).toUpperCase() + label.slice(1), tone: 'blue' }
}

const riskTone = (r: number): Tone => (r >= 50 ? 'red' : r >= 25 ? 'amber' : 'green')

// ── Iconos ─────────────────────────────────────────────────────────────────────
const P = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const IconSearch  = () => <svg {...P}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
const IconShield  = () => <svg {...P} width={14} height={14}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
const IconChevron = ({ open }: { open: boolean }) => (
  <svg {...P} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="m6 9 6 6 6-6" /></svg>
)
const IconWarn    = () => <svg {...P} width={14} height={14}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
const IconCheck   = () => <svg {...P} width={14} height={14}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
const IconAlert   = () => <svg {...P} width={14} height={14}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>

// ── Iconos Leaflet ─────────────────────────────────────────────────────────────
const makeStopIcon = (n: number, done: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${done ? '#6b7280' : '#22c55e'};
      color:#fff;font-weight:700;font-size:12px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid ${done ? '#4b5563' : '#16a34a'};
      box-shadow:0 2px 6px rgba(0,0,0,.45);
    ">${n}</div>`,
  })

const vehicleIcon = L.divIcon({
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:#3b82f6;border:3px solid #fff;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(59,130,246,.6);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  </div>`,
})

// ── Panel de mapa ──────────────────────────────────────────────────────────────
function TripMapView({ trip, token }: { trip: Trip; token: string | null }) {
  const [stops, setStops]       = useState<Stop[] | null>(null)
  const [loadingStops, setLoadingStops] = useState(true)

  useEffect(() => {
    if (!trip.lastLatitude || !trip.lastLongitude) { setLoadingStops(false); return }
    fetch(`${API}/monitoring/${trip.id}/stops`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const raw: Record<string, unknown>[] = Array.isArray(json?.data) ? json.data
          : Array.isArray(json) ? json : []
        const list: Stop[] = raw.map(r => ({
          stop_order:        Number(r.stop_order ?? r.order ?? 0),
          name:              String(r.name ?? r.point_name ?? ''),
          address:           String(r.address ?? ''),
          lat:               Number(r.lat ?? r.latitude),
          lng:               Number(r.lng ?? r.longitude),
          scheduled_arrival: r.scheduled_arrival as string | null ?? null,
          status:            r.status as string | null ?? null,
        })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        setStops(list)
      })
      .catch(() => setStops([]))
      .finally(() => setLoadingStops(false))
  }, [trip.id, trip.lastLatitude, trip.lastLongitude, token])

  const hasPos = trip.lastLatitude !== null && trip.lastLongitude !== null
  if (!hasPos) {
    return <div className={s.mapEmpty}>Sin posición GPS registrada para este viaje</div>
  }

  const center: [number, number] = [trip.lastLatitude!, trip.lastLongitude!]
  const polyline: [number, number][] = stops && stops.length > 0
    ? [...stops.map(p => [p.lat, p.lng] as [number, number]), center]
    : []

  // Next stop: first stop not done
  const nextStop = stops?.find(p => p.status !== 'done' && p.status !== 'completed')

  return (
    <div className={s.mapWrapper}>
      {/* Barra superior: siguiente punto */}
      {nextStop && (
        <div className={s.mapTopBar}>
          <span className={s.mapTopLabel}>Siguiente punto:</span>
          <span className={s.mapTopName}>{nextStop.name}</span>
          {nextStop.scheduled_arrival && (
            <><span className={s.mapTopSep}>·</span>
            <span>Llegada prog. {nextStop.scheduled_arrival.slice(11, 16)}</span></>
          )}
        </div>
      )}

      {/* Mapa */}
      {loadingStops
        ? <div className={s.mapLoading}>Cargando mapa…</div>
        : (
          <MapContainer
            center={center}
            zoom={14}
            className={s.map}
            zoomControl={true}
            attributionControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Paradas numeradas */}
            {stops?.map((p, i) => (
              <Marker
                key={i}
                position={[p.lat, p.lng]}
                icon={makeStopIcon(p.stop_order || i + 1, p.status === 'done' || p.status === 'completed')}
              />
            ))}

            {/* Línea de ruta */}
            {polyline.length > 1 && (
              <Polyline
                positions={polyline}
                pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.85 }}
              />
            )}

            {/* Vehículo */}
            <Marker position={center} icon={vehicleIcon} />
          </MapContainer>
        )
      }

      {/* Leyenda velocidad */}
      {trip.lastSpeedKmh !== null && (
        <div className={s.mapFooter}>
          <span>{trip.lastSpeedKmh} km/h</span>
          {trip.lastPositionAt && <span>· Posición: {fmtDateTime(trip.lastPositionAt)}</span>}
        </div>
      )}
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────
// Aislado para que el contador de segundos no vuelva a pintar toda la lista cada segundo
function Updated({ lastOk, failed }: { lastOk: number | null; failed: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (lastOk === null) return <>Cargando…</>
  const secs = Math.max(0, Math.round((now - lastOk) / 1000))
  const txt = secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min`
  return <>{failed ? `Sin conexión · último dato hace ${txt}` : `Actualizado hace ${txt}`}</>
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const [broken, setBroken] = useState(false)
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  if (url && /^https?:\/\//i.test(url) && !broken) {
    return <img className={s.avatar} src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
  }
  return <span className={`${s.avatar} ${s.avatarFallback}`} aria-hidden="true">{initials}</span>
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.detail}>
      <span className={s.detailLabel}>{label}</span>
      <span className={s.detailValue}>{children}</span>
    </div>
  )
}

function TripRow({ trip, open, onToggle, token }: { trip: Trip; open: boolean; onToggle: () => void; token: string | null }) {
  const [detailTab, setDetailTab] = useState<'map' | 'route'>('map')
  const meta = statusMeta(trip.status)
  const risk = riskTone(trip.riskScore)
  const atRisk = trip.status === 'at_risk'
  const late = (trip.departureDelayMin ?? 0) > 0
  const panelId = `trip-detail-${trip.id}`
  const progress = trip.totalStops > 0 ? Math.round((trip.doneStops / trip.totalStops) * 100) : 0

  return (
    <li className={`${s.row} ${atRisk ? s.rowRisk : ''}`}>
      <div className={s.rowMain}>
        {/* Viaje */}
        <div className={s.cell}>
          <span className={s.num}>{String(trip.displayId).padStart(3, '0')}</span>
          <div className={s.stack}>
            <span className={s.folio}>
              {trip.folio}
              {atRisk && <span className={s.warn} title="Viaje en riesgo"><IconWarn /></span>}
            </span>
            <span className={s.sub}>{trip.clientName || '—'}</span>
            <span className={s.mono}>{[trip.vehicleName, trip.vehiclePlate].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')}</span>
          </div>
        </div>

        {/* Operador */}
        <div className={s.cell}>
          <Avatar name={trip.driverName} url={trip.photoUrl} />
          <div className={s.stack}>
            <span className={s.name}>{trip.driverName}</span>
            <span className={s.mono}>{trip.employeeNumber || '—'}</span>
          </div>
        </div>

        {/* Estado y riesgo */}
        <div className={`${s.cell} ${s.cellCol}`}>
          <div className={s.statusRow}>
            <span className={`${s.pill} ${s[`tone_${meta.tone}`]}`}><i className={s.dot} />{meta.label}</span>
            <span
              className={`${s.riskChip} ${s[`text_${risk}`]}`}
              title="Nivel de riesgo del viaje"
              role="meter"
              aria-label="Riesgo"
              aria-valuenow={trip.riskScore}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              Riesgo {trip.riskScore}%
            </span>
          </div>
          <div className={s.riskLine}>
            <span className={s.riskLabel}>Avance</span>
            <div className={s.bar} role="progressbar" aria-label="Avance del viaje" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className={`${s.barFill} ${progress >= 100 ? s.fill_green : s.fill_blue}`} style={{ width: `${progress}%` }} />
            </div>
            <span className={s.riskNum}>{progress}%</span>
          </div>
        </div>

        {/* Protocolo */}
        <div className={s.cell}>
          <div className={s.stack}>
            <span className={s.proto}><IconShield />{trip.protocolName || 'Sin protocolo'}</span>
            {trip.openEvents > 0 && (
              <span className={s.events}>{trip.openEvents} {trip.openEvents === 1 ? 'evento abierto' : 'eventos abiertos'}</span>
            )}
          </div>
        </div>

        {/* Horario */}
        <div className={s.cell}>
          <dl className={s.times}>
            <dt>Programada</dt><dd>{fmtDateTime(trip.scheduledDeparture)}</dd>
            <dt>Real</dt>
            <dd className={late ? s.text_amber : undefined}>
              {fmtDateTime(trip.realDeparture)}
              {late && trip.realDeparture && <small> +{trip.departureDelayMin} min</small>}
            </dd>
            <dt>ETA</dt><dd className={s.eta}>{fmtDateTime(trip.eta)}</dd>
          </dl>
        </div>

        {/* Acciones */}
        <div className={`${s.cell} ${s.actions}`}>
          <span className={`${s.pill} ${trip.onSchedule ? s.tone_green : s.tone_red}`}>
            {trip.onSchedule ? <IconCheck /> : <IconAlert />}
            {trip.onSchedule ? 'Cumple' : 'Incumple'}
          </span>
          <button
            type="button"
            className={s.expandBtn}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? `Ocultar detalle del viaje ${trip.folio}` : `Ver detalle del viaje ${trip.folio}`}
            onClick={onToggle}
          >
            <IconChevron open={open} />
          </button>
        </div>
      </div>

      {open && (
        <div className={s.panelOuter} id={panelId}>
          {/* Tabs */}
          <div className={s.tabBar}>
            <button
              type="button"
              className={`${s.tab} ${detailTab === 'map' ? s.tabActive : ''}`}
              onClick={() => setDetailTab('map')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
              Vista de Mapa
            </button>
            <button
              type="button"
              className={`${s.tab} ${detailTab === 'route' ? s.tabActive : ''}`}
              onClick={() => setDetailTab('route')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              Vista de Ruta
            </button>
          </div>

          {/* Contenido de la pestaña activa */}
          {detailTab === 'map' && (
            <TripMapView trip={trip} token={token} />
          )}

          {detailTab === 'route' && (
            <div className={s.panel}>
              <Detail label="Ruta">{trip.routeName || '—'}</Detail>
              <Detail label="Paradas">
                {trip.doneStops} de {trip.totalStops} ({progress}%)
                {trip.delayedStops > 0 && <em className={s.text_red}> · {trip.delayedStops} con retraso</em>}
              </Detail>
              <Detail label="ETA">
                {fmtDateTime(trip.eta)}
                {trip.etaPlanned && trip.eta && trip.etaPlanned !== trip.eta && <small> (planeada {fmtDateTime(trip.etaPlanned)})</small>}
              </Detail>
              <Detail label="Última posición">
                {trip.lastLatitude !== null && trip.lastLongitude !== null
                  ? <>{trip.lastLatitude.toFixed(5)}, {trip.lastLongitude.toFixed(5)}
                      {trip.lastSpeedKmh !== null && <> · {trip.lastSpeedKmh} km/h</>}
                      {trip.lastPositionAt && <small> ({fmtDateTime(trip.lastPositionAt)})</small>}</>
                  : 'Sin posición reportada'}
              </Detail>
              <Detail label="Fase">{trip.phase ? statusMeta(trip.phase).label : '—'}</Detail>
              <Detail label="Estado del viaje">{trip.tripStatus === 'scheduled' ? 'Programado' : trip.tripStatus === 'in_progress' ? 'En curso' : trip.tripStatus || '—'}</Detail>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ── Pantalla ───────────────────────────────────────────────────────────────────
export default function MonitoringContent() {
  const { token } = useAuth()

  const [trips,   setTrips]   = useState<Trip[] | null>(null)
  const [summary, setSummary] = useState<Summary>({ active: 0, atRisk: 0, logistic: 0, pending: 0 })
  const [lastOk,     setLastOk]     = useState<number | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [open,       setOpen]       = useState<Set<string>>(new Set())

  const [fClient, setFClient] = useState('')
  const [fPlate,  setFPlate]  = useState('')
  const [fDriver, setFDriver] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fDate,   setFDate]   = useState('')
  const [fQuery,  setFQuery]  = useState('')

  const ctrlRef = useRef<AbortController | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    // Cancelar petición anterior si todavía está en vuelo
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl

    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`${API}/monitoring`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      if (res.status === 401) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
      if (!res.ok) throw new Error(`No se pudo actualizar (código ${res.status})`)
      const json = res.status === 204 ? null : await res.json().catch(() => null)
      const raw: Record<string, unknown>[] = Array.isArray(json?.data) ? json.data : []
      const list = raw.map(normalizeTrip)
      setTrips(list)
      setSummary(readSummary(raw[0], list))
      setLastOk(Date.now())
      setError(null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setRefreshing(false)
    }
  }, [token])

  // Carga inicial + refresco automático. Se pausa con la pestaña oculta.
  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load(true) }, REFRESH_MS)
    const onVisible = () => { if (!document.hidden) load(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { ctrlRef.current?.abort(); clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  // Opciones de los filtros, tomadas de los propios viajes
  const options = useMemo(() => {
    const list = trips ?? []
    const uniq = (pick: (t: Trip) => [string, string] | null) => {
      const m = new Map<string, string>()
      list.forEach(t => { const p = pick(t); if (p && p[0]) m.set(p[0], p[1]) })
      return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }))
    }
    return {
      clients:  uniq(t => [t.clientId, t.clientName || t.clientId]),
      vehicles: uniq(t => [t.vehiclePlate, t.vehicleName && t.vehicleName !== t.vehiclePlate ? `${t.vehicleName} · ${t.vehiclePlate}` : t.vehiclePlate]),
      drivers:  uniq(t => [t.driverId, t.driverName]),
      statuses: uniq(t => [t.status, statusMeta(t.status).label]),
    }
  }, [trips])

  const visible = useMemo(() => {
    const q = fQuery.trim().toLowerCase()
    return (trips ?? []).filter(t =>
      (!fClient || t.clientId === fClient) &&
      (!fPlate  || t.vehiclePlate === fPlate) &&
      (!fDriver || t.driverId === fDriver) &&
      (!fStatus || t.status === fStatus) &&
      (!fDate   || (t.scheduledDeparture ?? '').slice(0, 10) === fDate) &&
      (!q || [t.folio, t.vehiclePlate, t.vehicleName, t.driverName, t.employeeNumber, t.routeName]
               .some(v => v.toLowerCase().includes(q)))
    )
  }, [trips, fClient, fPlate, fDriver, fStatus, fDate, fQuery])

  const hasFilters = !!(fClient || fPlate || fDriver || fStatus || fDate || fQuery)
  const clearFilters = () => { setFClient(''); setFPlate(''); setFDriver(''); setFStatus(''); setFDate(''); setFQuery('') }
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const failed = error !== null

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h2 className={s.title}>
            <span className={`${s.live} ${failed ? s.liveOff : ''}`} aria-hidden="true" />
            Tablero de Monitoreo en Vivo
          </h2>
          <p className={s.subtitle} aria-live="polite">
            Centro de control logístico en tiempo real · <Updated lastOk={lastOk} failed={failed} />
            {refreshing && <span className={s.refreshing} aria-label="Actualizando…"> ↻</span>}
          </p>
        </div>

        <div className={s.chips} aria-label="Resumen de viajes">
          <span className={s.chip}><i className={`${s.dot} ${s.dot_red}`} />En riesgo: <b>{summary.atRisk}</b></span>
          <span className={s.chip}><i className={`${s.dot} ${s.dot_green}`} />Logístico: <b>{summary.logistic}</b></span>
          <span className={s.chip}><i className={`${s.dot} ${s.dot_amber}`} />Pendientes: <b>{summary.pending}</b></span>
          <span className={s.chip}>Viajes activos: <b>{summary.active}</b></span>
        </div>
      </header>

      {error && <div className={s.alert} role="alert"><IconAlert />{error}</div>}

      {/* Filtros */}
      <section className={s.filters} aria-label="Filtros">
        <select className={s.select} aria-label="Empresa" value={fClient} onChange={e => setFClient(e.target.value)}>
          <option value="">Todas las empresas</option>
          {options.clients.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={s.select} aria-label="Vehículo" value={fPlate} onChange={e => setFPlate(e.target.value)}>
          <option value="">Todos los vehículos</option>
          {options.vehicles.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={s.select} aria-label="Operador" value={fDriver} onChange={e => setFDriver(e.target.value)}>
          <option value="">Todos los operadores</option>
          {options.drivers.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={s.select} aria-label="Estado" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {options.statuses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={`${s.input} ${s.date}`} type="date" aria-label="Fecha programada" value={fDate} onChange={e => setFDate(e.target.value)} />
        <div className={s.search}>
          <span className={s.searchIcon}><IconSearch /></span>
          <input
            className={`${s.input} ${s.searchInput}`}
            type="search"
            placeholder="Buscar folio, operador, placa…"
            aria-label="Buscar viaje"
            value={fQuery}
            onChange={e => setFQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Encabezado de columnas (solo visual) */}
      <div className={s.colHead} aria-hidden="true">
        <span>Viaje</span><span>Operador</span><span>Estado y riesgo</span><span>Protocolo</span><span>Horario</span><span className={s.colRight}>Acciones</span>
      </div>

      {/* Lista */}
      {trips === null && !error && <p className={s.empty}>Cargando viajes…</p>}
      {trips !== null && trips.length === 0 && (
        <div className={s.empty}>
          <strong>No hay viajes activos</strong>
          <span>Cuando se asigne un viaje, aparecerá aquí.</span>
        </div>
      )}
      {trips !== null && trips.length > 0 && visible.length === 0 && (
        <div className={s.empty}>
          <strong>Ningún viaje coincide con los filtros</strong>
          {hasFilters && <button type="button" className={s.linkBtn} onClick={clearFilters}>Limpiar filtros</button>}
        </div>
      )}
      {visible.length > 0 && (
        <ul className={s.list}>
          {visible.map(t => <TripRow key={t.id} trip={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} token={token} />)}
        </ul>
      )}
    </div>
  )
}