import styles from './LeftPanel.module.css'

const stats = [
  { color: 'green', label: '1,240 vehicles en linea' },
  { color: 'blue',  label: '98.6% cumplimiento de ruta hoy' },
  { color: 'yellow', label: '47 rutas activas justo ahora' },
]

export default function LeftPanel() {
  return (
    <div className={styles.panel}>
      {/* Animated waves */}
      <div className={styles.waveBg}>
        <svg className={styles.waves} viewBox="0 0 1440 560" preserveAspectRatio="none">
          <path className={`${styles.wave} ${styles.wave1}`} d="M0,280 C360,180 720,380 1440,280 L1440,560 L0,560 Z" />
          <path className={`${styles.wave} ${styles.wave2}`} d="M0,320 C400,220 800,420 1440,300 L1440,560 L0,560 Z" />
          <path className={`${styles.wave} ${styles.wave3}`} d="M0,350 C300,250 900,450 1440,330 L1440,560 L0,560 Z" />
        </svg>
      </div>

      {/* Logo */}
      <div className={styles.logo}>
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#38BDF8"/>
        </svg>
        <span>RouteOS</span>
      </div>

      {/* Hero */}
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>Cada ruta,<br />perfectamente monitoreada.</h1>
        <p className={styles.heroSubtitle}>
          Información de flota en tiempo real para operadores que no pueden permitirse el lujo de adivinar.
        </p>
      </div>

      {/* Stats */}
      <div className={styles.statsBadges}>
        {stats.map(({ color, label }) => (
          <div key={label} className={styles.badge}>
            <span className={`${styles.dot} ${styles[color as 'green' | 'blue' | 'yellow']}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <p className={styles.trustedText}>Con la confianza de más de 120 empresas de flotas en toda Latinoamérica.</p>
    </div>
  )
}
