import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import LeftPanel from '../components/LeftPanel'
import EyeIcon from '../components/EyeIcon'
import styles from './ResetPasswordPage.module.css'

type Step = 'form' | 'success'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [token] = useState(searchParams.get('token') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')

  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!token) {
    setError('Link inválido. Solicita un nuevo correo de recuperación.')
    return
    }
    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`http://localhost:8084/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail?.message || 'Token inválido o expirado')
        return
      }

      setStep('success')
      setTimeout(() => navigate('/login'), 3000)

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
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="#38BDF8"/>
                </svg>
              </div>

              <h2 className={styles.title}>Nueva contraseña</h2>
              <p className={styles.subtitle}>
                Ingresa el token que recibiste y tu nueva contraseña.
              </p>



              {/* Nueva contraseña */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="#9CA3AF"/>
                  </svg>
                </span>
                <input
                  className={styles.inputField}
                  type={showNew ? 'text' : 'password'}
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError(null) }}
                />
                <button className={styles.eyeBtn} onClick={() => setShowNew(v => !v)} type="button">
                  <EyeIcon visible={showNew} />
                </button>
              </div>

              {/* Confirmar contraseña */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="#9CA3AF"/>
                  </svg>
                </span>
                <input
                  className={styles.inputField}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
                />
                <button className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)} type="button">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Guardando...' : 'Restablecer contraseña'}
              </button>

              <Link to="/forgot-password" className={styles.backLink}>
                ← Volver
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
              <h2 className={styles.title}>¡Contraseña restablecida!</h2>
              <p className={styles.subtitle}>
                Tu contraseña fue actualizada correctamente. Serás redirigido al login en unos segundos...
              </p>
              <Link to="/login" className={styles.submitBtn} style={{ textDecoration: 'none', textAlign: 'center', lineHeight: '52px' }}>
                Ir al inicio de sesión
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
