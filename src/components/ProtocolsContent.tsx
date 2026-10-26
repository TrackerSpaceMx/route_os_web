import { useState, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import m  from './UsersModal.module.css'
import ui from './UsersView.module.css'
import pc from './ProtocolsContent.module.css'

// ── Types ──────────────────────────────────────────────────────────────────────
type Severity    = 'critical' | 'high' | 'medium' | 'low'
type ThresholdUnit = 'seconds' | 'minutes' | 'hour' | 'km' | 'count'
type ActionType  = 'call_operator' | 'send_email' | 'engine_stop'

interface RuleAction {
  action_type: ActionType
  delay_minutes: number
  escalate: boolean
}

interface RuleForm {
  rule_type: string
  is_enabled: boolean
  severity: Severity
  risk_impact: number
  threshold_value: number
  threshold_unit: ThresholdUnit
  params: null
  actions: RuleAction[]
  // UI only
  _expanded: boolean
  _showActionPicker: boolean
}

interface ProtocolForm {
  name: string
  description: string
  is_default: boolean
  rules: RuleForm[]
}

interface Protocol {
  id: string
  display_id: number
  name: string
  description: string
  is_default: boolean
  created_at: string
  created_by: string
  active_rules: number
}

const API       = 'http://localhost:8084'
const PAGE_SIZE = 8

// ── Rule type catalogue ────────────────────────────────────────────────────────
interface RuleMeta {
  label: string
  thresholdLabel: string
  defaultUnit: ThresholdUnit
  defaultThreshold: number
  defaultSeverity: Severity
  defaultImpact: number
  defaultActions: RuleAction[]
  alwaysActive?: boolean
}

const act = (action_type: ActionType, delay_minutes: number, escalate = false): RuleAction =>
  ({ action_type, delay_minutes, escalate })

const RULE_META: Record<string, RuleMeta> = {
  // ── Alertas de seguridad (siempre activas) ──
  panic: {
    label: 'Pánico', thresholdLabel: 'Tiempo de confirmación',
    defaultUnit: 'seconds', defaultThreshold: 0, defaultSeverity: 'critical', defaultImpact: 100,
    defaultActions: [act('call_operator', 0, true), act('send_email', 0), act('engine_stop', 5)],
    alwaysActive: true,
  },
  battery_disconnected: {
    label: 'Batería Desconectada', thresholdLabel: 'Tiempo sin energía',
    defaultUnit: 'minutes', defaultThreshold: 1, defaultSeverity: 'high', defaultImpact: 80,
    defaultActions: [act('call_operator', 1, true), act('send_email', 0)],
    alwaysActive: true,
  },
  jammer_detected: {
    label: 'Jammer Detectado', thresholdLabel: 'Duración de interferencia',
    defaultUnit: 'seconds', defaultThreshold: 30, defaultSeverity: 'critical', defaultImpact: 95,
    defaultActions: [act('call_operator', 0, true), act('send_email', 0)],
    alwaysActive: true,
  },

  // ── Ruta y zonas ──
  risk_zone: {
    label: 'Zonas de Riesgo', thresholdLabel: 'Permanencia máxima',
    defaultUnit: 'minutes', defaultThreshold: 5, defaultSeverity: 'high', defaultImpact: 70,
    defaultActions: [act('call_operator', 1)],
  },
  signal_loss: {
    label: 'Pérdida de Señal', thresholdLabel: 'Tiempo sin reporte GPS',
    defaultUnit: 'minutes', defaultThreshold: 10, defaultSeverity: 'medium', defaultImpact: 50,
    defaultActions: [act('call_operator', 2)],
  },
  route_deviation: {
    label: 'Desvío de Ruta', thresholdLabel: 'Distancia fuera de ruta',
    defaultUnit: 'km', defaultThreshold: 2, defaultSeverity: 'high', defaultImpact: 60,
    defaultActions: [act('call_operator', 1), act('send_email', 0)],
  },
  restricted_stop: {
    label: 'Paradas Restringidas', thresholdLabel: 'Duración de la parada',
    defaultUnit: 'minutes', defaultThreshold: 5, defaultSeverity: 'high', defaultImpact: 65,
    defaultActions: [act('call_operator', 1)],
  },
  authorized_stop: {
    label: 'Paradas Autorizadas', thresholdLabel: 'Duración máxima permitida',
    defaultUnit: 'minutes', defaultThreshold: 30, defaultSeverity: 'low', defaultImpact: 15,
    defaultActions: [],
  },
  restricted_hours: {
    label: 'Horarios Restringidos', thresholdLabel: 'Inicio de restricción',
    defaultUnit: 'hour', defaultThreshold: 22, defaultSeverity: 'medium', defaultImpact: 40,
    defaultActions: [act('send_email', 0)],
  },

  // ── Controles operativos ──
  unload_dwell: {
    label: 'Estadía en Descarga', thresholdLabel: 'Tiempo máximo en descarga',
    defaultUnit: 'minutes', defaultThreshold: 45, defaultSeverity: 'medium', defaultImpact: 30,
    defaultActions: [act('send_email', 0)],
  },
  rest_dwell: {
    label: 'Estadía de Descanso', thresholdLabel: 'Descanso máximo',
    defaultUnit: 'minutes', defaultThreshold: 30, defaultSeverity: 'low', defaultImpact: 20,
    defaultActions: [],
  },
  suspicious_call: {
    label: 'Llamada Sospechosa', thresholdLabel: 'Llamadas no autorizadas',
    defaultUnit: 'count', defaultThreshold: 1, defaultSeverity: 'high', defaultImpact: 55,
    defaultActions: [act('call_operator', 1)],
  },
  route_start_validation: {
    label: 'Validación de Inicio de Ruta', thresholdLabel: 'Tolerancia de salida',
    defaultUnit: 'minutes', defaultThreshold: 15, defaultSeverity: 'medium', defaultImpact: 25,
    defaultActions: [act('send_email', 0)],
  },
  return_time_validation: {
    label: 'Validación de Tiempo de Regreso', thresholdLabel: 'Tolerancia de regreso',
    defaultUnit: 'minutes', defaultThreshold: 30, defaultSeverity: 'medium', defaultImpact: 25,
    defaultActions: [act('send_email', 0)],
  },
}

interface RuleGroup {
  id: string
  title: string
  subtitle: string
  locked?: boolean
  rules: string[]
}

const RULE_GROUPS: RuleGroup[] = [
  {
    id: 'security',
    title: 'Alertas de Seguridad',
    subtitle: 'Siempre activas. No pueden desactivarse por viaje.',
    locked: true,
    rules: ['panic', 'battery_disconnected', 'jammer_detected'],
  },
  {
    id: 'route',
    title: 'Ruta y Zonas',
    subtitle: 'Geocercas, paradas y apego a la ruta planeada.',
    rules: ['risk_zone', 'signal_loss', 'route_deviation', 'restricted_stop', 'authorized_stop', 'restricted_hours'],
  },
  {
    id: 'operations',
    title: 'Controles Operativos',
    subtitle: 'Tiempos de estadía, validaciones y comportamiento del operador.',
    // route_start_validation y return_time_validation siguen definidas en RULE_META, pero
    // se ocultan hasta que el backend las agregue a RuleType (si no, la API responde 422).
    // Para mostrarlas de nuevo, añádelas a esta lista.
    rules: ['unload_dwell', 'rest_dwell', 'suspicious_call'],
  },
]

const ALL_RULE_TYPES = RULE_GROUPS.flatMap(g => g.rules)

const UNIT_SHORT: Record<ThresholdUnit, string> = {
  seconds: 'seg', minutes: 'min', hour: 'h', km: 'km', count: 'llamadas',
}
function unitLabel(unit: ThresholdUnit, value: number) {
  return unit === 'count' && value === 1 ? 'llamada' : UNIT_SHORT[unit]
}

const ACTION_META: Record<ActionType, { label: string }> = {
  call_operator:            { label: 'Llamar al operador' },
  send_email:               { label: 'Correo electrónico' },
  engine_stop: { label: 'Enviar comando de paro de motor' },
}

const ALL_ACTION_TYPES: ActionType[] = [
  'call_operator',
  'send_email',
  'engine_stop',
]

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

// ── Default empty protocol form ────────────────────────────────────────────────
function makeRule(rule_type: string): RuleForm {
  const meta = RULE_META[rule_type]
  return {
    rule_type,
    // Las alertas de seguridad nacen activas; el resto desactivadas por defecto
    is_enabled: !!meta.alwaysActive,
    severity: meta.defaultSeverity,
    risk_impact: meta.defaultImpact,
    threshold_value: meta.defaultThreshold,
    threshold_unit: meta.defaultUnit,
    params: null,
    actions: meta.defaultActions.map(a => ({ ...a })),
    _expanded: false,
    _showActionPicker: false,
  }
}

// Todas las reglas del catálogo, colapsadas (solo las de seguridad activas)
const buildDefaultRules = (): RuleForm[] => ALL_RULE_TYPES.map(makeRule)

const makeEmptyForm = (): ProtocolForm => ({
  name: '',
  description: '',
  is_default: false,
  rules: buildDefaultRules(),
})

// ── Icons ──────────────────────────────────────────────────────────────────────
const svgProps = {
  width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}
const IconSearch    = () => <svg {...svgProps} width={16} height={16}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
const IconEdit      = () => <svg {...svgProps}><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
const IconTrash     = () => <svg {...svgProps}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>
const IconPlus      = () => <svg {...svgProps} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>
const IconClose     = () => <svg {...svgProps} width={20} height={20}><path d="M18 6 6 18M6 6l12 12" /></svg>
const IconSave      = () => <svg {...svgProps}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
const IconShield    = () => <svg {...svgProps} width={16} height={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
const IconStar      = () => <svg {...svgProps} width={14} height={14} fill="currentColor" stroke="none"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
const IconLock      = () => <svg {...svgProps} width={13} height={13}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
const IconChevron   = ({ up }: { up?: boolean }) => <svg {...svgProps} width={16} height={16} style={up ? { transform: 'rotate(180deg)' } : {}}><path d="m6 9 6 6 6-6" /></svg>
const IconBolt      = () => <svg {...svgProps} width={15} height={15}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
const IconPhone     = () => <svg {...svgProps} width={15} height={15}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
const IconMail      = () => <svg {...svgProps} width={15} height={15}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
const IconPower     = () => <svg {...svgProps} width={15} height={15}><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" /></svg>

// ── Rule type icon ─────────────────────────────────────────────────────────────
const RULE_ICON_PATHS: Record<string, ReactNode> = {
  panic: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4M12 16h.01" /></>,
  battery_disconnected: <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2M6 11v2" /></>,
  jammer_detected: <><circle cx="12" cy="12" r="2" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M8.46 8.46a5 5 0 0 0 0 7.07M15.54 8.46a5 5 0 0 1 0 7.07" /></>,
  risk_zone: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  signal_loss: <><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M16.4 11.1A10 10 0 0 1 19 12.9M12 20h.01" /></>,
  route_deviation: <><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>,
  restricted_stop: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>,
  authorized_stop: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  restricted_hours: <><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5M17.5 17.5 16 16.3V14" /><circle cx="16" cy="16" r="6" /></>,
  unload_dwell: <><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  rest_dwell: <><path d="M10 2v2M14 2v2M6 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /></>,
  suspicious_call: <><path d="M13 2a9 9 0 0 1 9 9M13 6a5 5 0 0 1 5 5" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></>,
  route_start_validation: <><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4V8z" /></>,
  return_time_validation: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
}

function RuleIcon({ ruleType }: { ruleType: string }) {
  return (
    <svg {...svgProps} width={16} height={16}>
      {RULE_ICON_PATHS[ruleType] ?? <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>}
    </svg>
  )
}

const GROUP_ICONS: Record<string, ReactNode> = {
  security: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  route: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  operations: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
}

function ActionIcon({ type }: { type: ActionType }) {
  if (type === 'call_operator')            return <IconPhone />
  if (type === 'send_email')               return <IconMail />
  if (type === 'engine_stop') return <IconPower />
  return <IconBolt />
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}
function initials(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`${pc.toggle} ${checked ? pc.toggleOn : ''} ${disabled ? pc.toggleDisabled : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    />
  )
}

// ── Rule card ──────────────────────────────────────────────────────────────────
function RuleCard({
  rule, index,
  onChange,
}: {
  rule: RuleForm
  index: number
  onChange: (idx: number, patch: Partial<RuleForm>) => void
}) {
  const meta      = RULE_META[rule.rule_type]
  const unitText  = unitLabel(rule.threshold_unit, rule.threshold_value)
  const off       = !rule.is_enabled
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!rule._showActionPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onChange(index, { _showActionPicker: false })
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [rule._showActionPicker, index, onChange])

  const usedTypes = rule.actions.map(a => a.action_type)
  const available = ALL_ACTION_TYPES.filter(t => !usedTypes.includes(t))

  const addAction = (type: ActionType) => {
    const newAction: RuleAction = { action_type: type, delay_minutes: 1, escalate: false }
    onChange(index, { actions: [...rule.actions, newAction], _showActionPicker: false })
  }

  const updateAction = (ai: number, patch: Partial<RuleAction>) => {
    const next = rule.actions.map((a, i) => i === ai ? { ...a, ...patch } : a)
    onChange(index, { actions: next })
  }

  const removeAction = (ai: number) => {
    onChange(index, { actions: rule.actions.filter((_, i) => i !== ai) })
  }

  return (
    <div className={`${pc.ruleCard} ${off ? pc.ruleCardOff : ''}`}>
      {/* ── Rule header ── */}
      <div className={pc.ruleHeader}>
        <Toggle
          checked={rule.is_enabled}
          onChange={v => onChange(index, { is_enabled: v })}
          disabled={meta?.alwaysActive}
        />
        <span className={pc.ruleIconWrap}><RuleIcon ruleType={rule.rule_type} /></span>
        <div className={`${pc.ruleTitleBlock} ${off ? pc.dimmed : ''}`}>
          <span className={pc.ruleTitle}>{meta?.label ?? rule.rule_type}</span>
          <span className={pc.ruleSummary}>
            {meta?.thresholdLabel}: {rule.threshold_value} {unitText}
            &nbsp;·&nbsp;Impacto {rule.risk_impact}%
            &nbsp;·&nbsp;{rule.actions.length} {rule.actions.length === 1 ? 'acción' : 'acciones'}
          </span>
        </div>

        <div className={pc.ruleHeaderRight}>
          {meta?.alwaysActive && (
            <span className={pc.alwaysActive}><IconLock /> Siempre activo</span>
          )}
          <span className={`${pc.sevBadge} ${pc[`sev_${rule.severity}`]} ${off ? pc.dimmed : ''}`}>
            {SEVERITY_LABELS[rule.severity]}
          </span>
          <button
            type="button"
            className={pc.ruleExpandBtn}
            aria-expanded={rule._expanded}
            aria-label={rule._expanded ? 'Contraer regla' : 'Expandir regla'}
            onClick={() => onChange(index, { _expanded: !rule._expanded })}
          >
            <IconChevron up={rule._expanded} />
          </button>
        </div>
      </div>

      {/* ── Rule body ── */}
      {rule._expanded && (
        <fieldset disabled={off} style={{ border: 'none', padding: 0, margin: 0 }}>
        <div className={pc.ruleBody}>
          <div className={pc.ruleFields}>
            {/* Threshold */}
            <div className={m.field}>
              <label className={m.label}>{meta?.thresholdLabel ?? 'Umbral'}</label>
              <div className={pc.thresholdRow}>
                <input
                  type="number"
                  min={0}
                  className={`${m.input} ${pc.thresholdInput}`}
                  value={rule.threshold_value}
                  onChange={e => onChange(index, { threshold_value: Number(e.target.value) })}
                />
                <span className={pc.thresholdUnit}>{unitText}</span>
              </div>
            </div>

            {/* Severity */}
            <div className={m.field}>
              <label className={m.label}>Severidad</label>
              <select
                className={m.select}
                value={rule.severity}
                onChange={e => onChange(index, { severity: e.target.value as Severity })}
              >
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>

            {/* Risk impact */}
            <div className={m.field}>
              <label className={m.label}>Impacto en riesgo (%)</label>
              <input
                type="number"
                min={0} max={100}
                className={m.input}
                value={rule.risk_impact}
                onChange={e => onChange(index, { risk_impact: Math.min(100, Math.max(0, Number(e.target.value))) })}
              />
            </div>
          </div>

          {/* ── Actions ── */}
          <div className={pc.actionsSection}>
            <div className={pc.actionsHeader}>
              <span className={pc.actionsTitle}>
                <IconBolt /> Acciones automáticas
                <span className={pc.actionsSubtitle}>&nbsp;· se ejecutan al violarse la regla</span>
              </span>
              <div style={{ position: 'relative' }} ref={pickerRef}>
                {available.length > 0 && (
                  <button
                    type="button"
                    className={pc.btnAddAction}
                    onClick={() => onChange(index, { _showActionPicker: !rule._showActionPicker })}
                  >
                    <IconPlus /> Agregar acción
                  </button>
                )}
                {rule._showActionPicker && (
                  <div className={pc.actionPicker}>
                    {available.map(t => (
                      <button
                        key={t}
                        type="button"
                        className={pc.actionPickerItem}
                        onClick={() => addAction(t)}
                      >
                        <span className={pc.actionPickerIcon}><ActionIcon type={t} /></span>
                        {ACTION_META[t].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {rule.actions.length === 0 && (
              <p className={pc.noActions}>Sin acciones configuradas</p>
            )}

            <div className={pc.actionChips}>
              {rule.actions.map((action, ai) => (
                <div key={ai} className={pc.actionChip}>
                  <span className={pc.actionChipIcon}><ActionIcon type={action.action_type} /></span>
                  <span className={pc.actionChipLabel}>{ACTION_META[action.action_type].label}</span>
                  <span className={pc.actionChipDelayLabel}>Retraso</span>
                  <input
                    type="number"
                    min={0}
                    className={pc.actionDelayInput}
                    value={action.delay_minutes}
                    onChange={e => updateAction(ai, { delay_minutes: Number(e.target.value) })}
                  />
                  <span className={pc.actionChipUnit}>min</span>
                  <Toggle
                    checked={action.escalate}
                    onChange={v => updateAction(ai, { escalate: v })}
                  />
                  <span className={pc.actionChipEscalate}>Escalar</span>
                  <button
                    type="button"
                    className={pc.actionChipRemove}
                    onClick={() => removeAction(ai)}
                  >
                    <IconClose />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        </fieldset>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProtocolsContent() {
  const { token } = useAuth()

  const [protocols, setProtocols]   = useState<Protocol[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

  const [showCreate, setShowCreate]     = useState(false)
  const [editTarget, setEditTarget]     = useState<Protocol | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Protocol | null>(null)

  const [form, setForm]         = useState<ProtocolForm>(makeEmptyForm)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch list ─────────────────────────────────────────────────────────────
  const fetchProtocols = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/protocol-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // 204 = sin contenido: no hay protocolos registrados (no hay body que parsear)
      if (res.status === 204) { setProtocols([]); return }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json().catch(() => null)
      setProtocols(json?.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar protocolos')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchProtocols() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered + paginated ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return protocols.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.created_by.toLowerCase().includes(q)
    )
  }, [protocols, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const slice      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search])

  // ── Open modals ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(makeEmptyForm())
    setFormError(null)
    setShowCreate(true)
  }

  const openEdit = (p: Protocol) => {
    // Al editar solo tenemos el resumen; las reglas parten de los valores por defecto
    setForm({ name: p.name, description: p.description, is_default: p.is_default, rules: buildDefaultRules() })
    setFormError(null)
    setEditTarget(p)
  }

  const closeModals = () => {
    setShowCreate(false)
    setEditTarget(null)
    setDeleteTarget(null)
  }

  // ── Rule helpers ───────────────────────────────────────────────────────────
  const updateRule = (idx: number, patch: Partial<RuleForm>) => {
    setForm(f => ({
      ...f,
      rules: f.rules.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }


  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio'); return }
    setSaving(true); setFormError(null)
    try {
      const isEdit = !!editTarget
      const url    = isEdit
        ? `${API}/protocol-profile/${editTarget!.id}`
        : `${API}/protocol-profile`

      // Strip UI-only fields
      const payload = {
        name: form.name,
        description: form.description,
        is_default: form.is_default,
        rules: form.rules.map(({ _expanded: _e, _showActionPicker: _s, ...r }) => ({
          ...r,
          // Las alertas de seguridad siempre van activas
          is_enabled: RULE_META[r.rule_type]?.alwaysActive ? true : r.is_enabled,
        })),
      }

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        // FastAPI/Pydantic devuelve 422 con `detail: [{ loc, msg }]`
        const detail = Array.isArray(j.detail)
          ? j.detail.map((d: { loc?: (string | number)[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg}`).join(' · ')
          : j.detail
        throw new Error(j.message ?? detail ?? `Error ${res.status}`)
      }
      await fetchProtocols()
      closeModals()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API}/protocol-profile/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      await fetchProtocols()
      closeModals()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally { setDeleting(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={ui.page}>

      {/* Header */}
      <div className={ui.header}>
        <div>
          <h2 className={ui.title}>Protocolos</h2>
          <p className={ui.subtitle}>Gestiona los perfiles de protocolo para operaciones de flota</p>
        </div>
        <button className={ui.btnPrimary} onClick={openCreate}>
          <IconPlus /> Nuevo protocolo
        </button>
      </div>

      {/* Filters */}
      <div className={ui.filters}>
        <label className={ui.searchWrap}>
          <IconSearch />
          <input
            className={ui.searchInput}
            type="text"
            placeholder="Buscar por nombre, descripción o autor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      </div>

      {/* Table */}
      <div className={ui.tableCard}>
        <div className={ui.tableScroll}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Protocolo</th>
                <th>Descripción</th>
                <th>Reglas activas</th>
                <th>Creado por</th>
                <th>Fecha</th>
                <th className={ui.thActions}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={ui.stateRow}><td colSpan={7}><span className={ui.spinner} />Cargando protocolos…</td></tr>
              ) : error ? (
                <tr className={ui.stateRow}><td colSpan={7}>⚠ {error}<span className={ui.stateHint}><button className={pc.retryBtn} onClick={fetchProtocols}>Reintentar</button></span></td></tr>
              ) : slice.length === 0 ? (
                <tr className={ui.stateRow}><td colSpan={7}>{search ? 'Sin resultados' : 'Sin protocolos registrados'}<span className={ui.stateHint}>{!search && 'Crea el primer protocolo con el botón de arriba'}</span></td></tr>
              ) : (
                slice.map(p => (
                  <tr key={p.id}>
                    <td className={pc.displayId}>#{p.display_id}</td>
                    <td>
                      <div className={pc.nameCell}>
                        <span className={pc.iconWrap}><IconShield /></span>
                        <div>
                          <div className={pc.protocolName}>
                            {p.name}
                            {p.is_default && <span className={pc.badgeDefault}><IconStar /> Default</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={pc.desc}>{p.description || <span className={pc.empty}>—</span>}</td>
                    <td><span className={pc.rulesBadge}>{p.active_rules} {p.active_rules === 1 ? 'regla' : 'reglas'}</span></td>
                    <td><div className={pc.createdBy}><span className={pc.authorAvatar}>{initials(p.created_by)}</span>{p.created_by}</div></td>
                    <td className={ui.date}>{formatDate(p.created_at)}</td>
                    <td>
                      <div className={ui.actions}>
                        <button className={`${ui.action} ${ui.actionDanger}`} title="Eliminar" onClick={() => setDeleteTarget(p)}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && totalPages > 1 && (
          <div className={ui.pagination}>
            <span className={ui.pageInfo}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length} protocolos</span>
            <div className={ui.pageButtons}>
              <button className={ui.btnPage} disabled={page===1} onClick={() => setPage(p=>p-1)}>Anterior</button>
              <button className={ui.btnPage} disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Crear / Editar ── */}
      {(showCreate || !!editTarget) && (
        <div className={m.overlay}>
          <div className={`${m.dialog} ${pc.dialogWide}`} style={{ maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className={m.header}>
              <div>
                <h2 className={m.title}>{editTarget ? 'Editar protocolo' : 'Nuevo protocolo'}</h2>
                <p className={m.subtitle}>
                  {editTarget ? 'Modifica el protocolo y sus reglas de seguridad' : 'Define el perfil de protocolo y sus reglas de seguridad'}
                </p>
              </div>
              <button className={m.close} onClick={closeModals}><IconClose /></button>
            </div>

            <div className={`${m.body} ${pc.modalBody}`} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {formError && <p className={m.error}>{formError}</p>}

              {/* ── Info básica ── */}
              <div className={pc.sectionTitle}>Información general</div>
              <div className={m.grid}>
                <div className={`${m.field} ${m.full}`}>
                  <label className={m.label}>Nombre <span className={m.req}>*</span></label>
                  <input
                    className={m.input}
                    placeholder="Ej. Carga de Alto Valor"
                    maxLength={80}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className={`${m.field} ${m.full}`}>
                  <label className={m.label}>Descripción</label>
                  <textarea
                    className={m.textarea}
                    placeholder="Describe el propósito de este protocolo…"
                    maxLength={300}
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <p className={m.hint}>{form.description.length}/300 caracteres</p>
                </div>
              </div>

              <div className={pc.checkRow}>
                <label className={pc.checkLabel}>
                  <input
                    type="checkbox"
                    className={pc.checkbox}
                    checked={form.is_default}
                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                  />
                  <span>Marcar como protocolo por defecto</span>
                </label>
              </div>

              {/* ── Rules ── */}
              <div className={pc.rulesSectionHeader}>
                <div>
                  <div className={pc.sectionTitle} style={{ marginBottom: 2 }}>Reglas del protocolo</div>
                  <p className={pc.sectionSubtitle}>Activa o desactiva las reglas y ajusta sus umbrales y acciones.</p>
                </div>
              </div>

              {RULE_GROUPS.map(group => (
                <section key={group.id} className={pc.group}>
                  <header className={pc.groupHeader}>
                    <span className={pc.groupTitle}>
                      <span className={pc.groupIcon}>
                        <svg {...svgProps} width={16} height={16}>{GROUP_ICONS[group.id]}</svg>
                      </span>
                      {group.title}
                    </span>
                    <span className={pc.groupSubtitle}>
                      {group.locked && <IconLock />} {group.subtitle}
                    </span>
                  </header>
                  <div className={pc.groupBody}>
                    {group.rules.map(type => {
                      const idx = form.rules.findIndex(r => r.rule_type === type)
                      if (idx < 0) return null
                      return (
                        <RuleCard
                          key={type}
                          rule={form.rules[idx]}
                          index={idx}
                          onChange={updateRule}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className={m.footer}>
              <button className={pc.btnCancel} onClick={closeModals} disabled={saving}>Cancelar</button>
              <button className={pc.btnSave} onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : <><IconSave /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Eliminar ── */}
      {deleteTarget && (
        <div className={m.overlay} onClick={e => e.target === e.currentTarget && closeModals()}>
          <div className={`${m.dialog} ${m.dialogSm}`}>
            <div className={m.header}>
              <div>
                <h2 className={m.title}>Eliminar protocolo</h2>
                <p className={m.subtitle}>Esta acción no se puede deshacer.</p>
              </div>
              <button className={m.close} onClick={closeModals}><IconClose /></button>
            </div>
            <div className={m.body}>
              {formError && <p className={m.error}>{formError}</p>}
              <p style={{ color: '#cbd5e1', margin: 0 }}>
                ¿Estás seguro de que deseas eliminar{' '}
                <strong style={{ color: '#f1f5f9' }}>"{deleteTarget.name}"</strong>?
                {deleteTarget.active_rules > 0 && (
                  <span style={{ display:'block', marginTop:8, color:'#f87171', fontSize:13 }}>
                    ⚠ Este protocolo tiene {deleteTarget.active_rules} regla{deleteTarget.active_rules>1?'s':''} activa{deleteTarget.active_rules>1?'s':''}.
                  </span>
                )}
              </p>
            </div>
            <div className={m.footer}>
              <button className={pc.btnCancel} onClick={closeModals} disabled={deleting}>Cancelar</button>
              <button className={pc.btnDanger} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : <><IconTrash /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}