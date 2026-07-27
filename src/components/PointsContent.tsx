import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../context/AuthContext'
import styles from './UsersContent.module.css'

// ── Fix leaflet marker icons (Vite issue) ─────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Types ──────────────────────────────────────────────────────────────────────
type Category = 'airport' | 'station' | 'terminal' | 'warehouse' | 'stop' | 'other'

interface Point {
  id: number
  point_id: string
  point_name: string
  category: Category
  lat: number
  lng: number
  radius: number
  created_by: string
  createdAt: string
}

interface PointForm {
  point_name: string
  category: Category
  latidude: string
  longitude: string
  radius_meter: string
}

const EMPTY_FORM: PointForm = {
  point_name: '',
  category: 'stop',
  latidude: '',
  longitude: '',
  radius_meter: '100',
}

const API = 'http://localhost:8084'
const PAGE_SIZE = 8
const CDMX: [number, number] = [19.4326, -99.1332]

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'airport',   label: 'Aeropuerto'  },
  { value: 'station',   label: 'Estación'    },
  { value: 'terminal',  label: 'Terminal'    },
  { value: 'warehouse', label: 'Almacén'     },
  { value: 'stop',      label: 'Parada'      },
  { value: 'other',     label: 'Otro'        },
]

function translateCategory(cat: Category) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function categoryBadgeClass(cat: Category) {
  if (cat === 'airport')  return styles.badgeAdmin
  if (cat === 'terminal') return styles.badgeConductor
  return styles.badgeOperador
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
const IconPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
  </svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) { return name.slice(0, 2).toUpperCase() }

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Map subcomponents ─────────────────────────────────────────────────────────
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1 })
  }, [lat, lng, map])
  return null
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PointsContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [points,      setPoints]      = useState<Point[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  const [modal,       setModal]       = useState<'none' | 'create' | 'delete'>('none')
  const [selected,    setSelected]    = useState<Point | null>(null)
  const [form,        setForm]        = useState<PointForm>(EMPTY_FORM)
  const [formError,   setFormError]   = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)

  const [markerPos,   setMarkerPos]   = useState<[number, number] | null>(null)
  const [flyTo,       setFlyTo]       = useState<[number, number] | null>(null)
  const [geoSearch,   setGeoSearch]   = useState('')
  const [geoLoading,  setGeoLoading]  = useState(false)
  const [geoError,    setGeoError]    = useState<string | null>(null)
  const geoRef = useRef<HTMLInputElement>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchPoints = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/points`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 204) { setPoints([]); return }
      if (!res.ok) throw new Error('Error al cargar puntos de interés')
      const json = await res.json()
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      setPoints(raw.map(p => ({
        id:         Number(p.id),
        point_id:   String(p.point_id ?? ''),
        point_name: String(p.point_name ?? ''),
        category:   String(p.category ?? 'other') as Category,
        lat:        Array.isArray(p.coordinates) ? Number(p.coordinates[0]) : 0,
        lng:        Array.isArray(p.coordinates) ? Number(p.coordinates[1]) : 0,
        radius:     Number(p.radius ?? 0),
        created_by: String(p.created_by ?? ''),
        createdAt:  String(p.created_at ?? ''),
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchPoints() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return points
      .filter(p =>
        p.point_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.created_by.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [points, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // ── Map handlers ─────────────────────────────────────────────────────────────
  const handleMapClick = (lat: number, lng: number) => {
    setMarkerPos([lat, lng])
    setForm(f => ({ ...f, latidude: lat.toFixed(7), longitude: lng.toFixed(7) }))
  }

  const handleGeoSearch = async () => {
    if (!geoSearch.trim()) return
    setGeoLoading(true); setGeoError(null)
    try {
      // Intento 1 — Photon
      const res1 = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(geoSearch)}&limit=1&lang=es`
      )
      const data1 = await res1.json()
      if (data1.features?.length) {
        const [lngN, latN] = data1.features[0].geometry.coordinates
        setMarkerPos([latN, lngN])
        setFlyTo([latN, lngN])
        setForm(f => ({ ...f, latidude: latN.toFixed(7), longitude: lngN.toFixed(7) }))
        return
      }

      // Intento 2 — Nominatim como fallback
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoSearch)}&format=json&limit=1&countrycodes=mx`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data2 = await res2.json()
      if (!data2.length) { setGeoError('No se encontró la dirección'); return }
      const latN = parseFloat(data2[0].lat), lngN = parseFloat(data2[0].lon)
      setMarkerPos([latN, lngN])
      setFlyTo([latN, lngN])
      setForm(f => ({ ...f, latidude: latN.toFixed(7), longitude: lngN.toFixed(7) }))

    } catch {
      setGeoError('Error al buscar la dirección')
    } finally { setGeoLoading(false) }
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM); setFormError(null); setSelected(null)
    setMarkerPos(null); setFlyTo(null); setGeoSearch(''); setGeoError(null)
    setModal('create')
  }
  const openDelete = (point: Point) => { setSelected(point); setDeleteError(null); setModal('delete') }
  const closeModal = () => { setModal('none'); setSelected(null) }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true); setDeleteError(null)
    try {
      const res = await fetch(`${API}/points/${selected.point_id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        if (res.status === 409) {
          const errJson = await res.json().catch(() => null) as { detail?: { message?: string } } | null
          const raw = errJson?.detail?.message ?? ''
          const match = raw.match(/route:\s*(.+)$/i)
          const routeName = match ? match[1].trim() : null
          throw new Error(
            routeName
              ? `No se puede eliminar. El punto "${selected.point_name}" está en uso por la ruta "${routeName}".`
              : `No se puede eliminar. El punto "${selected.point_name}" está en uso por una ruta.`
          )
        }
        throw new Error('No se pudo eliminar el punto')
      }
      await fetchPoints(); closeModal(); showToast('Punto de interés eliminado correctamente')
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Ocurrió un error al intentar eliminar el punto.')
    }
    finally { setSubmitting(false) }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.point_name.trim())   { setFormError('El nombre es requerido'); return }
    if (!form.latidude.trim())     { setFormError('Selecciona un punto en el mapa o ingresa la latitud'); return }
    if (!form.longitude.trim())    { setFormError('Selecciona un punto en el mapa o ingresa la longitud'); return }
    if (!form.radius_meter.trim()) { setFormError('El radio es requerido'); return }

    setSubmitting(true); setFormError(null)
    try {
      const res = await fetch(`${API}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          point_name:   form.point_name,
          category:     form.category,
          latidude:     form.latidude,
          longitude:    form.longitude,
          radius_meter: Number(form.radius_meter),
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el punto de interés')
      await fetchPoints(); closeModal(); showToast('Punto de interés creado correctamente')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSubmitting(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Puntos de interés</h2>
          <p>Administra los puntos de interés y sus categorías</p>
        </div>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={openCreate}>
            <IconPlus /> Nuevo Punto
          </button>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <IconSearch />
            <input className={styles.searchInput} type="text" placeholder="Buscar puntos..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className={styles.showingText}>
            Mostrando {filtered.length} {filtered.length === 1 ? 'punto' : 'puntos'}
          </span>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th><th>Categoría</th><th>Coordenadas</th>
              <th>Radio (m)</th><th>Creado por</th><th>Fecha de creación</th>
              {isAdmin && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.stateRow}><td colSpan={isAdmin ? 7 : 6}><span className={styles.spinner} />Cargando puntos...</td></tr>
            ) : error ? (
              <tr className={styles.stateRow}><td colSpan={isAdmin ? 7 : 6}>⚠️ {error}</td></tr>
            ) : paginated.length === 0 ? (
              <tr className={styles.stateRow}><td colSpan={isAdmin ? 7 : 6}>No se encontraron puntos de interés</td></tr>
            ) : paginated.map(point => (
              <tr key={point.id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>{initials(point.point_name)}</div>
                    <div className={styles.userNameText}>{point.point_name}</div>
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${categoryBadgeClass(point.category)}`}>
                    <IconPin />{translateCategory(point.category)}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                  {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                </td>
                <td>{point.radius} m</td>
                <td>{point.created_by}</td>
                <td>{formatDate(point.createdAt)}</td>
                {isAdmin && (
                  <td>
                    <div className={styles.actions}>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                        onClick={() => openDelete(point)} title="Eliminar">
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <div className={styles.pageButtons}>
            <button className={styles.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className={styles.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* ── Create Modal ── */}
      {modal === 'create' && (
        <div className={styles.overlay} style={{ alignItems: 'flex-start', overflowY: 'auto', padding: '24px' }}>
          <div className={styles.modal} style={{ maxWidth: '1060px', width: '100%', margin: 'auto' }}>
            <p className={styles.modalTitle}>Nuevo Punto de Interés</p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre</label>
              <input className={styles.input} type="text" placeholder="Ej. Aeropuerto Internacional"
                value={form.point_name}
                onChange={e => setForm(f => ({ ...f, point_name: e.target.value }))}
                onBlur={e => setForm(f => ({ ...f, point_name: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Categoría</label>
              <select className={styles.select} value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Buscar dirección</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={geoRef}
                  className={styles.input}
                  type="text"
                  placeholder="Ej. Aeropuerto Internacional CDMX"
                  value={geoSearch}
                  onChange={e => setGeoSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGeoSearch()}
                  style={{ flex: 1 }}
                />
                <button
                  className={styles.btnSave}
                  onClick={handleGeoSearch}
                  disabled={geoLoading}
                  style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
                >
                  {geoLoading ? '...' : 'Buscar'}
                </button>
              </div>
              {geoError && <p className={styles.errorMsg}>{geoError}</p>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Ubicación — haz click en el mapa para colocar el pin</label>
              <div style={{ height: '460px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e2a3a' }}>
                <MapContainer center={CDMX} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <ClickHandler onMapClick={handleMapClick} />
                  {flyTo && <FlyTo lat={flyTo[0]} lng={flyTo[1]} />}
                  {markerPos && <Marker position={markerPos} />}
                </MapContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Latitud</label>
                <input className={styles.input} type="text" placeholder="19.4360762"
                  value={form.latidude}
                  onChange={e => setForm(f => ({ ...f, latidude: e.target.value }))}
                  onBlur={e => setForm(f => ({ ...f, latidude: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>Longitud</label>
                <input className={styles.input} type="text" placeholder="-99.0719089"
                  value={form.longitude}
                  onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                  onBlur={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Radio (metros)</label>
              <input className={styles.input} type="number" placeholder="100"
                value={form.radius_meter}
                onChange={e => setForm(f => ({ ...f, radius_meter: e.target.value }))}
                onBlur={e => setForm(f => ({ ...f, radius_meter: e.target.value }))}
              />
            </div>

            {formError && <p className={styles.errorMsg}>{formError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Crear Punto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Eliminar Punto de Interés</p>
            <p className={styles.deleteWarning}>
              ¿Estás seguro de que deseas eliminar <strong>{selected.point_name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            {deleteError && <p className={styles.errorMsg}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnDelete} onClick={handleDelete} disabled={submitting || !!deleteError}>
                {submitting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: '#22c55e', color: '#fff',
          padding: '12px 20px', borderRadius: '8px',
          fontWeight: 500, fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999,
        }}>
          ✓ {toast}
        </div>
      )}
    </>
  )
}