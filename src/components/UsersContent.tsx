import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import EyeIcon from './EyeIcon'
import m from './UsersModal.module.css'        // modales de usuarios
import ui from './UsersView.module.css'        // vista de lista de usuarios


// ── Types ──────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'monitoring' | 'conductor'

interface User {
  id: number
  user_id: string
  name: string
  username: string
  email: string
  role: Role
  active: boolean
  createdAt: string
  lastAccess: string
  phone: string
  recovery_email: string
  clientes_information?: { client_id: number; client_name: string }[] | 'all'
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

interface Client {
  id: string
  name: string
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

type RoleFilter = 'all' | Role

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
const IconKey = () => (
  <svg {...svgProps}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.8-9.8M16 7l3 3M14 9l2 2" />
  </svg>
)
const IconUserX = () => (
  <svg {...svgProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m17 8 5 5M22 8l-5 5" />
  </svg>
)
const IconUserCheck = () => (
  <svg {...svgProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m16 11 2 2 4-4" />
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
const IconMail = () => (
  <svg {...svgProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
)
const IconSave = () => (
  <svg {...svgProps}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
)
const IconTrash = () => (
  <svg {...svgProps}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────────
const ROLE_HINTS: Record<string, string> = {
  admin:      'Acceso completo a la plataforma y gestión de usuarios',
  monitoring: 'Monitorea viajes en vivo y atiende alertas',
  operator:   'Opera rutas y viajes asignados',
}

// Contraseña temporal aleatoria: se usa cuando el usuario define la suya mediante la invitación
function tempPassword() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

// "Hoy, 07:42" · "Ayer, 19:25" · "28 sep 2026, 16:03"
function formatDate(iso: string | null | undefined,empty = '—') {
  if (!iso) return empty
  const d = new Date(iso)
  if (isNaN(d.getTime())) return empty

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (diffDays === 0) return `Hoy, ${time}`
  if (diffDays === 1) return `Ayer, ${time}`
  const date = d
    .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
  return `${date}, ${time}`
}

function roleClass(role: Role) {
  if (role === 'admin')      return ui.roleAdmin
  if (role === 'monitoring') return ui.roleMonitor
  if (role === 'conductor')  return ui.roleConductor
  return ui.roleOther
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function UsersContent() {
  const { token, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [users,   setUsers]   = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [page,   setPage]   = useState(1)

  type Modal = 'none' | 'create' | 'edit' | 'delete' | 'reset'
  const [modal,      setModal]      = useState<Modal>('none')
  const [selected,   setSelected]   = useState<User | null>(null)
  const [form,       setForm]       = useState<UserForm>(EMPTY_FORM)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [sendInvitation, setSendInvitation] = useState(false)

  // Empresas (clientes) asignables al usuario
  const [clients,        setClients]        = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError,   setClientsError]   = useState<string | null>(null)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])

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
        id:                   index,
        user_id:              String(u.user_id ?? ''),
        name:                 String(u.name ?? u.username ?? ''),
        username:             String(u.username ?? ''),
        email:                String(u.email ?? ''),
        role:                 String(u.role ?? 'monitoring') as Role,
        active:               u.status === 1,
        createdAt:            String(u.created_at ?? ''),
        lastAccess:           String(u.last_login_at ?? ''),
        phone:                String(u.phone ?? ''),
        recovery_email:       String(u.recovery_email ?? ''),
        clientes_information: u.clientes_information === 'all'
          ? 'all'
          : Array.isArray(u.clientes_information)
            ? (u.clientes_information as { client_id: number; client_name: string }[])
            : [],
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
    const q = search.trim().toLowerCase()

    return users
      .filter(u =>
        (roleFilter === 'all' || u.role === roleFilter) &&
        (u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, roleFilter])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Toggle status ────────────────────────────────────────────────────────────
  const handleToggle = async (user: User) => {
    const updated = { ...user, active: !user.active }
    setUsers(prev => prev.map(u => u.id === user.id ? updated : u))
    try {
      await fetch(`${API}/users/${user.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: updated.active ? 1 : 0 }),
      })
    } catch {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u))
    }
  }

  // ── Clientes (empresas) ──────────────────────────────────────────────────────
  const fetchClients = async (): Promise<Client[]> => {
    setClientsLoading(true)
    setClientsError(null)
    try {
      const res = await fetch(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const data: Client[] = Array.isArray(json.data) ? json.data : []
      setClients(data)
      return data
    } catch {
      setClientsError('No se pudieron cargar las empresas.')
      return []
    } finally {
      setClientsLoading(false)
    }
  }

  const toggleClient = (id: string) =>
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const allClientsSelected = clients.length > 0 && selectedClientIds.length === clients.length
  const toggleAllClients = () =>
    setSelectedClientIds(allClientsSelected ? [] : clients.map(c => c.id))

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedClientIds([])
    fetchClients()
    setForm(EMPTY_FORM)
    setFormError(null)
    setSelected(null)
    setShowPassword(false)
    setSendInvitation(true)
    setModal('create')
  }
  const openEdit = async (user: User) => {
    setSelected(user)
    setForm({
      name:           user.name,
      username:       user.username,
      email:          user.email,
      phone:          user.phone,
      password_hash:  '',
      recovery_email: user.recovery_email,
      role:           user.role,
    })
    setFormError(null)
    setShowPassword(false)
    setModal('edit')
    // Cargar empresas y luego preseleccionar las del usuario
    const allClients = await fetchClients()
    const preselected = user.clientes_information === 'all'
      ? allClients.map(c => c.id)
      : (user.clientes_information ?? []).map(c => String(c.client_id))
    setSelectedClientIds(preselected)
  }
  const openDelete = (user: User) => { setSelected(user); setDeleteError(null); setModal('delete') }
  const openReset = (user: User) => { setSelected(user); setResetError(null); setModal('reset') }
  const closeModal = () => { setModal('none'); setSelected(null); setShowPassword(false) }

  useEffect(() => {
    if (modal === 'none') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, submitting]) // closeModal es estable en la práctica

  // ── Submit ───────────────────────────────────────────────────────────────────
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isValidPhone = (phone: string) => /^\d{10}$/.test(phone.trim())

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim()) {
      setFormError('Nombre y usuario son requeridos')
      return
    }
    if (!form.email.trim()) {
      setFormError('El correo electrónico es requerido')
      return
    }
    if (!isValidEmail(form.email.trim())) {
      setFormError('El correo electrónico no es válido')
      return
    }
    if (!form.recovery_email.trim()) {
      setFormError('El correo de recuperación es requerido')
      return
    }
    if (!isValidEmail(form.recovery_email.trim())) {
      setFormError('El correo de recuperación no es válido')
      return
    }
    if (!form.phone.trim()) {
      setFormError('El teléfono es requerido')
      return
    }
    if (!isValidPhone(form.phone)) {
      setFormError('El teléfono debe tener exactamente 10 dígitos')
      return
    }
    if (modal === 'create' && !sendInvitation && !form.password_hash.trim()) {
      setFormError('La contraseña es requerida')
      return
    }
    if (selected?.clientes_information !== 'all' && selectedClientIds.length === 0) {
      setFormError('Debes asignar al menos una empresa')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      if (modal === 'create') {
        const res = await fetch(`${API}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...form,
            password_hash: sendInvitation ? tempPassword() : form.password_hash,
            send_invitation: sendInvitation,
            clients_information: clients
              .filter(c => selectedClientIds.includes(c.id))
              .map(c => ({ client_id: Number(c.id), client_name: c.name })),
          }),
        })
        if (!res.ok) throw new Error('No se pudo crear el usuario')
      } else if (modal === 'edit' && selected) {
        const payload: Partial<UserForm> & { clients_information?: { client_id: number; client_name: string }[] } = {}

        if (form.name          !== selected.username)     payload.name           = form.name
        if (form.username      !== selected.username)     payload.username       = form.username
        if (form.email         !== selected.email)        payload.email          = form.email
        if (form.role          !== selected.role)         payload.role           = form.role
        if (form.phone.trim())                            payload.phone          = form.phone
        if (form.recovery_email.trim())                   payload.recovery_email = form.recovery_email
        if (form.password_hash.trim())                    payload.password_hash  = form.password_hash

        payload.clients_information = clients
          .filter(c => selectedClientIds.includes(c.id))
          .map(c => ({ client_id: Number(c.id), client_name: c.name }))

        const res = await fetch(`${API}/users/${selected.user_id}`, {
          method: 'PATCH',
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
    setDeleteError(null)
    try {
      const res = await fetch(`${API}/users/${selected.user_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) {
        setDeleteError('Este usuario es el dueño de la cuenta y no puede eliminarse.')
        return
      }
      if (!res.ok) throw new Error('No se pudo eliminar el usuario')
      await fetchUsers()
      closeModal()
      showToast('Usuario eliminado correctamente')
    } catch {
      setDeleteError('Ocurrió un error al intentar eliminar el usuario.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset password (envía el enlace de recuperación al correo del usuario) ───
  const handleReset = async () => {
    if (!selected) return
    setSubmitting(true)
    setResetError(null)
    try {
      const res = await fetch(`${API}/auth/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selected.email }),
      })
      if (!res.ok) throw new Error()
      const email = selected.email
      closeModal()
      showToast(`Enlace de restablecimiento enviado a ${email}`)
    } catch {
      setResetError('No se pudo enviar el enlace. Intenta de nuevo.')
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
            <h2 className={ui.title}>Usuarios del sistema</h2>
            <p className={ui.subtitle}>
              Administradores, monitoristas y conductores con acceso a la plataforma.
            </p>
          </div>
          {isAdmin && (
            <button className={ui.btnPrimary} onClick={openCreate}>
              <IconUserPlus /> Agregar Usuario
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
              placeholder="Buscar por nombre o correo..."
              aria-label="Buscar por nombre o correo"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select
            className={ui.roleSelect}
            aria-label="Filtrar por rol"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="monitoring">Monitorista</option>
            <option value="conductor">Conductor</option>
          </select>
        </div>

        {/* Tabla */}
        <div className={ui.tableCard}>
          <div className={ui.tableScroll}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo electrónico</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Fecha de creación</th>
                  <th>Último acceso</th>
                  {isAdmin && <th className={ui.thActions}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 7 : 6}><span className={ui.spinner} />Cargando usuarios...</td>
                  </tr>
                ) : error ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 7 : 6}>⚠️ {error}</td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr className={ui.stateRow}>
                    <td colSpan={isAdmin ? 7 : 6}>
                      No se encontraron usuarios
                      <span className={ui.stateHint}>Prueba con otro nombre, correo o rol.</span>
                    </td>
                  </tr>
                ) : paginated.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className={ui.userCell}>
                        <div className={ui.avatar}>{initials(user.username)}</div>
                        <div>
                          <div className={ui.userName}>{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className={ui.email}>{user.email}</td>
                    <td>
                      <span className={`${ui.pill} ${roleClass(user.role)}`}>{translateRole(user.role)}</span>
                    </td>
                    <td>
                      <span className={`${ui.pill} ${user.active ? ui.statusActive : ui.statusInactive}`}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className={ui.date}>{formatDate(user.createdAt)}</td>
                    <td className={ui.date}>{formatDate(user.lastAccess,'Sin accesar')}</td>
                    {isAdmin && (
                      <td>
                        <div className={ui.actions}>
                          <button className={ui.action} onClick={() => openEdit(user)}
                            title="Editar usuario" aria-label={`Editar a ${user.username}`}>
                            <IconEdit />
                          </button>
                          <button className={ui.action} onClick={() => openReset(user)}
                            title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${user.username}`}>
                            <IconKey />
                          </button>
                          <button className={ui.action} onClick={() => handleToggle(user)}
                            disabled={user.role === 'admin'}
                            title={user.role === 'admin'
                              ? 'No se puede desactivar un administrador'
                              : user.active ? 'Desactivar usuario' : 'Activar usuario'}
                            aria-label={user.active ? `Desactivar a ${user.username}` : `Activar a ${user.username}`}>
                            {user.active ? <IconUserX /> : <IconUserCheck />}
                          </button>
                          <button className={`${ui.action} ${ui.actionDanger}`} onClick={() => openDelete(user)}
                            title="Eliminar usuario" aria-label={`Eliminar a ${user.username}`}>
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
                Página {page} de {totalPages} · {filtered.length} usuarios
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
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <form
            className={m.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            noValidate
            onSubmit={e => { e.preventDefault(); handleSubmit() }}
          >
            <div className={m.header}>
              <div>
                <h2 id="user-modal-title" className={m.title}>
                  {modal === 'create' ? 'Agregar usuario' : 'Editar usuario'}
                </h2>
                <p className={m.subtitle}>
                  {modal === 'create'
                    ? 'Usuarios internos con acceso a la plataforma (no conductores).'
                    : `Actualiza los datos de ${selected?.username ?? 'este usuario'}.`}
                </p>
              </div>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}>
                <IconClose />
              </button>
            </div>

            <div className={m.body}>
              <div className={m.field}>
                <label className={m.label} htmlFor="um-name">Nombre completo<span className={m.req}>*</span></label>
                <input id="um-name" className={m.input} type="text" autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className={m.grid}>
                <div className={m.field}>
                  <label className={m.label} htmlFor="um-email">Correo electrónico<span className={m.req}>*</span></label>
                  <input id="um-email" className={m.input} type="email" placeholder="nombre@empresa.mx"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className={m.field}>
                  <label className={m.label} htmlFor="um-phone">Teléfono</label>
                  <input id="um-phone" className={m.input} type="tel" placeholder="5512345678"
                    maxLength={10}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                </div>

                <div className={m.field}>
                  <label className={m.label} htmlFor="um-role">Rol</label>
                  <select id="um-role" className={m.select} value={form.role}
                    disabled={modal === 'edit' && selected?.role === 'admin'}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                    <option value="admin">Administrador</option>
                    <option value="monitoring">Monitorista</option>
                    <option value="operator">Operador</option>
                  </select>
                  <p className={m.hint}>
                    {modal === 'edit' && selected?.role === 'admin'
                      ? 'El rol de administrador no puede modificarse.'
                      : ROLE_HINTS[form.role]}
                  </p>
                </div>
                <div className={m.field}>
                  <label className={m.label} htmlFor="um-username">Nombre de usuario<span className={m.req}>*</span></label>
                  <input id="um-username" className={m.input} type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>

                <div className={`${m.field} ${m.full}`}>
                  <label className={m.label} htmlFor="um-recovery">Correo de recuperación</label>
                  <input id="um-recovery" className={m.input} type="email" placeholder="recuperacion@empresa.mx"
                    value={form.recovery_email}
                    onChange={e => setForm(f => ({ ...f, recovery_email: e.target.value }))} />
                </div>
              </div>

              <div className={m.field}>
                  <span className={m.label} id="um-clients">
                    Empresas asignadas
                    {selected?.clientes_information !== 'all' && selectedClientIds.length > 0 && (
                      <span className={m.checkCount}> · {selectedClientIds.length} seleccionada{selectedClientIds.length > 1 ? 's' : ''}</span>
                    )}
                  </span>

                  {/* Owner de cuenta: solo leyenda, sin edición */}
                  {modal === 'edit' && selected?.clientes_information === 'all' ? (
                    <p className={m.hint}>Este usuario tiene acceso a todas las empresas de la cuenta.</p>
                  ) : (
                    <>
                      {clientsLoading && <p className={m.hint}>Cargando empresas...</p>}

                      {clientsError && (
                        <p className={m.error} role="alert">
                          {clientsError}{' '}
                          <button type="button" className={m.linkBtn} onClick={fetchClients}>Reintentar</button>
                        </p>
                      )}

                      {!clientsLoading && !clientsError && clients.length === 0 && (
                        <p className={m.hint}>No hay empresas disponibles.</p>
                      )}

                      {clients.length > 0 && (
                        <div className={m.checklist} role="group" aria-labelledby="um-clients">
                          <label className={`${m.checkItem} ${m.checkAll}`}>
                            <input type="checkbox" checked={allClientsSelected} onChange={toggleAllClients} />
                            <span>Seleccionar todas</span>
                          </label>
                          {clients.map(c => (
                            <label key={c.id} className={m.checkItem}>
                              <input type="checkbox"
                                checked={selectedClientIds.includes(c.id)}
                                onChange={() => toggleClient(c.id)} />
                              <span>{c.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

              {modal === 'create' && (
                <div className={m.field}>
                  <span className={m.label} id="um-access">Acceso</span>
                  <div className={m.options} role="radiogroup" aria-labelledby="um-access">
                    <button type="button" role="radio" aria-checked={sendInvitation}
                      className={`${m.option} ${sendInvitation ? m.optionOn : ''}`}
                      onClick={() => setSendInvitation(true)}>
                      <IconMail />
                      <span className={m.optionText}>
                        <span className={m.optionTitle}>Enviar invitación por correo</span>
                        <span className={m.optionDesc}>El usuario define su contraseña</span>
                      </span>
                    </button>
                    <button type="button" role="radio" aria-checked={!sendInvitation}
                      className={`${m.option} ${!sendInvitation ? m.optionOn : ''}`}
                      onClick={() => setSendInvitation(false)}>
                      <IconKey />
                      <span className={m.optionText}>
                        <span className={m.optionTitle}>Asignar contraseña</span>
                        <span className={m.optionDesc}>Compártela de forma segura</span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {modal === 'create' && !sendInvitation && (
                <div className={m.field}>
                  <label className={m.label} htmlFor="um-password">
                    Contraseña<span className={m.req}>*</span>
                  </label>
                  <div className={m.passwordWrap}>
                    <input id="um-password" className={m.input}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={form.password_hash}
                      onChange={e => setForm(f => ({ ...f, password_hash: e.target.value }))} />
                    <button type="button" className={m.eye}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword(v => !v)}>
                      <EyeIcon visible={showPassword} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={m.footer}>
              {formError && <p className={`${m.error} ${m.footerNote}`} role="alert">{formError}</p>}
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cancelar</button>
              <button type="submit" className={`${m.btn} ${m.btnPrimary}`} disabled={submitting}>
                <IconSave />
                {submitting ? 'Guardando...' : modal === 'create' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal === 'delete' && selected && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="alertdialog" aria-modal="true" aria-labelledby="user-delete-title">
            <div className={m.header}>
              <h2 id="user-delete-title" className={m.title}>Eliminar usuario</h2>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              <p className={m.message}>
                ¿Estás seguro de que deseas eliminar a <strong>{selected.username}</strong>?
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

      {/* ── Reset Password Confirm Modal ── */}
      {modal === 'reset' && selected && (
        <div className={m.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) closeModal() }}>
          <div className={`${m.dialog} ${m.dialogSm}`} role="dialog" aria-modal="true" aria-labelledby="user-reset-title">
            <div className={m.header}>
              <h2 id="user-reset-title" className={m.title}>Restablecer contraseña</h2>
              <button type="button" className={m.close} aria-label="Cerrar" onClick={closeModal}><IconClose /></button>
            </div>
            <div className={m.body}>
              <p className={m.message}>
                Se enviará un enlace para crear una nueva contraseña a <strong>{selected.email}</strong>.
              </p>
              {resetError && <p className={m.error} role="alert">{resetError}</p>}
            </div>
            <div className={m.footer}>
              <button type="button" className={`${m.btn} ${m.btnGhost}`} onClick={closeModal}>Cancelar</button>
              <button type="button" className={`${m.btn} ${m.btnPrimary}`} onClick={handleReset} disabled={submitting}>
                <IconMail />
                {submitting ? 'Enviando...' : 'Enviar enlace'}
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