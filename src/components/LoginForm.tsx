import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { LoginFormData } from '../types/auth'
import EmailIcon from './EmailIcon'
import LockIcon from './LockIcon'
import EyeIcon from './EyeIcon'
import styles from './LoginForm.module.css'


export default function LoginForm() {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
    rememberMe: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'rememberMe' ? e.target.checked : e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!formData.username || !formData.password) {
      setError('Por favor ingresa tu usuario y contraseña')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`http://localhost:8084/auth/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Credenciales incorrectas')
        return
      }

      const data = await res.json()
      const payload = JSON.parse(atob(data.token.split(".")[1]))
      login(data.token, { username: payload.sub, role: payload.role })
      navigate('/index')

    } catch {
      setError('No se pudo conectar al servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.fields}>
      {/* Email */}
      <div className={styles.inputGroup}>
        <span className={styles.inputIcon}><EmailIcon /></span>
        <input
          className={styles.inputField}
          type="text"
          placeholder="Usuario"
          value={formData.username}
          onChange={handleChange('username')}
          autoComplete="usuario"
        />
      </div>

      {/* Password */}
      <div className={styles.inputGroup}>
        <span className={styles.inputIcon}><LockIcon /></span>
        <input
          className={styles.inputField}
          type={showPassword ? 'text' : 'password'}
          placeholder="Contraseña"
          value={formData.password}
          onChange={handleChange('password')}
          autoComplete="current-password"
        />
        <button
          className={styles.eyeBtn}
          onClick={() => setShowPassword(v => !v)}
          type="button"
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <EyeIcon visible={showPassword} />
        </button>
      </div>

      {/* Error */}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {/* Remember me + Forgot */}
      <div className={styles.formRow}>
        <label className={styles.checkboxLabel}>
          <div
            className={`${styles.customCheckbox} ${formData.rememberMe ? styles.checked : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, rememberMe: !prev.rememberMe }))}
            role="checkbox"
            aria-checked={formData.rememberMe}
          >
            {formData.rememberMe && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span>Recordarme</span>
        </label>
        <Link to="/forgot-password" className={styles.forgotLink}>¿Olvidaste tu contraseña?</Link>
      </div>

      {/* Submit */}
      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        type="button"
        disabled={loading}
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </div>
  )
}