import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './UsersContent.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'monitoring' | 'conductor'

interface User {
  id: number
  username: string
  email: string
  role: Role
  active: boolean
  createdAt: string
}

interface UserForm {
  name: string
  username: string
  email: string
  phone: string
  password_hash: string
  recovery_email: string
  role: Role
}

const EMPTY_FORM: UserForm = {
  name: '',
  username: '',
  email: '',
  phone: '',
  password_hash: '',
  recovery_email: '',
  role: 'monitoring',
}

const API = 'http://localhost:8084'
const PAGE_SIZE = 8

function translateRole(role: Role) {
  switch (role) {
    case 'admin':
      return 'Administrador'

    case 'monitoring':
      return 'Monitorista'

    case 'conductor':
      return 'Conductor'

    default:
      return role
  }
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
const IconAdmin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="currentColor"/>
  </svg>
)
const IconUser = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function roleBadgeClass(role: Role) {
  if (role === 'admin')     return styles.badgeAdmin
  if (role === 'conductor') return styles.badgeConductor
  return styles.badgeOperador
}

function roleBadgeIcon(role: Role) {
  return role === 'admin' ? <IconAdmin /> : <IconUser />
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function UsersContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  type Modal = 'none' | 'create' | 'edit' | 'delete'
  const [modal,      setModal]      = useState<Modal>('none')
  const [selected,   setSelected]   = useState<User | null>(null)
  const [form,       setForm]       = useState<UserForm>(EMPTY_FORM)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar usuarios')
      const json = await res.json()
      const raw: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : []
      const normalized: User[] = raw.map((u, index) => ({
        id:        index,
        username:  String(u.username ?? 'Sin nombre'),
        email:     String(u.email ?? ''),
        role:      String(u.role ?? 'monitoring') as Role,
        active:    u.status === 1,
        createdAt: String(u.created_at ?? ''),
      }))
      setUsers(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, []) // eslint-disable-line react-hooks/exhaustive-deps

const filtered = useMemo(() => {
  const q = search.toLowerCase()

  return users
    .filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    )

}, [users, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  // ── Toggle status ────────────────────────────────────────────────────────────
  const handleToggle = async (user: User) => {
    const updated = { ...user, active: !user.active }
    setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
    try {
      await fetch(`${API}/users/${user.username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: user.username, status: updated.active ? 1 : 0 }),
      })
    } catch {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u))
    }
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setSelected(null)
    setModal('create')
  }
  const openEdit = (user: User) => {
    setSelected(user)
    setForm({
      name: user.username,
      username: user.username,
      email: user.email,
      phone: '',
      password_hash: '',
      recovery_email: '',
      role: user.role,
    })
    setFormError(null)
    setModal('edit')
  }
  const openDelete = (user: User) => { setSelected(user); setModal('delete') }
  const closeModal = () => { setModal('none'); setSelected(null) }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setFormError('Nombre, usuario y email son requeridos')
      return
    }
    if (modal === 'create' && !form.password_hash.trim()) {
      setFormError('La contraseña es requerida')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (modal === 'create') {
        const res = await fetch(`${API}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('No se pudo crear el usuario')
      } else if (modal === 'edit' && selected) {
        const payload: Partial<UserForm> = {
          name: form.name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          recovery_email: form.recovery_email,
          role: form.role,
        }
        if (form.password_hash.trim()) payload.password_hash = form.password_hash
        const res = await fetch(`${API}/users/${selected.username}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('No se pudo actualizar el usuario')
      }
      await fetchUsers()
      closeModal()
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
    try {
      await fetch(`${API}/users/${selected.username}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchUsers()
      closeModal()
    } catch {
      closeModal()
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
          <h2>Administración de usuarios</h2>
          <p>Administra los usuarios y sus roles</p>
        </div>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={openCreate}>
            <IconPlus /> Nuevo Usuario
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
              placeholder="Buscar usuarios..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className={styles.showingText}>
            Mostrando {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>

        {/* Table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Fecha de creación</th>
              <th>Email</th>
              {isAdmin && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 6 : 5}><span className={styles.spinner} />Cargando usuarios...</td>
              </tr>
            ) : error ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 6 : 5}>⚠️ {error}</td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr className={styles.stateRow}>
                <td colSpan={isAdmin ? 6 : 5}>No se encontraron usuarios</td>
              </tr>
            ) : paginated.map(user => (
              <tr key={user.id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>{initials(user.username)}</div>
                    <div className={styles.userNameText}>{user.username}</div>
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${roleBadgeClass(user.role)}`}>
                    {roleBadgeIcon(user.role)}
                    {translateRole(user.role)}
                  </span>
                </td>
                <td>
                  <label className={styles.toggle} title={!isAdmin ? 'Solo los administradores pueden cambiar el estado' : user.role === 'admin' ? 'No se puede desactivar un administrador' : undefined}>
                    <input
                      type="checkbox"
                      checked={user.active}
                      onChange={() => handleToggle(user)}
                      disabled={!isAdmin || user.role === 'admin'}
                    />
                    <span className={styles.toggleTrack} />
                    <span className={styles.toggleThumb} />
                  </label>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{user.email}</td>
                {isAdmin && (
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.btnIcon} onClick={() => openEdit(user)} title="Editar">
                        <IconEdit />
                      </button>
                      <button
                        className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                        onClick={() => openDelete(user)}
                        title={user.role === 'admin' ? 'No se puede eliminar un administrador' : 'Eliminar'}
                        disabled={user.role === 'admin'}
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
            <p className={styles.modalTitle}>{modal === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'}</p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre completo</label>
              <input className={styles.input} type="text" placeholder="Diego Argueta"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre de usuario</label>
              <input className={styles.input} type="text" placeholder="argueta777"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Correo electrónico</label>
              <input className={styles.input} type="email" placeholder="correo@empresa.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Correo de recuperación</label>
              <input className={styles.input} type="email" placeholder="recuperacion@empresa.com"
                value={form.recovery_email}
                onChange={e => setForm(f => ({ ...f, recovery_email: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Teléfono</label>
              <input className={styles.input} type="tel" placeholder="5215512345678"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                {modal === 'edit' ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
              </label>
              <input className={styles.input} type="password" placeholder="••••••••"
                value={form.password_hash}
                onChange={e => setForm(f => ({ ...f, password_hash: e.target.value }))} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Rol</label>
              <select className={styles.select} value={form.role}
                disabled={modal === 'edit' && selected?.role === 'admin'}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                <option value="admin">Administrador</option>
                <option value="monitoring">Monitorista</option>
                <option value="operator">Operador</option>
              </select>
              {modal === 'edit' && selected?.role === 'admin' && (
                <p className={styles.lockedHint}>El rol de administrador no puede modificarse.</p>
              )}
            </div>

            {formError && <p className={styles.errorMsg}>{formError}</p>}

            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Guardando...' : modal === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Eliminar Usuario</p>
            <p className={styles.deleteWarning}>
              ¿Estás seguro de que deseas eliminar a <strong>{selected.username}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={closeModal}>Cancelar</button>
              <button className={styles.btnDelete} onClick={handleDelete} disabled={submitting}>
                {submitting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}