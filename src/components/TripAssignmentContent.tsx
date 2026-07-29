import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './UsersContent.module.css'

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

interface DriverOption {
  id: number
  name: string
}

interface TripForm {
  vehicle: string
  route_id: string
  driver_id: string
}

const EMPTY_FORM: TripForm = {
  vehicle: '',
  route_id: '',
  driver_id: '',
}

const API = 'http://localhost:8084'
const PAGE_SIZE = 8

function translateStatus(status: TripStatus) {
  switch (status) {
    case 'scheduled':   return 'Programado'
    case 'in_progress': return 'En curso'
    case 'completed':   return 'Completado'
    case 'cancelled':   return 'Cancelado'
    default:            return status || '—'
  }
}

function statusBadgeClass(status: TripStatus) {
  switch (status) {
    case 'scheduled':   return styles.badgeScheduled
    case 'in_progress': return styles.badgeInProgress
    case 'completed':   return styles.badgeCompleted
    case 'cancelled':   return styles.badgeCancelled
    default:            return styles.badgeScheduled
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

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)
const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="7" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 10h3.5l2.5 3v5h-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="7.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="17.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)

// ── Component ──────────────────────────────────────────────────────────────────
export default function TripAssignmentContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [trips,   setTrips]   = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const [routeOptions,  setRouteOptions]  = useState<RouteOption[]>([])
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([])

  type Modal = 'none' | 'create'
  const [modal,      setModal]      = useState<Modal>('none')
  const [form,        setForm]      = useState<TripForm>(EMPTY_FORM)
  const [formError,   setFormError] = useState<string | null>(null)
  const [submitting,  setSubmitting] = useState(false)
  const [toast,       setToast]     = useState<string | null>(null)

  // ── Fetch trips ──────────────────────────────────────────────────────────────
  const fetchTrips = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/trip-assigment`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      let json: Record<string, unknown> = {}
      const text = await res.text()
      if (text.trim()) {
        try { json = JSON.parse(text) } catch { /* respuesta vacía o no-JSON */ }
      }
      if (!res.ok) throw new Error('Error al cargar los viajes')
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      const normalized: Trip[] = raw.map(t => ({
        trip_id:    String(t.trip_id ?? ''),
        display_id: Number(t.display_id ?? 0),
        vehicle:    String(t.vehicle    ?? '—'),
        status:     String(t.status     ?? 'scheduled'),
        created_at: String(t.created_at ?? ''),
        route:      String(t.route      ?? '—'),
        driver:     String(t.driver     ?? '—'),
        created_by: String(t.created_by ?? '—'),
      }))
      // Más recientes primero
      normalized.sort((a, b) => b.display_id - a.display_id)
      setTrips(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch catálogos para el formulario de creación (solo admins) ───────────
  const fetchCatalogs = async () => {
    try {
      const [routesRes, driversRes] = await Promise.all([
        fetch(`${API}/routes`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/drivers`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const routesJson  = await routesRes.json().catch(() => ({}))
      const driversJson = await driversRes.json().catch(() => ({}))

      const rawRoutes: Record<string, unknown>[] = Array.isArray(routesJson.data) ? routesJson.data : []
      setRouteOptions(rawRoutes.map(r => ({
        route_id:   String(r.route_id ?? ''),
        route_name: String(r.route_name ?? 'Sin nombre'),
      })))

      const rawDrivers: Record<string, unknown>[] = Array.isArray(driversJson.data) ? driversJson.data : []
      setDriverOptions(rawDrivers.map(d => ({
        id:   Number(d.id),
        name: String(d.name ?? 'Sin nombre'),
      })))
    } catch {
      setRouteOptions([])
      setDriverOptions([])
    }
  }

  useEffect(() => { fetchTrips() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return trips.filter(t =>
      t.vehicle.toLowerCase().includes(q) ||
      t.route.toLowerCase().includes(q) ||
      t.driver.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      t.created_by.toLowerCase().includes(q)
    )
  }, [trips, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Modal ────────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setModal('create')
    fetchCatalogs()
  }
  const closeModal = () => setModal('none')

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.vehicle.trim()) {
      setFormError('El vehículo es requerido')
      return
    }
    if (!form.route_id) {
      setFormError('Selecciona una ruta')
      return
    }
    if (!form.driver_id) {
      setFormError('Selecciona un conductor')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`${API}/trip-assigment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicle:   form.vehicle.trim(),
          route_id:  form.route_id,
          driver_id: form.driver_id,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el viaje')
      await fetchTrips()
      closeModal()
      showToast('Viaje creado correctamente')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Asignación de Viajes</h2>
          <p>Consulta y gestiona los viajes asignados en el sistema</p>
        </div>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={openCreate}>
            <IconPlus /> Nuevo Viaje
          </button>
        )}
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <IconSearch />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Buscar por vehículo, ruta, conductor o estado..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className={styles.showingText}>
            Mostrando {filtered.length} {filtered.length === 1 ? 'viaje' : 'viajes'}
          </span>
        </div>

        {/* Table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vehículo</th>
              <th>Ruta</th>
              <th>Conductor</th>
              <th>Estado</th>
              <th>Creado por</th>
              <th>Fecha de creación</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.stateRow}>
                <td colSpan={7}><span className={styles.spinner} />Cargando viajes...</td>
              </tr>
            ) : error ? (
              <tr className={styles.stateRow}>
                <td colSpan={7}>⚠️ {error}</td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr className={styles.stateRow}>
                <td colSpan={7}>No se encontraron viajes</td>
              </tr>
            ) : paginated.map(trip => (
              <tr key={trip.trip_id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}><IconTruck /></div>
                    <div className={styles.userNameText}>#{trip.display_id}</div>
                  </div>
                </td>
                <td>{trip.vehicle}</td>
                <td>{trip.route}</td>
                <td>{trip.driver}</td>
                <td>
                  <span className={`${styles.badge} ${statusBadgeClass(trip.status)}`}>
                    {translateStatus(trip.status)}
                  </span>
                </td>
                <td>{trip.created_by}</td>
                <td>{formatDate(trip.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <div className={styles.pageButtons}>
            <button className={styles.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className={styles.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* ── Create Modal (solo admins) ── */}
      {modal === 'create' && isAdmin && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Nuevo Viaje</p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Vehículo</label>
              <input className={styles.input} type="text" placeholder="Ej. ABC-1234"
                value={form.vehicle}
                onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Ruta</label>
              <select className={styles.select} value={form.route_id}
                onChange={e => setForm(f => ({ ...f, route_id: e.target.value }))}>
                <option value="">Selecciona una ruta</option>
                {routeOptions.map(r => (
                  <option key={r.route_id} value={r.route_id}>{r.route_name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Conductor</label>
              <select className={styles.select} value={form.driver_id}
                onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}>
                <option value="">Selecciona un conductor</option>
                {driverOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {formError && <p className={styles.errorMsg}>{formError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Crear Viaje'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: '#22c55e', color: '#fff',
          padding: '12px 20px', borderRadius: '8px',
          fontWeight: 500, fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
        }}>
          ✓ {toast}
        </div>
      )}
    </>
  )
}