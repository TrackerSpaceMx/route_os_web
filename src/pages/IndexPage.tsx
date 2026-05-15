import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UsersContent from '../components/UsersContent'
import styles from './IndexPage.module.css'

// ── Iconos inline ──────────────────────────────────────────────────────────────
const IconRoute = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
  </svg>
)
const IconList = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconTracking = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
  </svg>
)
const IconCustom = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Tipos ──────────────────────────────────────────────────────────────────────
type View = 'home' | 'route-config' | 'my-routes' | 'live-tracking' | 'users' | 'customization' | 'settings'

// ── Contenidos de cada vista ───────────────────────────────────────────────────
function HomeContent() {
  return (
    <div className={styles.homeContent}>
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeIcon}><IconRoute /></div>
        <h1 className={styles.welcomeTitle}>Bienvenido al Dashboard</h1>
        <p className={styles.welcomeSubtitle}>Has iniciado sesión correctamente en RouteOS</p>
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#22c55e' }} />
          <div><p className={styles.statValue}>1,240</p><p className={styles.statLabel}>Vehículos en línea</p></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#60a5fa' }} />
          <div><p className={styles.statValue}>98.6%</p><p className={styles.statLabel}>Cumplimiento de ruta hoy</p></div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.dot} style={{ background: '#facc15' }} />
          <div><p className={styles.statValue}>47</p><p className={styles.statLabel}>Rutas activas ahora</p></div>
        </div>
      </div>
    </div>
  )
}

function RouteConfigContent() {
  return (
    <div className={styles.panelContent}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Route Configuration</h2>
        <p className={styles.panelSubtitle}>Plan and assign a new route</p>
      </div>
      <div className={styles.formSection}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Route Name</label>
          <input className={styles.input} type="text" placeholder="ruta 01" />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Vehicle</label>
            <input className={styles.input} type="text" placeholder="Seleccionar..." />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Operator</label>
            <input className={styles.input} type="text" placeholder="Seleccionar..." />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Schedule</label>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.labelSmall}>Start Time</label>
              <input className={styles.input} type="time" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.labelSmall}>End Time</label>
              <input className={styles.input} type="time" />
            </div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Repeat Days</label>
          <div className={styles.daysRow}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <button key={i} className={`${styles.dayBtn} ${i < 5 ? styles.dayActive : ''}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Waypoints</label>
          <div className={styles.waypointSearch}>
            <IconSearch />
            <input className={styles.waypointInput} type="text" placeholder="Search address or location..." />
            <button className={styles.addBtn}>+</button>
          </div>
          <div className={styles.waypointItem}>
            <span className={styles.dragHandle}>⠿</span>
            <span className={styles.waypointNum}>1</span>
            <span className={styles.waypointName}>HQ Warehouse (Start)</span>
            <button className={styles.deleteBtn}>🗑</button>
          </div>
        </div>
      </div>
      <div className={styles.panelActions}>
        <button className={styles.btnClear}>Clear</button>
        <button className={styles.btnPreview}>Preview</button>
        <button className={styles.btnSave}>Save</button>
      </div>
    </div>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className={styles.placeholderContent}>
      <p className={styles.placeholderTitle}>{title}</p>
      <p className={styles.placeholderSub}>Próximamente disponible</p>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function IndexPage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<View>('home')
  const [routePlannerOpen, setRoutePlannerOpen] = useState(true)

  const displayName = user?.username ?? 'Usuario'
  const displayRole = user?.role ?? ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const handleLogout = () => { logout(); navigate('/login') }
  const navTo = (view: View) => setActiveView(view)

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo} onClick={() => navTo('home')}>
          <IconRoute /><span>RouteOS</span>
        </div>

        <nav className={styles.nav}>
          {/* Route Planner con submenú */}
          <div className={styles.navGroup}>
            <button
              className={`${styles.navItem} ${activeView === 'route-config' ? styles.navActive : ''}`}
              onClick={() => setRoutePlannerOpen(o => !o)}
            >
              <IconRoute /><span>Route Planner</span><IconChevron open={routePlannerOpen} />
            </button>
            {routePlannerOpen && (
              <div className={styles.subMenu}>
                <button
                  className={`${styles.subItem} ${activeView === 'route-config' ? styles.subActive : ''}`}
                  onClick={() => navTo('route-config')}
                >
                  Route Configuration
                </button>
              </div>
            )}
          </div>

          <button className={`${styles.navItem} ${activeView === 'my-routes' ? styles.navActive : ''}`} onClick={() => navTo('my-routes')}>
            <IconList /><span>My Routes</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'live-tracking' ? styles.navActive : ''}`} onClick={() => navTo('live-tracking')}>
            <IconTracking /><span>Live Tracking</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'users' ? styles.navActive : ''}`} onClick={() => navTo('users')}>
            <IconUsers /><span>Usuarios</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'customization' ? styles.navActive : ''}`} onClick={() => navTo('customization')}>
            <IconCustom /><span>Customization</span>
          </button>
          <button className={`${styles.navItem} ${activeView === 'settings' ? styles.navActive : ''}`} onClick={() => navTo('settings')}>
            <IconSettings /><span>Settings</span>
          </button>
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <IconLogout /><span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.mainWrapper}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.searchBar}>
            <IconSearch />
            <input type="text" placeholder="Search routes, users, or vehicles..." className={styles.searchInput} />
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.bellBtn}><IconBell /></button>
            <div className={styles.userChip}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>{displayName}</span>
                <span className={styles.userRole}>{displayRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={styles.content}>
          {activeView === 'home'          && <HomeContent />}
          {activeView === 'route-config'  && <RouteConfigContent />}
          {activeView === 'my-routes'     && <PlaceholderContent title="My Routes" />}
          {activeView === 'live-tracking' && <PlaceholderContent title="Live Tracking" />}
          {activeView === 'users'         && <UsersContent />}
          {activeView === 'customization' && <PlaceholderContent title="Customization" />}
          {activeView === 'settings'      && <PlaceholderContent title="Settings" />}
        </main>
      </div>
    </div>
  )
}