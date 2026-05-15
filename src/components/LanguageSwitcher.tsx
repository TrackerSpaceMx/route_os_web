import { useState } from 'react'
import type { Language } from '../types/auth'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Language>('EN')

  return (
    <div className={styles.switcher}>
      <span className={styles.flag}></span>
      {(['ES', 'EN'] as Language[]).map((l, i) => (
        <>
          {i > 0 && <span key={`sep-${l}`} className={styles.sep}>/</span>}
          <button
            key={l}
            className={`${styles.btn} ${lang === l ? styles.active : styles.inactive}`}
            onClick={() => setLang(l)}
          >
            {l}
          </button>
        </>
      ))}
    </div>
  )
}
