import { useState } from 'react'
import { Link } from 'react-router-dom'
import LeftPanel from '../components/LeftPanel'
import styles from './ForgotPasswordPage.module.css'

type Step = 'form' | 'sent'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email) {
      setError('Por favor ingresa tu correo')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await fetch(`http://localhost:8084/auth/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStep('sent')
    } catch {
      setError('No se pudo conectar al servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <LeftPanel />

      <div className={styles.right}>
        <div className={styles.container}>

          {step === 'form' ? (
            <>
              <div className={styles.iconWrap}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#38BDF8"/>
                </svg>
              </div>

              <h2 className={styles.title}>¿Olvidaste tu contraseña?</h2>
              <p className={styles.subtitle}>
                Ingresa tu correo y te enviaremos un enlace para recuperarla.
              </p>
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#9CA3AF"/>
                  </svg>
                </span>
                <input
                  className={styles.inputField}
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoComplete="email"
                />
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>

              <Link to="/login" className={styles.backLink}>
                ← Volver al inicio de sesión
              </Link>
            </>
          ) : (
            <>
              <div className={styles.successIcon}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.5"/>
                  <path d="M8 12l3 3 5-5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h2 className={styles.title}>Revisa tu correo</h2>
              <p className={styles.subtitle}>
                Si <strong className={styles.emailHighlight}>{email}</strong> está registrado,
                recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className={styles.hint}>
                ¿No lo ves? Revisa tu carpeta de spam.
              </p>

              <Link to="/login" className={styles.submitBtn} style={{ textDecoration: 'none', textAlign: 'center', lineHeight: '52px' }}>
                Volver al inicio de sesión
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
