import type { ReactNode } from 'react'
import styles from './Sidebar.module.css'

export type View =
  | 'home' | 'route-config' | 'my-routes' | 'trip-assignment' | 'live-tracking'
  | 'users' | 'drivers' | 'points' | 'protocols'

// Cambia aquí el nombre de marca si es necesario
const BRAND_NAME = 'RouteOS'
const BRAND_TAGLINE = 'Logística GPS'

const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const icons = {
  brand: (
    <Svg>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
    </Svg>
  ),
  routeConfig: (
    <Svg><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></Svg>
  ),
  myRoutes: (
    <Svg><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
  ),
  trips: (
    <Svg>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </Svg>
  ),
  live: (
    <Svg><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></Svg>
  ),
  users: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  drivers: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="10" r="3" />
      <path d="M7 21v-1a5 5 0 0 1 10 0v1" />
    </Svg>
  ),
  points: (
    <Svg><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
  ),
  protocols: (
    <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>
  ),
  custom: (
    <Svg><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Svg>
  ),
  settings: (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  ),
  logout: (
    <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>
  ),
}

interface NavEntry { view: View; label: string; icon: ReactNode; adminOnly?: boolean }

const NAV: NavEntry[] = [
  { view: 'route-config',    label: 'Crear Rutas',          icon: icons.routeConfig, adminOnly: true },
  { view: 'my-routes',       label: 'Mis Rutas',            icon: icons.myRoutes },
  { view: 'trip-assignment', label: 'Asignación de Viajes', icon: icons.trips },
  { view: 'live-tracking',   label: 'Monitoreo en Vivo',    icon: icons.live },
  { view: 'drivers',         label: 'Conductores',          icon: icons.drivers },
  { view: 'points',          label: 'Puntos de interés',    icon: icons.points },
  { view: 'protocols',       label: 'Protocolos',           icon: icons.protocols },
  { view: 'users',           label: 'Usuarios',             icon: icons.users },
]

export const VIEW_TITLES: Record<View, string> = {
  home: 'Inicio',
  'route-config': 'Crear Rutas',
  'my-routes': 'Mis Rutas',
  'trip-assignment': 'Asignación de Viajes',
  'live-tracking': 'Monitoreo en Vivo',
  users: 'Usuarios del Sistema',
  drivers: 'Conductores',
  points: 'Puntos de interés',
  protocols: 'Protocolos',
}

interface Props {
  activeView: View
  isAdmin: boolean
  onNavigate: (view: View) => void
  onLogout: () => void
}

export default function Sidebar({ activeView, isAdmin, onNavigate, onLogout }: Props) {
  return (
    <aside className={styles.sidebar}>
      <button type="button" className={styles.brand} onClick={() => onNavigate('home')}>
        <span className={styles.brandMark}>{icons.brand}</span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{BRAND_NAME}</span>
          <span className={styles.brandTagline}>{BRAND_TAGLINE}</span>
        </span>
      </button>

      <nav className={styles.nav} aria-label="Navegación principal">
        {NAV.filter(n => !n.adminOnly || isAdmin).map(n => {
          const active = activeView === n.view
          return (
            <button
              key={n.view}
              type="button"
              className={`${styles.item} ${active ? styles.active : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(n.view)}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <button type="button" className={`${styles.item} ${styles.logout}`} onClick={onLogout}>
          {icons.logout}
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}