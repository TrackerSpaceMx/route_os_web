import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import m  from './UsersModal.module.css'
import ui from './UsersView.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string

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

interface TripForm {
  route_id: string
  stops: Stop[]
}

const EMPTY_FORM: TripForm = { route_id: '', stops: [] }
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
const IconPin    = () => <svg {...P} width={14} height={14}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>

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
  const [waypointsLoading, setWaypointsLoading] = useState(false)
  const [waypointsError,   setWaypointsError]   = useState<string | null>(null)

  type Modal = 'none' | 'create' | 'delete'
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
        vehicle:    String(t.vehicle    ?? '—'),
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
    try {
      const res  = await fetch(`${API}/routes`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => ({}))
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setRouteOptions(raw.map(r => ({
        route_id:   String(r.route_id   ?? ''),
        route_name: String(r.route_name ?? 'Sin nombre'),
      })))
    } catch { setRouteOptions([]) }
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const openCreate = () => { setForm(EMPTY_FORM); setFormError(null); setWaypointsError(null); setModal('create'); fetchCatalogs() }
  const closeModal = () => setModal('none')
  const openDelete = (t: Trip) => { setSelected(t); setDeleteError(null); setModal('delete') }

  const handleRouteChange = (id: string) => { setForm(f => ({ ...f, route_id: id })); fetchRouteWaypoints(id) }
  const updateStop = (i: number, patch: Partial<Pick<Stop, 'dwell_time' | 'expected_arrival'>>) =>
    setForm(f => ({ ...f, stops: f.stops.map((s, j) => j === i ? { ...s, ...patch } : s) }))

  const handleSubmit = async () => {
    if (!form.route_id) { setFormError('Selecciona una ruta'); return }
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
          route_id: form.route_id,
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

      {/* ── Modal: Crear viaje ── */}
      {modal === 'create' && isAdmin && (
        <div className={m.overlay}>
          <div className={m.dialog} style={{ maxHeight:'calc(100vh - 48px)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div className={m.header}>
              <div>
                <h2 className={m.title}>Nuevo viaje</h2>
                <p className={m.subtitle}>Selecciona la ruta y configura los tiempos de llegada</p>
              </div>
              <button className={m.close} onClick={closeModal}><IconClose /></button>
            </div>

            <div className={m.body} style={{ flex:1, minHeight:0, overflowY:'auto' }}>
              {formError && <p className={m.error}>{formError}</p>}

              <div className={m.grid}>
                <div className={`${m.field} ${m.full}`}>
                  <label className={m.label}>Ruta <span className={m.req}>*</span></label>
                  <select
                    className={m.select}
                    value={form.route_id}
                    onChange={e => handleRouteChange(e.target.value)}
                  >
                    <option value="">Selecciona una ruta</option>
                    {routeOptions.map(r => (
                      <option key={r.route_id} value={r.route_id}>{r.route_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.route_id && (
                <div style={{ marginTop:20 }}>
                  <p style={{ margin:'0 0 10px', color:'#94a3b8', fontSize:13, fontWeight:600,
                    display:'flex', alignItems:'center', gap:6 }}>
                    <IconPin /> Paradas de la ruta
                  </p>

                  {waypointsLoading && (
                    <p style={{ color:'#64748b', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                      <span className={ui.spinner} /> Cargando paradas…
                    </p>
                  )}
                  {waypointsError && <p className={m.error}>{waypointsError}</p>}
                  {!waypointsLoading && !waypointsError && form.stops.length === 0 && (
                    <p style={{ color:'#64748b', fontSize:13 }}>Esta ruta no tiene paradas configuradas.</p>
                  )}

                  {form.stops.map((stop, i) => (
                    <div key={stop.waypoint_id || i} style={{
                      border:'1px solid #1e293b', borderRadius:10,
                      background:'#0f172a', padding:'14px 16px', marginBottom:10,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                        <span style={{
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          width:22, height:22, borderRadius:'50%',
                          background:'#1d4ed8', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0,
                        }}>{i+1}</span>
                        <span style={{ color:'#e2e8f0', fontSize:13, fontWeight:500 }}>{stop.name}</span>
                      </div>
                      <div className={m.grid}>
                        <div className={m.field}>
                          <label className={m.label}>Espera (min) <span className={m.req}>*</span></label>
                          <input
                            className={m.input}
                            type="number" min={0} step={1} placeholder="5"
                            value={stop.dwell_time}
                            onChange={e => updateStop(i, { dwell_time: e.target.value.replace(/[.,].*$/, '') })}
                            onKeyDown={e => { if (e.key==='.' || e.key===',') e.preventDefault() }}
                          />
                        </div>
                        <div className={m.field}>
                          <label className={m.label}>Llegada estimada <span className={m.req}>*</span></label>
                          <input
                            className={m.input}
                            type="datetime-local"
                            value={stop.expected_arrival}
                            onChange={e => updateStop(i, { expected_arrival: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={m.footer}>
              <button
                style={{ background:'transparent', border:'1px solid #334155', color:'#94a3b8',
                  borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:14 }}
                onClick={closeModal} disabled={submitting}
              >Cancelar</button>
              <button
                style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:8,
                  padding:'8px 20px', cursor:'pointer', fontSize:14, fontWeight:600 }}
                onClick={handleSubmit} disabled={submitting}
              >{submitting ? 'Guardando…' : 'Crear viaje'}</button>
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