import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../context/AuthContext'
import m  from './UsersModal.module.css'        // modales (mismo diseño que Usuarios y Conductores)
import ui from './UsersView.module.css'         // layout, filtros, tabla, paginación
import pc from './PointsContent.module.css'     // estilos específicos de puntos

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

// `latidude` se escribe así porque es el nombre que espera el backend
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

const CATEGORY_CLASS: Record<Category, string> = {
  airport:   pc.catAirport,
  station:   pc.catStation,
  terminal:  pc.catTerminal,
  warehouse: pc.catWarehouse,
  stop:      pc.catStop,
  other:     pc.catOther,
}

// ── Icons (mismo set que Usuarios y Conductores) ───────────────────────────────
const svgProps = {
  width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}
const IconSearch = () => (
  <svg {...svgProps} width={16} height={16}>
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)
const IconPlus = () => (
  <svg {...svgProps} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>
)
const IconPin = () => (
  <svg {...svgProps} width={12} height={12} fill="currentColor" strokeWidth={0}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
)
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
)
const IconClose = () => (
  <svg {...svgProps} width={20} height={20}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const IconSave = () => (
  <svg {...svgProps}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) { return name.trim().slice(0, 2).toUpperCase() }

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

// El modal se anima al abrir: recalcula el tamaño para que no queden teselas grises
function FixSize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250)
    return () => clearTimeout(t)
  }, [map])
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
        translateCategory(p.category).toLowerCase().includes(q) ||
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

  // ── Validación ───────────────────────────────────────────────────────────────
  function validateForm(): string | null {
    if (!form.point_name.trim())   return 'El nombre es requerido'
    if (!form.latidude.trim())     return 'Selecciona un punto en el mapa o ingresa la latitud'
    if (!form.longitude.trim())    return 'Selecciona un punto en el mapa o ingresa la longitud'
    const lat = Number(form.latidude), lng = Number(form.longitude)
    if (isNaN(lat) || lat < -90  || lat > 90)   return 'La latitud debe ser un número entre -90 y 90'
    if (isNaN(lng) || lng < -180 || lng > 180)  return 'La longitud debe ser un número entre -180 y 180'
    if (!form.radius_meter.trim()) return 'El radio es requerido'
    if (!(Number(form.radius_meter) > 0)) return 'El radio debe ser mayor a 0'
    return null
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) { setFormError(validationError); return }

    setSubmitting(true); setFormError(null)
    try {
      const res = await fetch(`${API}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          point_name:   form.point_name.trim(),
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

  const colSpan = isAdmin ? 7 : 6

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={ui.page}>
        {/* Encabezado */}
        <div className={ui.header}>
          <div>
            <h2 className={ui.title}>Puntos de interés</h2>
            <p className={ui.subtitle}>
              {loading
                ? 'Cargando...'
                : `${points.length} ${points.length === 1 ? 'punto registrado' : 'puntos registrados'}`}
            </p>
          </div>
          {isAdmin && (
            <button className={ui.btnPrimary} onClick={openCreate}>
              <IconPlus /> Nuevo Punto
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
              placeholder="Buscar por nombre, categoría o creador..."
              aria-label="Buscar puntos de interés"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Tabla */}
        <div className={ui.tableCard}>
          <div className={ui.tableScroll}>
            <table className={ui.table} style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Coordenadas</th>
                  <th>Radio (m)</th>
                  <th>Creado por</th>
                  <th>Fecha de creación</th>
                  {isAdmin && <th className={ui.thActions}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}><span className={ui.spinner} />Cargando puntos...</td>
                  </tr>
                ) : error ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}>⚠️ {error}</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={colSpan}>
                      No se encontraron puntos de interés
                      <span className={ui.stateHint}>Prueba con otro nombre, categoría o creador.</span>
                    </td>
                  </tr>
                ) : paginated.map(point => (
                  <tr key={point.id}>
                    <td>
                      <div className={ui.userCell}>
                        <div className={ui.avatar}>{initials(point.point_name)}</div>
                        <span className={pc.pointName}>{point.point_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${pc.category} ${CATEGORY_CLASS[point.category] ?? pc.catOther}`}>
                        <IconPin />{translateCategory(point.category)}
                      </span>
                    </td>
                    <td><span className={pc.coords}>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span></td>
                    <td><span className={pc.nowrap}>{point.radius} m</span></td>
                    <td>{point.created_by || '—'}</td>
                    <td><span className={pc.nowrap}>{formatDate(point.createdAt)}</span></td>
                    {isAdmin && (
                      <td>
                        <div className={ui.actions}>
                          <button
                            className={`${ui.action} ${ui.actionDanger}`}
                            title="Eliminar punto"
                            aria-label={`Eliminar ${point.point_name}`}
                            onClick={() => openDelete(point)}
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

          {filtered.length > PAGE_SIZE && (
            <div className={ui.pagination}>
              <span className={ui.pageInfo}>
                Página {page} de {totalPages} · {filtered.length} puntos
              </span>
              <div className={ui.pageButtons}>
                <button className={ui.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                <button className={ui.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ── */}
      {modal === 'create' && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <form
            className={`${m.dialog} ${pc.formDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="point-modal-title"
            noValidate
            onSubmit={e => { e.preventDefault(); handleSubmit() }}
          >
            <div className={m.header}>
              <div>
                <h2 id="point-modal-title" className={m.title}>Nuevo punto de interés</h2>
                <p className={m.subtitle}>Los campos marcados con * son obligatorios.</p>
              </div>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}>
                <IconClose />
              </button>
            </div>

            <div className={m.body}>
              <div className={m.grid}>
                <div className={m.field}>
                  <label className={m.label} htmlFor="pm-name">Nombre<span className={m.req}>*</span></label>
                  <input id="pm-name" className={m.input} type="text" autoFocus
                    placeholder="Ej. Aeropuerto Internacional"
                    value={form.point_name}
                    onChange={e => setForm(f => ({ ...f, point_name: e.target.value }))} />
                </div>

                <div className={m.field}>
                  <label className={m.label} htmlFor="pm-cat">Categoría<span className={m.req}>*</span></label>
                  <select id="pm-cat" className={m.select} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className={m.field}>
                <label className={m.label} htmlFor="pm-geo">Buscar dirección</label>
                <div className={pc.geoRow}>
                  <input id="pm-geo" className={m.input} type="text"
                    placeholder="Ej. Aeropuerto Internacional CDMX"
                    value={geoSearch}
                    onChange={e => setGeoSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleGeoSearch() } }} />
                  <button type="button" className={`${m.btn} ${m.btnPrimary} ${pc.geoBtn}`}
                    onClick={handleGeoSearch} disabled={geoLoading}>
                    <IconSearch />
                    {geoLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {geoError && <p className={m.error} role="alert">{geoError}</p>}
              </div>

              <div className={m.field}>
                <span className={m.label}>Ubicación<span className={m.req}>*</span></span>
                <p className={m.hint}>Haz clic en el mapa para colocar el pin.</p>
                <div className={pc.mapWrap}>
                  <MapContainer center={CDMX} zoom={11} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <FixSize />
                    <ClickHandler onMapClick={handleMapClick} />
                    {flyTo && <FlyTo lat={flyTo[0]} lng={flyTo[1]} />}
                    {markerPos && <Marker position={markerPos} />}
                  </MapContainer>
                </div>
              </div>

              <div className={m.grid}>
                <div className={m.field}>
                  <label className={m.label} htmlFor="pm-lat">Latitud<span className={m.req}>*</span></label>
                  <input id="pm-lat" className={m.input} type="text" inputMode="decimal" placeholder="19.4360762"
                    value={form.latidude}
                    onChange={e => setForm(f => ({ ...f, latidude: e.target.value }))} />
                </div>
                <div className={m.field}>
                  <label className={m.label} htmlFor="pm-lng">Longitud<span className={m.req}>*</span></label>
                  <input id="pm-lng" className={m.input} type="text" inputMode="decimal" placeholder="-99.0719089"
                    value={form.longitude}
                    onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                </div>
              </div>

              <div className={m.field}>
                <label className={m.label} htmlFor="pm-radius">Radio (metros)<span className={m.req}>*</span></label>
                <input id="pm-radius" className={m.input} type="number" min={1} placeholder="100"
                  value={form.radius_meter}
                  onChange={e => setForm(f => ({ ...f, radius_meter: e.target.value }))} />
                <p className={m.hint}>Distancia a la redonda que se considera dentro del punto.</p>
              </div>
            </div>

            <div className={m.footer}>
              {formError && <p className={`${m.error} ${m.footerNote}`} role="alert">{formError}</p>}
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cancelar</button>
              <button type="submit" className={`${m.btn} ${m.btnPrimary}`} disabled={submitting}>
                <IconSave />
                {submitting ? 'Guardando...' : 'Guardar punto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="alertdialog" aria-modal="true" aria-labelledby="point-delete-title">
            <div className={m.header}>
              <h2 id="point-delete-title" className={m.title}>Eliminar punto de interés</h2>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              <p className={m.message}>
                ¿Estás seguro de que deseas eliminar <strong>{selected.point_name}</strong>?
                Esta acción no se puede deshacer.
              </p>
              {deleteError && <p className={m.error} role="alert">{deleteError}</p>}
            </div>
            <div className={m.footer}>
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cancelar</button>
              <button type="button" className={`${m.btn} ${m.btnDanger}`} onClick={handleDelete} disabled={submitting || !!deleteError}>
                <IconTrash />
                {submitting ? 'Eliminando...' : 'Eliminar'}
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