import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import m  from './UsersModal.module.css'        // modales (mismo diseño que Usuarios)
import ui from './UsersView.module.css'        // layout, filtros, paginación
import dc from './DriversContent.module.css'  // estilos específicos de la tabla

// ── Types ──────────────────────────────────────────────────────────────────────
interface Driver {
  id: string
  displayId: number
  name: string
  employeeNumber: string
  phone: string
  phoneSecondary: string
  licenseNumber: string
  licenseExpiry: string        // 'YYYY-MM-DD' o ''
  photoUrl: string | null      // URL firmada de lectura (la genera el backend)
  notes: string | null         // nota opcional (null = sin notas)
  available: boolean
}

interface DriverForm {
  name: string
  employee_number: string
  phone: string
  phone_secondary: string
  license_number: string
  license_expiry: string
  notes: string
}

const EMPTY_FORM: DriverForm = {
  name: '',
  employee_number: '',
  phone: '',
  phone_secondary: '',
  license_number: '',
  license_expiry: '',
  notes: '',
}

const API = 'http://localhost:8084'
const PAGE_SIZE = 8

// Límites de caracteres del formulario
const MAX_NAME     = 50
const MAX_EMPLOYEE = 30
const MAX_LICENSE  = 20
const MAX_PHONE_DIGITS = 15
const MAX_NOTES   = 500

// Foto: mismos límites que valida S3 y el backend
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO = 5 * 1024 * 1024

// ── Icons (mismo set que Usuarios) ─────────────────────────────────────────────
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
const IconEdit = () => (
  <svg {...svgProps}>
    <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
)
const IconUserPlus = () => (
  <svg {...svgProps} width={18} height={18}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
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
const IconEye = () => (
  <svg {...svgProps}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
)
const IconPhone = () => (
  <svg {...svgProps} width={16} height={16}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)
const IconStar = () => (
  <svg {...svgProps} width={14} height={14} fill="currentColor">
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)
const IconImagePlus = () => (
  <svg {...svgProps} width={22} height={22}>
    <path d="M16 5h6M19 2v6" />
    <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
    <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    <circle cx="9" cy="9" r="2" />
  </svg>
)
const IconUserPlus2 = () => (
  <svg {...svgProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Rechaza el cambio si el teléfono supera MAX_PHONE_DIGITS dígitos
function limitPhone(next: string, prev: string): string {
  return next.replace(/\D/g, '').length > MAX_PHONE_DIGITS ? prev : next
}

function formatExpiry(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`
}

type ExpiryStatus = 'ok' | 'soon' | 'expired'

function getExpiryStatus(iso: string): ExpiryStatus {
  if (!iso) return 'ok'
  const expiry = new Date(iso + 'T00:00:00')
  const today  = new Date(); today.setHours(0,0,0,0)
  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0)   return 'expired'
  if (diffDays <= 30) return 'soon'
  return 'ok'
}

function daysUntilExpiry(iso: string): number {
  const expiry = new Date(iso + 'T00:00:00')
  const today  = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Los campos opcionales vacíos se envían como null (el backend los espera así)
function toPayload(form: DriverForm) {
  return {
    name:            form.name.trim(),
    employee_number: form.employee_number.trim(),
    license_number:  form.license_number.trim(),
    phone:           form.phone.trim() || null,
    phone_secondary: form.phone_secondary.trim() || null,
    license_expiry:  form.license_expiry || null,
    notes:           form.notes.trim() || null,
  }
}

// Sube la foto a tu API (queda en tmp/ de S3) y devuelve el photo_id
// que se envía al crear o editar el conductor.
async function uploadPhoto(file: File, token: string | null): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API}/drivers/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },   // sin Content-Type: lo pone el navegador
    body: fd,
  })
  if (res.status === 413) throw new Error('La foto excede 5 MB')
  if (!res.ok) throw new Error('Falló la subida de la foto')
  const { photo_id } = await res.json()
  return photo_id as string
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DriversContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [drivers,     setDrivers]    = useState<Driver[]>([])
  const [loading,     setLoading]    = useState(true)
  const [error,       setError]      = useState<string | null>(null)
  const [search,      setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [page,        setPage]       = useState(1)

  type Modal = 'none' | 'create' | 'edit' | 'delete' | 'view'
  const [modal,       setModal]      = useState<Modal>('none')
  const [selected,    setSelected]   = useState<Driver | null>(null)
  const [form,        setForm]       = useState<DriverForm>(EMPTY_FORM)
  const [formError,   setFormError]  = useState<string | null>(null)
  const [submitting,  setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast,       setToast]      = useState<string | null>(null)
  const [photoFile,   setPhotoFile]  = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)   // edición: quitar la foto actual
  const [dragOver,    setDragOver]   = useState(false)

  // Vista previa local de la foto elegida (se libera al cambiar o desmontar)
  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile])
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchDrivers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      let json: Record<string, unknown> = {}
      const text = await res.text()
      if (text.trim()) {
        try { json = JSON.parse(text) } catch { /* respuesta vacía o no-JSON */ }
      }
      if (!res.ok) throw new Error('Error al cargar conductores')
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      const normalized: Driver[] = raw.map(d => ({
        id:             String(d.id ?? ''),
        displayId:      Number(d.display_id ?? 0),
        name:           String(d.name ?? 'Sin nombre'),
        employeeNumber: String(d.employee_number ?? ''),
        phone:          String(d.phone ?? ''),
        phoneSecondary: String(d.phone_secondary ?? ''),
        licenseNumber:  String(d.license_number ?? ''),
        licenseExpiry:  d.license_expiry ? String(d.license_expiry).slice(0, 10) : '',
        photoUrl:       d.photo_url ? String(d.photo_url) : null,
        notes:          d.notes ? String(d.notes) : null,
        available:      Boolean(d.available ?? true),
      }))
      setDrivers(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDrivers() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return drivers.filter(d => {
      const matchesSearch =
        d.name.toLowerCase().includes(q) ||
        d.employeeNumber.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.licenseNumber.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'available'   &&  d.available) ||
        (statusFilter === 'unavailable' && !d.available)
      return matchesSearch && matchesStatus
    })
  }, [drivers, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setPhotoFile(null)
    setRemovePhoto(false)
    setFormError(null)
    setSelected(null)
    setModal('create')
  }
  const openEdit = (driver: Driver) => {
    setSelected(driver)
    setPhotoFile(null)
    setRemovePhoto(false)
    setForm({
      name: driver.name,
      employee_number: driver.employeeNumber,
      phone: driver.phone,
      phone_secondary: driver.phoneSecondary,
      license_number: driver.licenseNumber,
      license_expiry: driver.licenseExpiry,
      notes: driver.notes ?? '',   // sin notas → campo vacío al editar
    })
    setFormError(null)
    setModal('edit')
  }
  const openView = (driver: Driver) => { setSelected(driver); setModal('view') }
  const openDelete = (driver: Driver) => { setSelected(driver); setDeleteError(null); setModal('delete') }
  const closeModal = () => {
    setModal('none')
    setSelected(null)
    setPhotoFile(null)
    setRemovePhoto(false)
  }

  // Valida y guarda la foto elegida (por clic o arrastrando)
  const handlePhoto = (f: File | null) => {
    if (f && (!PHOTO_TYPES.includes(f.type) || f.size > MAX_PHOTO)) {
      setFormError('La foto debe ser JPG, PNG o WebP y pesar máximo 5 MB')
      setPhotoFile(null)
      return
    }
    setFormError(null)
    setPhotoFile(f)
    if (f) setRemovePhoto(false)   // elegir una foto nueva cancela el "eliminar"
  }

  // ── Validación ───────────────────────────────────────────────────────────────
  // Acepta: +52 55 1234 5678 | 5512345678 | +525512345678 | 55 1234-5678, etc.
  // Regla: prefijo de país opcional (+1..+99) + exactamente 10 dígitos

  function isValidPhone(val: string): boolean {
    if (!val.trim()) return true           // opcional
    const digits = val.replace(/\D/g, '')
    // con lada: 12-13 dígitos totales (2 lada + 10 número)
    // sin lada: exactamente 10
    if (digits.length === 10) return true
    if (digits.length >= 11 && digits.length <= 13) return true
    return false
  }

  function validateForm(): string | null {
    if (!form.name.trim())            return 'El nombre completo es requerido'
    if (!form.employee_number.trim()) return 'El número de empleado es requerido'
    if (!form.license_number.trim())  return 'El número de licencia es requerido'
    if (!form.license_expiry)         return 'El vencimiento de licencia es requerido'
    if (form.name.trim().length > MAX_NAME)             return `El nombre no puede exceder ${MAX_NAME} caracteres`
    if (form.employee_number.trim().length > MAX_EMPLOYEE) return `El número de empleado no puede exceder ${MAX_EMPLOYEE} caracteres`
    if (form.license_number.trim().length > MAX_LICENSE)   return `El número de licencia no puede exceder ${MAX_LICENSE} caracteres`
    if (form.notes.trim().length > MAX_NOTES)           return `Las notas no pueden exceder ${MAX_NOTES} caracteres`
    if (!form.phone.trim())           return 'El teléfono principal es requerido'
    if (!isValidPhone(form.phone))
      return 'El teléfono principal debe tener 10 dígitos más lada (ej. +52 55 1234 5678)'
    if (form.phone_secondary.trim() && !isValidPhone(form.phone_secondary))
      return 'El teléfono secundario debe tener 10 dígitos más lada'
    return null
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (modal === 'create') {
        // 1. Si hay foto: subirla (queda en tmp/) y obtener su photo_id
        const photo_id = photoFile ? await uploadPhoto(photoFile, token) : null

        // 2. Crear el conductor (JSON normal, sin el archivo)
        const res = await fetch(`${API}/drivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...toPayload(form), photo_id }),
        })
        if (res.status === 409) throw new Error('Ya existe un conductor con esos datos')
        if (res.status === 400) throw new Error('La foto no es válida o no se pudo procesar')
        if (!res.ok) throw new Error('No se pudo crear el conductor')
      } else if (modal === 'edit' && selected) {
        // 1. Si eligió una foto nueva: subirla y obtener su photo_id
        const photo_id = photoFile ? await uploadPhoto(photoFile, token) : null

        // 2. PATCH con los datos; el backend reemplaza o borra la foto vieja
        const res = await fetch(`${API}/drivers/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...toPayload(form),
            photo_id,
            remove_photo: removePhoto && !photoFile,
          }),
        })
        if (res.status === 409) throw new Error('Ya existe un conductor con esos datos')
        if (res.status === 400) throw new Error('La foto no es válida o expiró, vuelve a subirla')
        if (!res.ok) throw new Error('No se pudo actualizar el conductor')
      }
      await fetchDrivers()
      closeModal()
      showToast(modal === 'create' ? 'Conductor creado correctamente' : 'Conductor actualizado correctamente')
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${API}/drivers/${selected.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo eliminar el conductor')
      await fetchDrivers()
      closeModal()
      showToast('Conductor eliminado correctamente')
    } catch {
      setDeleteError('Ocurrió un error al intentar eliminar el conductor.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={ui.page}>
        {/* Encabezado */}
        <div className={ui.header}>
          <div>
            <h2 className={ui.title}>Conductores</h2>
            <p className={ui.subtitle}>
              {loading ? 'Cargando...' : `${drivers.length} conductores registrados`}
            </p>
          </div>
          {isAdmin && (
            <button className={ui.btnPrimary} onClick={openCreate}>
              <IconUserPlus /> Nuevo Conductor
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
              placeholder="Buscar por nombre, número de empleado o licencia..."
              aria-label="Buscar conductores"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select
            className={ui.roleSelect}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="unavailable">No disponible</option>
          </select>
        </div>

        {/* Tabla */}
        <div className={ui.tableCard}>
          <div className={ui.tableScroll}>
            <table className={ui.table} style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nombre completo</th>
                  <th>No. de empleado</th>
                  <th>Teléfono</th>
                  <th>Licencia</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  {isAdmin && <th className={ui.thActions}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 8 : 7}><span className={ui.spinner} />Cargando conductores...</td>
                  </tr>
                ) : error ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 8 : 7}>⚠️ {error}</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 8 : 7}>
                      No se encontraron conductores
                      <span className={ui.stateHint}>Prueba con otro nombre, número de empleado, teléfono o licencia.</span>
                    </td>
                  </tr>
                ) : paginated.map(driver => {
                  const expStatus = driver.licenseExpiry ? getExpiryStatus(driver.licenseExpiry) : 'ok'
                  const expDays   = driver.licenseExpiry && expStatus === 'soon' ? daysUntilExpiry(driver.licenseExpiry) : 0
                  return (
                  <tr
                    key={driver.id}
                    className={dc.rowClickable}
                    tabIndex={0}
                    aria-label={`Ver detalles de ${driver.name}`}
                    onClick={() => openView(driver)}
                    onKeyDown={e => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(driver) }
                    }}
                  >
                    {/* Foto */}
                    <td>
                      <div className={dc.photo}>
                        {driver.photoUrl
                          ? <img src={driver.photoUrl} alt={driver.name} loading="lazy" />
                          : initials(driver.name)}
                      </div>
                    </td>
                    {/* Nombre */}
                    <td><span className={dc.driverName}>{driver.name}</span></td>
                    {/* No. empleado */}
                    <td><span className={dc.empNumber}>{driver.employeeNumber || '—'}</span></td>
                    {/* Teléfono */}
                    <td>
                      <span className={dc.phoneWrap}>
                        {driver.phone || '—'}
                        {driver.phoneSecondary && <span className={dc.phoneBadge}>+1</span>}
                      </span>
                    </td>
                    {/* Licencia */}
                    <td><span className={dc.licenseText}>{driver.licenseNumber || '—'}</span></td>
                    {/* Vencimiento */}
                    <td>
                      {driver.licenseExpiry ? (
                        <div className={dc.expiryWrap}>
                          {expStatus === 'soon' && (
                            <span className={`${dc.expiryBadge} ${dc.expiryBadgeSoon}`}>
                              Vence en {expDays} día{expDays !== 1 ? 's' : ''}
                            </span>
                          )}
                          {expStatus === 'expired' && (
                            <span className={`${dc.expiryBadge} ${dc.expiryBadgeExpired}`}>
                              ⚠ Vencida
                            </span>
                          )}
                          <span className={expStatus !== 'ok' ? dc.expiryDateWarning : dc.expiryDate}>
                            {formatExpiry(driver.licenseExpiry)}
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                    {/* Estado */}
                    <td>
                      <span className={`${dc.statusBadge} ${driver.available ? dc.statusAvailable : dc.statusUnavailable}`}>
                        {driver.available ? 'Disponible' : 'No disponible'}
                      </span>
                    </td>
                    {/* Acciones */}
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()}>
                        <div className={dc.actions}>
                          <button className={dc.action} title="Ver conductor" aria-label={`Ver a ${driver.name}`} onClick={() => openView(driver)}>
                            <IconEye />
                          </button>
                          <button className={dc.action} title="Editar conductor" aria-label={`Editar a ${driver.name}`} onClick={() => openEdit(driver)}>
                            <IconEdit />
                          </button>
                          <button className={dc.action} title="Asignar conductor" aria-label={`Asignar a ${driver.name}`} onClick={() => {}}>
                            <IconUserPlus2 />
                          </button>
                          <button className={`${dc.action} ${dc.actionDanger}`} title="Eliminar conductor" aria-label={`Eliminar a ${driver.name}`} onClick={() => openDelete(driver)}>
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className={ui.pagination}>
              <span className={ui.pageInfo}>
                Página {page} de {totalPages} · {filtered.length} conductores
              </span>
              <div className={ui.pageButtons}>
                <button className={ui.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                <button className={ui.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {(modal === 'create' || modal === 'edit') && (
        <div className={m.overlay}>
          <form
            className={`${m.dialog} ${dc.formDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-modal-title"
            noValidate
            onSubmit={e => { e.preventDefault(); handleSubmit() }}
          >
            <div className={m.header}>
              <div>
                <h2 id="driver-modal-title" className={m.title}>
                  {modal === 'create' ? 'Agregar conductor' : 'Editar conductor'}
                </h2>
                <p className={m.subtitle}>Los campos marcados con * son obligatorios.</p>
              </div>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}>
                <IconClose />
              </button>
            </div>

            <div className={dc.formBody}>
              {/* Columna izquierda: foto (misma UI para crear y editar) */}
              <div className={dc.photoCol}>
                <span className={m.label}>Foto del conductor</span>

                {(() => {
                  // En edición, la foto actual se muestra salvo que se haya marcado para eliminar
                  const currentPhoto = modal === 'edit' && !removePhoto ? selected?.photoUrl ?? null : null
                  const shown = photoPreview ?? currentPhoto
                  return (
                    <>
                      <label
                        className={`${dc.dropzone} ${dragOver ? dc.dropzoneActive : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => {
                          e.preventDefault()
                          setDragOver(false)
                          handlePhoto(e.dataTransfer.files?.[0] ?? null)
                        }}
                      >
                        <input
                          className={dc.fileInput}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Foto del conductor"
                          onChange={e => {
                            handlePhoto(e.target.files?.[0] ?? null)
                            e.target.value = ''
                          }}
                        />
                        {shown ? (
                          <img src={shown} alt="Foto del conductor" />
                        ) : (
                          <span className={dc.dropText}>
                            <IconImagePlus />
                            Arrastra o haz clic
                          </span>
                        )}
                      </label>

                      {photoPreview && (
                        <button type="button" className={dc.photoRemove} onClick={() => setPhotoFile(null)}>
                          {modal === 'edit' ? 'Descartar nueva foto' : 'Quitar foto'}
                        </button>
                      )}
                      {!photoPreview && currentPhoto && (
                        <button type="button" className={dc.photoRemove} onClick={() => setRemovePhoto(true)}>
                          Eliminar foto actual
                        </button>
                      )}
                      {removePhoto && (
                        <button type="button" className={dc.photoRemove} onClick={() => setRemovePhoto(false)}>
                          Deshacer
                        </button>
                      )}
                      <p className={`${m.hint} ${dc.photoHint}`}>JPG, PNG o WebP, máximo 5 MB.</p>
                    </>
                  )
                })()}
              </div>

              {/* Columna derecha: datos */}
              <div className={dc.fields}>
                <div className={m.field}>
                  <label className={m.label} htmlFor="dm-name">Nombre completo<span className={m.req}>*</span></label>
                  <input id="dm-name" className={m.input} type="text" autoFocus
                    placeholder="Ej. Juan Pérez Ramírez" maxLength={MAX_NAME}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div className={m.field}>
                  <label className={m.label} htmlFor="dm-emp">Número de empleado<span className={m.req}>*</span></label>
                  <input id="dm-emp" className={m.input} type="text" placeholder="EMP-1017" maxLength={MAX_EMPLOYEE}
                    value={form.employee_number}
                    onChange={e => setForm(f => ({ ...f, employee_number: e.target.value }))} />
                </div>

                <div className={dc.twoCols}>
                  <div className={m.field}>
                    <label className={m.label} htmlFor="dm-lic">Número de licencia de conducir<span className={m.req}>*</span></label>
                    <input id="dm-lic" className={m.input} type="text" placeholder="LFC-0000000" maxLength={MAX_LICENSE}
                      value={form.license_number}
                      onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} />
                  </div>
                  <div className={m.field}>
                    <label className={m.label} htmlFor="dm-exp">Vencimiento de licencia<span className={m.req}>*</span></label>
                    <input id="dm-exp" className={`${m.input} ${dc.dateInput}`} type="date"
                      value={form.license_expiry}
                      onChange={e => setForm(f => ({ ...f, license_expiry: e.target.value }))} />
                  </div>
                </div>

                <div className={m.field}>
                  <span className={m.label}>Teléfonos<span className={m.req}>*</span></span>
                  <p className={m.hint}>Lada + 10 dígitos · ej. +52 55 1234 5678</p>

                  <div className={dc.phoneRow}>
                    <div className={dc.phoneInputWrap}>
                      <IconPhone />
                      <input className={m.input} type="tel" aria-label="Teléfono principal" aria-required="true"
                        placeholder="+52 55 1234 5678"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: limitPhone(e.target.value, f.phone) }))} />
                    </div>
                    <span className={`${dc.phoneTag} ${dc.phoneTagPrimary}`}><IconStar /> Principal</span>
                  </div>

                  <div className={dc.phoneRow}>
                    <div className={dc.phoneInputWrap}>
                      <IconPhone />
                      <input className={m.input} type="tel" aria-label="Teléfono secundario"
                        placeholder="+52 55 8765 4321"
                        value={form.phone_secondary}
                        onChange={e => setForm(f => ({ ...f, phone_secondary: limitPhone(e.target.value, f.phone_secondary) }))} />
                    </div>
                    <span className={dc.phoneTag}>Secundario</span>
                  </div>
                </div>

                <div className={m.field}>
                  <label className={m.label} htmlFor="dm-notes">Notas</label>
                  <textarea id="dm-notes" className={dc.textarea} rows={3} maxLength={MAX_NOTES}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  <p className={`${m.hint} ${dc.notesHint}`}>
                    <span>Opcional. Certificaciones, restricciones o comentarios.</span>
                    <span>{form.notes.length}/{MAX_NOTES}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className={m.footer}>
              {formError && <p className={`${m.error} ${m.footerNote}`} role="alert">{formError}</p>}
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cancelar</button>
              <button type="submit" className={`${m.btn} ${m.btnPrimary}`} disabled={submitting}>
                <IconSave />
                {submitting ? 'Guardando...' : modal === 'create' ? 'Guardar conductor' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {modal === 'view' && selected && (() => {
        const expStatus = selected.licenseExpiry ? getExpiryStatus(selected.licenseExpiry) : 'ok'
        const expDays   = selected.licenseExpiry && expStatus === 'soon' ? daysUntilExpiry(selected.licenseExpiry) : 0
        return (
          <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}>
            <div className={`${m.dialog} ${dc.detailDialog}`} role="dialog" aria-modal="true" aria-labelledby="driver-detail-title">
              <div className={m.header}>
                <div className={dc.detailHead}>
                  <div className={dc.detailAvatar}>
                    {selected.photoUrl
                      ? <img src={selected.photoUrl} alt={selected.name} />
                      : initials(selected.name)}
                  </div>
                  <div className={dc.detailHeadText}>
                    <h2 id="driver-detail-title" className={m.title}>{selected.name}</h2>
                    <p className={m.subtitle}>{selected.employeeNumber || 'Sin número de empleado'}</p>
                  </div>
                </div>
                <div className={dc.detailHeadRight}>
                  <span className={`${dc.statusBadge} ${selected.available ? dc.statusAvailable : dc.statusUnavailable}`}>
                    {selected.available ? 'Disponible' : 'No disponible'}
                  </span>
                  <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}><IconClose /></button>
                </div>
              </div>

              <div className={m.body}>
                <dl className={dc.detailGrid}>
                  <div>
                    <dt className={dc.detailLabel}>Número de empleado</dt>
                    <dd className={`${dc.detailValue} ${dc.mono}`}>{selected.employeeNumber || '—'}</dd>
                  </div>
                  <div>
                    <dt className={dc.detailLabel}>Licencia de conducir</dt>
                    <dd className={`${dc.detailValue} ${dc.mono}`}>{selected.licenseNumber || '—'}</dd>
                  </div>

                  <div>
                    <dt className={dc.detailLabel}>Vencimiento de licencia</dt>
                    <dd className={dc.detailValue}>
                      {selected.licenseExpiry ? (
                        <span className={dc.detailExpiry}>
                          <span className={expStatus !== 'ok' ? dc.detailExpiryWarn : undefined}>
                            {formatExpiry(selected.licenseExpiry)}
                          </span>
                          {expStatus === 'soon' && (
                            <span className={`${dc.expiryBadge} ${dc.expiryBadgeSoon}`}>
                              Vence en {expDays} día{expDays !== 1 ? 's' : ''}
                            </span>
                          )}
                          {expStatus === 'expired' && (
                            <span className={`${dc.expiryBadge} ${dc.expiryBadgeExpired}`}>⚠ Vencida</span>
                          )}
                        </span>
                      ) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className={dc.detailLabel}>Teléfonos</dt>
                    <dd className={dc.detailValue}>
                      <span className={dc.detailPhone}>
                        {selected.phone || '—'}
                        {selected.phone && <span className={dc.detailTag}>Principal</span>}
                      </span>
                      {selected.phoneSecondary && (
                        <span className={dc.detailPhone}>
                          {selected.phoneSecondary}
                          <span className={dc.detailTag}>Secundario</span>
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className={dc.detailFull}>
                    <dt className={dc.detailLabel}>Notas</dt>
                    <dd className={`${dc.detailValue} ${dc.detailNotes} ${!selected.notes ? dc.detailNotesEmpty : ''}`}>
                      {selected.notes || 'Sin notas'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={m.footer}>
                <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cerrar</button>
                {isAdmin && (
                  <button type="button" className={`${m.btn} ${m.btnPrimary}`} onClick={() => openEdit(selected)}>
                    <IconEdit /> Editar conductor
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="alertdialog" aria-modal="true" aria-labelledby="driver-delete-title">
            <div className={m.header}>
              <h2 id="driver-delete-title" className={m.title}>Eliminar conductor</h2>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              <p className={m.message}>
                ¿Estás seguro de que deseas eliminar a <strong>{selected.name}</strong>?
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