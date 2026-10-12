import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './UsersContent.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type Sex = 'male' | 'female' | 'other'

interface Driver {
  id: string
  name: string
  sex: Sex
  phone: string
  address: string
}

interface DriverForm {
  name: string
  sex: Sex
  phone: string
  address: string
}

const EMPTY_FORM: DriverForm = {
  name: '',
  sex: 'male',
  phone: '',
  address: '',
}

const API = 'http://localhost:8084'
const PAGE_SIZE = 8

function translateSex(sex: Sex) {
  switch (sex) {
    case 'male':   return 'Masculino'
    case 'female': return 'Femenino'
    default:       return 'Masculino'
  }
}

function sexBadgeClass(sex: Sex) {
  if (sex === 'male')   return styles.badgeAdmin
  if (sex === 'female') return styles.badgeConductor
  return styles.badgeOperador
}

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DriversContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [drivers,     setDrivers]    = useState<Driver[]>([])
  const [loading,     setLoading]    = useState(true)
  const [error,       setError]      = useState<string | null>(null)
  const [search,      setSearch]     = useState('')
  const [page,        setPage]       = useState(1)

  type Modal = 'none' | 'create' | 'edit' | 'delete'
  const [modal,       setModal]      = useState<Modal>('none')
  const [selected,    setSelected]   = useState<Driver | null>(null)
  const [form,        setForm]       = useState<DriverForm>(EMPTY_FORM)
  const [formError,   setFormError]  = useState<string | null>(null)
  const [submitting,  setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [toast,       setToast]      = useState<string | null>(null)

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
        id:      String(d.id ?? ''),
        name:    String(d.name    ?? 'Sin nombre'),
        sex:     ((d.gender ?? d.sex) as Sex) ?? 'other',
        phone:   String(d.phone   ?? '—'),
        address: String(d.address ?? '—'),
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
    return drivers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q)
    )
  }, [drivers, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setSelected(null)
    setModal('create')
  }
  const openEdit = (driver: Driver) => {
    setSelected(driver)
    setForm({ name: driver.name, sex: driver.sex, phone: driver.phone, address: driver.address })
    setFormError(null)
    setModal('edit')
  }
  const openDelete = (driver: Driver) => { setSelected(driver); setDeleteError(null); setModal('delete') }
  const closeModal = () => { setModal('none'); setSelected(null) }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre es requerido')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      if (modal === 'create') {
        const res = await fetch(`${API}/drivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('No se pudo crear el conductor')
      } else if (modal === 'edit' && selected) {
        const res = await fetch(`${API}/drivers/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        })
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Conductores</h2>
          <p>Gestiona los conductores registrados en el sistema</p>
        </div>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={openCreate}>
            <IconPlus /> Nuevo Conductor
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
              placeholder="Buscar conductores..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className={styles.showingText}>
            Mostrando {filtered.length} {filtered.length === 1 ? 'conductor' : 'conductores'}
          </span>
        </div>

        {/* Table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Conductor</th>
              <th>Género</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              {isAdmin && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 5 : 4}><span className={styles.spinner} />Cargando conductores...</td>
              </tr>
            ) : error ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 5 : 4}>⚠️ {error}</td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 5 : 4}>No se encontraron conductores</td>
              </tr>
            ) : paginated.map(driver => (
              <tr key={driver.id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>{initials(driver.name)}</div>
                    <div className={styles.userNameText}>{driver.name}</div>
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${sexBadgeClass(driver.sex)}`}>
                    {translateSex(driver.sex)}
                  </span>
                </td>
                <td>{driver.phone}</td>
                <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {driver.address}
                </td>
                {isAdmin && (
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.btnIcon} onClick={() => openEdit(driver)} title="Editar">
                        <IconEdit />
                      </button>
                      <button
                        className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                        onClick={() => openDelete(driver)}
                        title="Eliminar"
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

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <div className={styles.pageButtons}>
            <button className={styles.btnPage} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className={styles.btnPage} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {(modal === 'create' || modal === 'edit') && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>
              {modal === 'create' ? 'Nuevo Conductor' : 'Editar Conductor'}
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre completo</label>
              <input className={styles.input} type="text" placeholder="Ej. Juan García López"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Sexo</label>
              <select className={styles.select} value={form.sex}
                onChange={e => setForm(f => ({ ...f, sex: e.target.value as Sex }))}>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Teléfono</label>
              <input className={styles.input} type="tel" placeholder="+525512345678"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Dirección</label>
              <input className={styles.input} type="text" placeholder="Av. Insurgentes Sur 123, CDMX"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>

            {formError && <p className={styles.errorMsg}>{formError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando...' : modal === 'create' ? 'Crear Conductor' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Eliminar Conductor</p>
            <p className={styles.deleteWarning}>
              ¿Estás seguro de que deseas eliminar a <strong>{selected.name}</strong>?
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