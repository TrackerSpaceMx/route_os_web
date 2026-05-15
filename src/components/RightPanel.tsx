import PinIcon from './PinIcon'
import LoginForm from './LoginForm'
import LanguageSwitcher from './LanguageSwitcher'
import styles from './RightPanel.module.css'

export default function RightPanel() {
  return (
    <div className={styles.panel}>
      

      <div className={styles.container}>
        <div className={styles.pinIcon}>
        <PinIcon />
      </div>
        <h2 className={styles.title}>Bienvenido</h2>
        <p className={styles.subtitle}>Iniciar sesión</p>

        <LoginForm />

        <div className={styles.divider}>
          <span className={styles.dividerText}>Por PSLOG</span>
        </div>

        {/* <p className={styles.noAccount}>
          Do?{' '}
          <a href="#" className={styles.contactLink}>Contáctate con tu administrador</a>
        </p> */}

        <LanguageSwitcher />
      </div>
    </div>
  )
}
