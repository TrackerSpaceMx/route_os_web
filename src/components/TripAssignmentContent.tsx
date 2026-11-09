import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import m  from './UsersModal.module.css'
import ui from './UsersView.module.css'
import f  from './TripAssignmentForm.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string
type Modal = 'none' | 'create' | 'delete' | 'start'

interface Trip {
  trip_id: string
  display_id: number
  vehicle: string
  status: TripStatus
  created_at: string
  route: string
  driver: string
  created_by: string
}

interface RouteOption {
  route_id: string
  route_name: string
}

interface RouteWaypoint {
  waypoint_id: string
  name: string
}

interface Stop extends RouteWaypoint {
  dwell_time: string
  expected_arrival: string
}

interface DriverOption {
  id: string
  name: string
  employee_number: string
  phone: string
  phone_secondary: string
  available: boolean
}

interface ProtocolOption {
  id: string
  name: string
  is_default: boolean
}

interface VehicleOption {
  vehicle_name: string
  plate: string
}

type PhoneChoice = '' | 'phone' | 'phone_secondary'

interface TripForm {
  route_id: string
  driver_id: string
  folio: string
  protocol_profile_id: string
  phone_choice: PhoneChoice
  vehicle_name: string
  vehicle_plate: string
  scheduled_departure: string   // datetime-local: 'YYYY-MM-DDTHH:mm'
  stops: Stop[]
}

const EMPTY_FORM: TripForm = { route_id: '', driver_id: '', folio: '', protocol_profile_id: '', phone_choice: '', vehicle_name: '', vehicle_plate: '', scheduled_departure: '', stops: [] }
const API       = 'http://localhost:8084'
const PAGE_SIZE = 8

// ── Helpers ────────────────────────────────────────────────────────────────────
function translateStatus(status: TripStatus) {
  switch (status) {
    case 'scheduled':   return 'Programado'
    case 'in_progress': return 'En curso'
    case 'completed':   return 'Completado'
    case 'cancelled':   return 'Cancelado'
    default:            return status || '—'
  }
}

function statusClass(status: TripStatus, ui: Record<string, string>) {
  switch (status) {
    case 'scheduled':   return ui.badgeScheduled
    case 'in_progress': return ui.badgeInProgress
    case 'completed':   return ui.badgeCompleted
    case 'cancelled':   return ui.badgeCancelled
    default:            return ui.badgeScheduled
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function toApiDateTime(v: string) {
  if (!v) return ''
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const P = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

const IconSearch = () => <svg {...P} width={15} height={15}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const IconPlus   = () => <svg {...P} width={15} height={15}><path d="M12 5v14M5 12h14"/></svg>
const IconTrash  = () => <svg {...P}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
const IconClose  = () => <svg {...P} width={20} height={20}><path d="M18 6 6 18M6 6l12 12"/></svg>
const IconTruck  = () => <svg {...P}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
const IconRoute  = () => <svg {...P}><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>
const IconUser   = () => <svg {...P}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
const IconBadge  = () => <svg {...P}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 17a3 3 0 0 1 6 0M15 9h3M15 13h3"/></svg>
const IconPhone  = () => <svg {...P}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
const IconShield = () => <svg {...P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
const IconPlate  = () => <svg {...P}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M18 10h.01M8 14h8"/></svg>
const IconPin    = () => <svg {...P} width={14} height={14}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
const IconPlay   = () => <svg {...P} width={15} height={15}><polygon points="5 3 19 12 5 21 5 3"/></svg>

// ── Selector con buscador ─────────────────────────────────────────────────────
interface SelectOption { key: string; label: string; meta?: string; disabled?: boolean; tag?: string }

function SearchSelect({ labelId, icon, placeholder, searchLabel, selectedKey, selectedLabel, options, emptyText, onSelect }: {
  labelId: string
  icon: React.ReactNode
  placeholder: string
  searchLabel: string
  selectedKey: string
  selectedLabel: string
  options: SelectOption[]
  emptyText: string
  onSelect: (key: string) => void
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter(o => !q || o.label.toLowerCase().includes(q) || (o.meta ?? '').toLowerCase().includes(q))
  }, [options, query])

  return (
    <div className={f.combo} ref={ref}>
      <span className={f.inputIcon} style={{ top: 12 }}>{icon}</span>
      <button
        type="button"
        className={`${f.comboBtn} ${f.chev}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => { setOpen(o => !o); setQuery('') }}
      >
        <span className={selectedLabel ? undefined : f.comboPlaceholder}>{selectedLabel || placeholder}</span>
      </button>

      {open && (
        <div className={f.panel}>
          <div className={f.panelSearch}>
            <span className={f.inputIcon}><IconSearch /></span>
            <input
              autoFocus
              className={`${f.input} ${f.withIcon}`}
              placeholder="Buscar…"
              aria-label={searchLabel}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
            />
          </div>
          <div className={f.list} role="listbox" aria-labelledby={labelId}>
            {matches.length === 0 && (
              <div className={f.empty}>{options.length === 0 ? emptyText : `Sin resultados para "${query}"`}</div>
            )}
            {matches.map(o => (
              <button
                key={o.key}
                type="button"
                role="option"
                aria-selected={o.key === selectedKey}
                disabled={o.disabled}
                className={`${f.opt} ${o.key === selectedKey ? f.optOn : ''}`}
                onClick={() => { onSelect(o.key); setOpen(false) }}
              >
                <span>
                  <span className={f.optName}>{o.label}</span>
                  {o.meta && <><br /><span className={f.optMeta}>{o.meta}</span></>}
                </span>
                {o.tag && <span className={f.optTag}>{o.tag}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TripAssignmentContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [trips,   setTrips]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const [routeOptions,     setRouteOptions]     = useState<RouteOption[]>([])
  const [driverOptions,    setDriverOptions]    = useState<DriverOption[]>([])
  const [vehicleOptions,   setVehicleOptions]   = useState<VehicleOption[]>([])
  const [protocolOptions,  setProtocolOptions]  = useState<ProtocolOption[]>([])
  const [waypointsLoading, setWaypointsLoading] = useState(false)
  const [waypointsError,   setWaypointsError]   = useState<string | null>(null)

  const [modal,       setModal]       = useState<Modal>('none')
  const [form,        setForm]        = useState<TripForm>(EMPTY_FORM)
  const [formError,   setFormError]   = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [selected,    setSelected]    = useState<Trip | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Fetch trips ──────────────────────────────────────────────────────────────
  const fetchTrips = async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`${API}/trip-assigment`, { headers: { Authorization: `Bearer ${token}` } })
      const text = await res.text()
      const json: Record<string, unknown> = text.trim() ? JSON.parse(text) : {}
      if (!res.ok) throw new Error('Error al cargar los viajes')
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      const normalized: Trip[] = raw.map(t => ({
        trip_id:    String(t.trip_id    ?? ''),
        display_id: Number(t.display_id ?? 0),
        vehicle:    String(t.vehicle_name ?? t.vehicle ?? '—'),
        status:     String(t.status     ?? 'scheduled'),
        created_at: String(t.created_at ?? ''),
        route:      String(t.route      ?? '—'),
        driver:     String(t.driver     ?? '—'),
        created_by: String(t.created_by ?? '—'),
      }))
      normalized.sort((a, b) => b.display_id - a.display_id)
      setTrips(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setLoading(false) }
  }

  const fetchCatalogs = async () => {
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const res  = await fetch(`${API}/routes`, { headers })
      const json = await res.json().catch(() => ({}))
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setRouteOptions(raw.map(r => ({
        route_id:   String(r.route_id   ?? ''),
        route_name: String(r.route_name ?? 'Sin nombre'),
      })))
    } catch { setRouteOptions([]) }

    try {
      const res = await fetch(`${API}/protocol-profile`, { headers })
      const json = res.status === 204 ? null : await res.json().catch(() => null)
      const raw: Record<string, unknown>[] = Array.isArray(json?.data) ? json.data : []
      const list: ProtocolOption[] = raw.map(x => ({
        id:         String(x.id ?? ''),
        name:       String(x.name ?? 'Sin nombre'),
        is_default: Boolean(x.is_default),
      })).filter(x => x.id)
      setProtocolOptions(list)
      const def = list.find(x => x.is_default)
      // Preselecciona el protocolo predeterminado, sin pisar lo que la persona ya haya elegido
      if (def) setForm(p => p.protocol_profile_id ? p : { ...p, protocol_profile_id: def.id })
    } catch { setProtocolOptions([]) }

    try {
      const res  = await fetch(`${API}/vehicles`, { headers })
      const json = await res.json().catch(() => ({}))
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setVehicleOptions(raw.map(v => ({
        vehicle_name: String(v.vehicle_name ?? '').trim(),
        plate:        String(v.plate ?? '').trim(),
      })).filter(v => v.vehicle_name))
    } catch { setVehicleOptions([]) }

    try {
      const res  = await fetch(`${API}/drivers`, { headers })
      const json = await res.json().catch(() => ({}))
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setDriverOptions(raw.map(d => ({
        id:              String(d.id ?? ''),
        name:            String(d.name ?? 'Sin nombre'),
        employee_number: String(d.employee_number ?? ''),
        phone:           String(d.phone ?? ''),
        phone_secondary: String(d.phone_secondary ?? ''),
        available:       Boolean(d.available ?? true),
      })))
    } catch { setDriverOptions([]) }
  }

  const fetchRouteWaypoints = async (routeId: string) => {
    if (!routeId) { setForm(f => ({ ...f, stops: [] })); return }
    setWaypointsLoading(true); setWaypointsError(null)
    try {
      const res  = await fetch(`${API}/routes/waypoints/${routeId}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error('No se pudieron cargar las paradas de la ruta')
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setForm(f => ({
        ...f,
        stops: raw.map(w => ({
          waypoint_id:      String(w.waypoint_id ?? w.id ?? ''),
          name:             String(w.waypoint_label ?? w.name ?? w.point_name ?? 'Sin nombre'),
          dwell_time:       '',
          expected_arrival: '',
        })),
      }))
    } catch (e: unknown) {
      setWaypointsError(e instanceof Error ? e.message : 'Error al cargar las paradas')
      setForm(f => ({ ...f, stops: [] }))
    } finally { setWaypointsLoading(false) }
  }

  useEffect(() => { fetchTrips() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered   = useMemo(() => {
    const q = search.toLowerCase()
    return trips.filter(t =>
      t.vehicle.toLowerCase().includes(q)    ||
      t.route.toLowerCase().includes(q)      ||
      t.driver.toLowerCase().includes(q)     ||
      t.status.toLowerCase().includes(q)     ||
      t.created_by.toLowerCase().includes(q)
    )
  }, [trips, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search])

  const selectedDriver  = driverOptions.find(d => d.id === form.driver_id) ?? null
  const chosenPhone = selectedDriver && form.phone_choice ? selectedDriver[form.phone_choice] : ''
  const vehicleKey = (v: VehicleOption) => `${v.plate}||${v.vehicle_name}`
  const selectedVehicle = vehicleOptions.find(v => v.plate === form.vehicle_plate && v.vehicle_name === form.vehicle_name) ?? null

  const driverSelectOptions: SelectOption[] = driverOptions.map(d => ({
    key: d.id,
    label: d.name,
    meta: d.employee_number ? `No. ${d.employee_number}` : 'Sin número de empleado',
    disabled: !d.available,
    tag: d.available ? undefined : 'No disponible',
  }))
  const vehicleSelectOptions: SelectOption[] = vehicleOptions.map(v => ({
    key: vehicleKey(v), label: v.vehicle_name, meta: v.plate ? `Placa ${v.plate}` : 'Sin placa',
  }))

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const [startError, setStartError] = useState<string | null>(null)

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(null); setWaypointsError(null); setModal('create'); fetchCatalogs() }
  const closeModal = () => setModal('none')
  const openDelete = (t: Trip) => { setSelected(t); setDeleteError(null); setModal('delete') }
  const openStart  = (t: Trip) => { setSelected(t); setStartError(null); setModal('start') }

  const handleRouteChange = (id: string) => { setForm(f => ({ ...f, route_id: id })); fetchRouteWaypoints(id) }
  const updateStop = (i: number, patch: Partial<Pick<Stop, 'dwell_time' | 'expected_arrival'>>) =>
    setForm(f => ({ ...f, stops: f.stops.map((s, j) => j === i ? { ...s, ...patch } : s) }))

  const handleSubmit = async () => {
    if (!form.route_id) { setFormError('Selecciona una ruta'); return }
    if (!form.folio.trim()) { setFormError('Escribe el folio del viaje'); return }
    if (!form.scheduled_departure) { setFormError('Indica la salida programada'); return }
    if (!selectedVehicle) { setFormError('Selecciona un vehículo'); return }
    if (!selectedVehicle.plate) { setFormError('El vehículo seleccionado no tiene placa registrada'); return }
    if (!selectedDriver) { setFormError('Selecciona un operador'); return }
    if (!selectedDriver.employee_number) { setFormError('El operador seleccionado no tiene número de empleado registrado'); return }
    if (!selectedDriver.phone && !selectedDriver.phone_secondary) { setFormError('El operador seleccionado no tiene teléfono registrado'); return }
    if (!chosenPhone) { setFormError('Selecciona el teléfono del operador'); return }
    if (!form.protocol_profile_id) { setFormError('Selecciona un protocolo'); return }
    if (form.stops.length === 0) { setFormError('La ruta no tiene paradas configuradas'); return }
    for (const s of form.stops) {
      const v = Number(s.dwell_time)
      if (!s.dwell_time.trim() || isNaN(v) || v < 0) { setFormError('El tiempo de espera debe ser un número válido en todas las paradas'); return }
      if (!Number.isInteger(v)) { setFormError('El tiempo de espera debe ser un entero (sin decimales)'); return }
      if (!s.expected_arrival)  { setFormError('Indica la hora de llegada en todas las paradas'); return }
    }
    setSubmitting(true); setFormError(null)
    try {
      const res = await fetch(`${API}/trip-assigment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          route_id:      form.route_id,
          folio:         form.folio.trim(),
          scheduled_departure: toApiDateTime(form.scheduled_departure),
          driver_id:     form.driver_id,
          protocol_profile_id: form.protocol_profile_id,
          vehicle_name:  selectedVehicle.vehicle_name,
          vehicle_plate: selectedVehicle.plate,
          driver_phone:  chosenPhone, // el principal o el secundario del operador, según se elija
          stops: form.stops.map((s, i) => ({
            waypoint_id:      s.waypoint_id,
            sequence_order:   i + 1,
            dwell_time:       Number(s.dwell_time) * 60,
            expected_arrival: toApiDateTime(s.expected_arrival),
          })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: { message?: string } | string } | null
        const detail = typeof body?.detail === 'string' ? body.detail : body?.detail?.message
        throw new Error(detail ?? 'No se pudo crear el viaje')
      }
      await fetchTrips(); closeModal(); showToast('Viaje creado correctamente')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true); setDeleteError(null)
    try {
      const res = await fetch(`${API}/trip-assigment/${selected.trip_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      await fetchTrips(); closeModal(); showToast('Asignación eliminada correctamente')
    } catch { setDeleteError('Ocurrió un error al intentar eliminar la asignación.') }
    finally { setSubmitting(false) }
  }

  const handleStartTrip = async () => {
    if (!selected) return
    setSubmitting(true); setStartError(null)
    try {
      const res = await fetch(`${API}/trip-assigment/${selected.trip_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trip_status: 'in_progress' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: string } | null
        throw new Error(body?.detail ?? 'No se pudo iniciar el viaje')
      }
      await fetchTrips(); closeModal(); showToast('Viaje iniciado correctamente')
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Error al iniciar el viaje')
    } finally { setSubmitting(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={ui.page}>

      {/* Header */}
      <div className={ui.header}>
        <div>
          <h2 className={ui.title}>Asignación de Viajes</h2>
          <p className={ui.subtitle}>Consulta y gestiona los viajes asignados en el sistema</p>
        </div>
        {isAdmin && (
          <button className={ui.btnPrimary} onClick={openCreate}>
            <IconPlus /> Nuevo viaje
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={ui.filters}>
        <label className={ui.searchWrap}>
          <IconSearch />
          <input
            className={ui.searchInput}
            type="text"
            placeholder="Buscar por vehículo, ruta, conductor o estado…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      </div>

      {/* Table */}
      <div className={ui.tableCard}>
        <div className={ui.tableScroll}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Ruta</th>
                <th>Vehículo</th>
                <th>Conductor</th>
                <th>Estado</th>
                <th>Creado por</th>
                <th>Fecha</th>
                {isAdmin && <th className={ui.thActions}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={ui.stateRow}><td colSpan={isAdmin ? 8 : 7}><span className={ui.spinner} />Cargando viajes…</td></tr>
              ) : error ? (
                <tr className={ui.stateRow}><td colSpan={isAdmin ? 8 : 7}>⚠ {error}</td></tr>
              ) : paginated.length === 0 ? (
                <tr className={ui.stateRow}>
                  <td colSpan={isAdmin ? 8 : 7}>
                    {search ? 'Sin resultados' : 'Sin viajes registrados'}
                    <span className={ui.stateHint}>{!search && 'Crea el primer viaje con el botón de arriba'}</span>
                  </td>
                </tr>
              ) : paginated.map(trip => (
                <tr key={trip.trip_id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ display:'flex', alignItems:'center', justifyContent:'center',
                        width:30, height:30, borderRadius:8, background:'#1e293b', color:'#60a5fa', flexShrink:0 }}>
                        <IconTruck />
                      </span>
                      <span style={{ color:'#94a3b8', fontWeight:600, fontSize:13 }}>#{trip.display_id}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:'#60a5fa' }}><IconRoute /></span>
                      {trip.route}
                    </div>
                  </td>
                  <td>{trip.vehicle}</td>
                  <td>{trip.driver}</td>
                  <td>
                    <span className={`${ui.badge} ${statusClass(trip.status, ui)}`}>
                      {translateStatus(trip.status)}
                    </span>
                  </td>
                  <td>{trip.created_by}</td>
                  <td className={ui.date}>{formatDate(trip.created_at)}</td>
                  {isAdmin && (
                    <td>
                      <div className={ui.actions}>
                        {trip.status === 'scheduled' && (
                          <button className={`${ui.action} ${ui.actionStart}`} title="Iniciar viaje" onClick={() => openStart(trip)}>
                            <IconPlay />
                          </button>
                        )}
                        {trip.status === 'in_progress' && (
                          <span className={`${ui.badge} ${ui.badgeInProgress}`} style={{ fontSize: 11, padding: '3px 8px' }}>
                            En curso
                          </span>
                        )}
                        <button className={`${ui.action} ${ui.actionDanger}`} title="Eliminar" onClick={() => openDelete(trip)}>
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

        {!loading && !error && totalPages > 1 && (
          <div className={ui.pagination}>
            <span className={ui.pageInfo}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} de {filtered.length} viajes</span>
            <div className={ui.pageButtons}>
              <button className={ui.btnPage} disabled={page===1}          onClick={() => setPage(p => p-1)}>Anterior</button>
              <button className={ui.btnPage} disabled={page===totalPages} onClick={() => setPage(p => p+1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Crear viaje (solo se cierra con Cancelar o la X) ── */}
      {modal === 'create' && isAdmin && (
        <div className={m.overlay}>
          <div className={f.dialog} role="dialog" aria-modal="true" aria-labelledby="trip-title">
            <div className={f.head}>
              <div>
                <h2 className={f.title} id="trip-title">Nuevo viaje</h2>
                <p className={f.sub}>Asigna ruta, vehículo y operador, y define los tiempos de cada parada.</p>
              </div>
              <button type="button" className={f.close} onClick={closeModal} aria-label="Cerrar"><IconClose /></button>
            </div>

            <div className={f.body}>
              {formError && <div className={f.alertErr} role="alert"><span aria-hidden="true">⚠</span>{formError}</div>}

              {/* Información general */}
              <section className={f.card}>
                <div className={f.cardHead}>
                  <span className={f.cardIcon}><IconTruck /></span>
                  <h3 className={f.cardTitle}>Información general</h3>
                </div>
                <div className={f.cardBody}>
                  <div className={f.grid}>
                    <div className={`${f.field} ${f.span2}`}>
                      <label className={f.label} htmlFor="trip-route">Ruta<span className={f.req}>*</span></label>
                      <div className={f.inputWrap}>
                        <span className={f.inputIcon}><IconRoute /></span>
                        <select
                          id="trip-route"
                          className={`${f.select} ${f.withIcon}`}
                          value={form.route_id}
                          onChange={e => handleRouteChange(e.target.value)}
                        >
                          <option value="">Selecciona una ruta</option>
                          {routeOptions.map(r => <option key={r.route_id} value={r.route_id}>{r.route_name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-folio">Folio del viaje<span className={f.req}>*</span></label>
                      <input
                        id="trip-folio"
                        className={`${f.input} ${f.mono}`}
                        placeholder="Ej. TRP-2026-0153"
                        maxLength={255}
                        value={form.folio}
                        onChange={e => setForm(p => ({ ...p, folio: e.target.value }))}
                      />
                    </div>

                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-departure">Salida programada<span className={f.req}>*</span></label>
                      <input
                        id="trip-departure"
                        className={`${f.input} ${f.dateInput}`}
                        type="datetime-local"
                        value={form.scheduled_departure}
                        onChange={e => setForm(p => ({ ...p, scheduled_departure: e.target.value }))}
                      />
                    </div>

                    {/* Vehículo (catálogo de /vehicles) */}
                    <div className={f.field}>
                      <span className={f.label} id="trip-vehicle-label">Vehículo<span className={f.req}>*</span></span>
                      <SearchSelect
                        labelId="trip-vehicle-label"
                        icon={<IconTruck />}
                        placeholder="Selecciona un vehículo"
                        searchLabel="Buscar vehículo"
                        selectedKey={selectedVehicle ? vehicleKey(selectedVehicle) : ''}
                        selectedLabel={selectedVehicle?.vehicle_name ?? ''}
                        options={vehicleSelectOptions}
                        emptyText="No hay vehículos registrados"
                        onSelect={key => {
                          const v = vehicleOptions.find(x => vehicleKey(x) === key)
                          if (v) setForm(p => ({ ...p, vehicle_name: v.vehicle_name, vehicle_plate: v.plate }))
                        }}
                      />
                    </div>

                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-plate">Placa<span className={f.req}>*</span></label>
                      <div className={f.inputWrap}>
                        <span className={f.inputIcon}><IconPlate /></span>
                        <input
                          id="trip-plate"
                          className={`${f.input} ${f.withIcon} ${f.readonly} ${f.mono}`}
                          placeholder="Elige un vehículo"
                          value={selectedVehicle?.plate ?? ''}
                          readOnly
                        />
                      </div>
                    </div>

                    {/* Operador */}
                    <div className={f.field}>
                      <span className={f.label} id="trip-driver-label">Operador<span className={f.req}>*</span></span>
                      <SearchSelect
                        labelId="trip-driver-label"
                        icon={<IconUser />}
                        placeholder="Selecciona un operador"
                        searchLabel="Buscar operador"
                        selectedKey={form.driver_id}
                        selectedLabel={selectedDriver?.name ?? ''}
                        options={driverSelectOptions}
                        emptyText="No hay operadores registrados"
                        onSelect={key => setForm(p => ({ ...p, driver_id: key, phone_choice: '' }))}
                      />
                    </div>

                    {/* Se completan solos al elegir el operador */}
                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-emp">Número de empleado<span className={f.req}>*</span></label>
                      <div className={f.inputWrap}>
                        <span className={f.inputIcon}><IconBadge /></span>
                        <input
                          id="trip-emp"
                          className={`${f.input} ${f.withIcon} ${f.readonly}`}
                          placeholder="Se completa al elegir operador"
                          value={selectedDriver?.employee_number ?? ''}
                          readOnly
                        />
                      </div>
                    </div>

                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-phone">Teléfono<span className={f.req}>*</span></label>
                      <div className={f.inputWrap}>
                        <span className={f.inputIcon}><IconPhone /></span>
                        <select
                          id="trip-phone"
                          className={`${f.select} ${f.withIcon}`}
                          value={form.phone_choice}
                          disabled={!selectedDriver}
                          onChange={e => setForm(p => ({ ...p, phone_choice: e.target.value as PhoneChoice }))}
                        >
                          <option value="">{selectedDriver ? 'Selecciona un teléfono' : 'Primero elige un operador'}</option>
                          {selectedDriver?.phone && <option value="phone">Principal · {selectedDriver.phone}</option>}
                          {selectedDriver?.phone_secondary && <option value="phone_secondary">Secundario · {selectedDriver.phone_secondary}</option>}
                        </select>
                      </div>
                      {selectedDriver && !selectedDriver.phone && !selectedDriver.phone_secondary && (
                        <p className={f.error}>Este operador no tiene teléfonos registrados</p>
                      )}
                    </div>

                    <div className={f.field}>
                      <label className={f.label} htmlFor="trip-protocol">Protocolo<span className={f.req}>*</span></label>
                      <div className={f.inputWrap}>
                        <span className={f.inputIcon}><IconShield /></span>
                        <select
                          id="trip-protocol"
                          className={`${f.select} ${f.withIcon}`}
                          value={form.protocol_profile_id}
                          disabled={protocolOptions.length === 0}
                          onChange={e => setForm(p => ({ ...p, protocol_profile_id: e.target.value }))}
                        >
                          <option value="">{protocolOptions.length === 0 ? 'Sin protocolos disponibles' : 'Selecciona un protocolo'}</option>
                          {protocolOptions.map(x => (
                            <option key={x.id} value={x.id}>{x.name}{x.is_default ? ' (predeterminado)' : ''}</option>
                          ))}
                        </select>
                      </div>
                      {protocolOptions.length === 0 && <p className={f.error}>Crea un protocolo en la sección Protocolos</p>}
                    </div>
                  </div>
                </div>
              </section>

              {/* Paradas */}
              {form.route_id && (
                <section className={f.card}>
                  <div className={f.cardHead}>
                    <span className={f.cardIcon}><IconPin /></span>
                    <div>
                      <h3 className={f.cardTitle}>Paradas de la ruta</h3>
                      <p className={f.cardHint}>Indica cuánto espera el operador y a qué hora debe llegar a cada parada.</p>
                    </div>
                  </div>
                  <div className={f.cardBody}>
                    {waypointsLoading && <p className={f.loading}><span className={f.spinner} /> Cargando paradas…</p>}
                    {waypointsError && <p className={f.error}>{waypointsError}</p>}
                    {!waypointsLoading && !waypointsError && form.stops.length === 0 && (
                      <p className={f.muted}>Esta ruta no tiene paradas configuradas.</p>
                    )}
                    <div className={f.stops}>
                      {form.stops.map((stop, i) => (
                        <div key={stop.waypoint_id || i} className={f.stop}>
                          <div className={f.stopTop}>
                            <span className={f.badge}>{i + 1}</span>
                            <span className={f.stopName}>{stop.name}</span>
                          </div>
                          <div className={f.stopGrid}>
                            <div className={f.field}>
                              <label className={f.label} htmlFor={`stop-dwell-${i}`}>Espera (min)<span className={f.req}>*</span></label>
                              <input
                                id={`stop-dwell-${i}`}
                                className={f.input}
                                type="number" min={0} step={1} placeholder="5"
                                value={stop.dwell_time}
                                onChange={e => updateStop(i, { dwell_time: e.target.value.replace(/[.,].*$/, '') })}
                                onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
                              />
                            </div>
                            <div className={f.field}>
                              <label className={f.label} htmlFor={`stop-eta-${i}`}>Llegada estimada<span className={f.req}>*</span></label>
                              <input
                                id={`stop-eta-${i}`}
                                className={`${f.input} ${f.dateInput}`}
                                type="datetime-local"
                                value={stop.expected_arrival}
                                onChange={e => updateStop(i, { expected_arrival: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className={f.foot}>
              <button type="button" className={`${f.btn} ${f.btnGhost}`} onClick={closeModal} disabled={submitting}>Cancelar</button>
              <button type="button" className={`${f.btn} ${f.btnPrimary}`} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando…' : 'Crear viaje'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Eliminar ── */}
      {modal === 'delete' && isAdmin && selected && (
        <div className={m.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className={`${m.dialog} ${m.dialogSm}`}>
            <div className={m.header}>
              <div>
                <h2 className={m.title}>Eliminar viaje</h2>
                <p className={m.subtitle}>Esta acción no se puede deshacer.</p>
              </div>
              <button className={m.close} onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              {deleteError && <p className={m.error}>{deleteError}</p>}
              <p style={{ color:'#cbd5e1', margin:0 }}>
                ¿Estás seguro de que deseas eliminar el viaje{' '}
                <strong style={{ color:'#f1f5f9' }}>#{selected.display_id}</strong>
                {selected.route !== '—' && <> ({selected.route})</>}?
              </p>
            </div>
            <div className={m.footer}>
              <button
                style={{ background:'transparent', border:'1px solid #334155', color:'#94a3b8',
                  borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:14 }}
                onClick={closeModal} disabled={submitting}
              >Cancelar</button>
              <button
                style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:8,
                  padding:'8px 20px', cursor:'pointer', fontSize:14, fontWeight:600,
                  display:'flex', alignItems:'center', gap:6 }}
                onClick={handleDelete} disabled={submitting}
              >{submitting ? 'Eliminando…' : <><IconTrash /> Eliminar</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Iniciar viaje ── */}
      {modal === 'start' && isAdmin && selected && (
        <div className={m.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className={`${m.dialog} ${m.dialogSm}`}>
            <div className={m.header}>
              <div>
                <h2 className={m.title}>Iniciar viaje</h2>
                <p className={m.subtitle}>El viaje pasará a estado "En curso" y no podrá revertirse.</p>
              </div>
              <button className={m.close} onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              {startError && <p className={m.error}>{startError}</p>}
              <p style={{ color:'#cbd5e1', margin:0 }}>
                ¿Confirmas que deseas iniciar el viaje{' '}
                <strong style={{ color:'#f1f5f9' }}>#{selected.display_id}</strong>
                {selected.route !== '—' && <> — {selected.route}</>}?
              </p>
            </div>
            <div className={m.footer}>
              <button
                style={{ background:'transparent', border:'1px solid #334155', color:'#94a3b8',
                  borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:14 }}
                onClick={closeModal} disabled={submitting}
              >Cancelar</button>
              <button
                style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:8,
                  padding:'8px 20px', cursor:'pointer', fontSize:14, fontWeight:600,
                  display:'flex', alignItems:'center', gap:6, opacity: submitting ? 0.7 : 1 }}
                onClick={handleStartTrip} disabled={submitting}
              >{submitting ? 'Iniciando…' : <><IconPlay /> Iniciar viaje</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:'#16a34a', color:'#fff',
          padding:'12px 20px', borderRadius:10,
          fontWeight:500, fontSize:14,
          boxShadow:'0 4px 16px rgba(0,0,0,.25)',
        }}>✓ {toast}</div>
      )}
    </div>
  )
}