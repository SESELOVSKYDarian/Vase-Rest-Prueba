'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Monitor } from 'lucide-react';
import { useSuperAdmStore } from '@/store/superadmStore';
import { useThemeStore } from '@/store/themeStore';
import { ACCENTS, getAccent, type Accent, type ThemeMode } from '@/config/theme';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';

const TITULO_SECCION: Record<string, string> = {
  delivery: 'Delivery',
  stock: 'Inventario',
  mesas: 'Mesas',
  cocina: 'Cocina',
  pedidos: 'Pedidos',
};

// Mismas luminosidades que globals.css: el swatch muestra el acento tal como se va a ver
// en el modo actual (una custom property no se recalcula en hijos, por eso va inline).
function accentColor(accent: Accent, mode: ThemeMode) {
  return mode === 'dark'
    ? `oklch(0.755 ${(accent.chroma * 1.08).toFixed(3)} ${accent.hue})`
    : `oklch(0.53 ${accent.chroma} ${accent.hue})`;
}

/** Miniatura del sistema en cada modo: barra lateral, encabezado y dos tarjetas. */
function ModePreview({ mode, accent }: { mode: ThemeMode; accent: Accent }) {
  const p = mode === 'dark'
    ? { bg: '#1b1814', side: '#211d19', card: '#27221d', line: '#3a332c', ink: '#e9e2d8', ink3: '#6f665c' }
    : { bg: '#f5f1ea', side: '#fffdf9', card: '#fffdf9', line: '#e6ddd0', ink: '#2b251f', ink3: '#b3a797' };
  return (
    <svg viewBox="0 0 200 120" className="block h-auto w-full" aria-hidden="true">
      <rect width="200" height="120" fill={p.bg} />
      <rect width="46" height="120" fill={p.side} />
      <line x1="46" y1="0" x2="46" y2="120" stroke={p.line} />
      <rect x="10" y="12" width="26" height="6" rx="3" fill={p.ink} />
      {[30, 42, 54, 66].map((y, i) => (
        <rect key={y} x="10" y={y} width={i === 0 ? 26 : 20} height="6" rx="3" fill={i === 0 ? accentColor(accent, mode) : p.ink3} opacity={i === 0 ? 1 : 0.6} />
      ))}
      <rect x="58" y="14" width="60" height="9" rx="3" fill={p.ink} />
      <rect x="58" y="28" width="38" height="5" rx="2.5" fill={p.ink3} />
      <rect x="58" y="44" width="62" height="62" rx="8" fill={p.card} stroke={p.line} />
      <rect x="128" y="44" width="62" height="62" rx="8" fill={p.card} stroke={p.line} />
      <circle cx="89" cy="70" r="12" fill="none" stroke={accentColor(accent, mode)} strokeWidth="2.5" />
      <rect x="140" y="58" width="38" height="6" rx="3" fill={p.ink3} />
      <rect x="140" y="88" width="38" height="10" rx="5" fill={accentColor(accent, mode)} />
    </svg>
  );
}

export default function DisenoPage() {
  const { config, isDirty, saveAll, discardChanges, updateTheme, initializeConfig, updateDashboardText } = useSuperAdmStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [saving, setSaving] = useState(false);
  const [textosOpen, setTextosOpen] = useState(false);
  const accent = getAccent(config.theme.accent);

  useEffect(() => { void initializeConfig(); }, [initializeConfig]);

  const guardar = async () => {
    setSaving(true);
    try { await saveAll(); } finally { setSaving(false); }
  };

  const textos = Object.entries(config.theme.dashboardTexts || {});

  return (
    <div className="stagger space-y-10 pb-24">
      <header>
        <h1 className="text-4xl text-ink">Diseño</h1>
        <p className="mt-2 text-ink-3">Cómo se ve Vase en las pantallas del local.</p>
      </header>

      <section aria-labelledby="modo-titulo" className="space-y-4">
        <div className="flex max-w-2xl flex-wrap items-baseline justify-between gap-2">
          <h2 id="modo-titulo" className="text-lg font-medium text-ink">Modo</h2>
          <p className="flex items-center gap-1.5 text-xs text-ink-3"><Monitor size={13} /> Se guarda en este dispositivo</p>
        </div>
        <div role="radiogroup" aria-label="Modo de color" className="grid max-w-2xl grid-cols-2 gap-4">
          {(['light', 'dark'] as const).map((option) => {
            const active = mode === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(option)}
                className={`pressable group overflow-hidden rounded-2xl border bg-surface text-left shadow-soft transition-[border-color,box-shadow] duration-200 ${active ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-line-strong'}`}
              >
                <ModePreview mode={option} accent={accent} />
                <span className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-ink">{option === 'light' ? 'Claro' : 'Oscuro'}</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border transition-colors duration-200 ${active ? 'border-brand bg-brand text-on-brand' : 'border-line-strong'}`}>
                    {active && <motion.span initial={{ transform: 'scale(0.5)', opacity: 0 }} animate={{ transform: 'scale(1)', opacity: 1 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}><Check size={12} strokeWidth={3} /></motion.span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="acento-titulo" className="space-y-4">
        <div className="flex max-w-2xl flex-wrap items-baseline justify-between gap-2">
          <h2 id="acento-titulo" className="text-lg font-medium text-ink">Color de acento</h2>
          <p className="text-xs text-ink-3">Se aplica a todo el local al guardar</p>
        </div>
        <div className="card max-w-2xl p-5">
          <div role="radiogroup" aria-label="Color de acento" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {ACCENTS.map((option) => {
              const active = option.id === accent.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => updateTheme({ accent: option.id })}
                  className="pressable flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-ink/[0.04]"
                >
                  <span className="relative grid h-11 w-11 place-items-center rounded-full" style={{ background: accentColor(option, mode) }}>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ opacity: 0, transform: 'scale(0.6)' }}
                          animate={{ opacity: 1, transform: 'scale(1)' }}
                          exit={{ opacity: 0, transform: 'scale(0.8)', transition: { duration: 0.1 } }}
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                          className="absolute -inset-1 rounded-full border-2"
                          style={{ borderColor: accentColor(option, mode) }}
                        />
                      )}
                    </AnimatePresence>
                    {active && <Check size={18} strokeWidth={2.75} className="text-on-brand" />}
                  </span>
                  <span className={`text-xs ${active ? 'font-medium text-ink' : 'text-ink-3'}`}>{option.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button size="sm">Botón principal</Button>
            <Button size="sm" variant="secondary">Secundario</Button>
            <StatusChip tone="success" label="Libre" />
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong">Seleccionado</span>
          </div>
        </div>
      </section>

      {textos.length > 0 && (
        <section className="max-w-2xl">
          <button
            type="button"
            onClick={() => setTextosOpen((open) => !open)}
            aria-expanded={textosOpen}
            className="flex w-full items-center justify-between rounded-xl py-2 text-left"
          >
            <span>
              <span className="block text-lg font-medium text-ink">Textos de pantallas</span>
              <span className="block text-sm text-ink-3">Títulos y subtítulos que ve el equipo</span>
            </span>
            <ChevronDown size={18} className={`text-ink-3 transition-transform duration-200 ${textosOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {textosOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3">
                  {textos.map(([section, texts]) => (
                    <div key={section} className="card p-5">
                      <h3 className="mb-3 text-sm font-medium text-ink">{TITULO_SECCION[section] ?? section}</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-xs text-ink-3">Título</span>
                          <input
                            type="text"
                            value={texts?.title || ''}
                            onChange={(e) => updateDashboardText(section, { title: e.target.value })}
                            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs text-ink-3">Subtítulo</span>
                          <input
                            type="text"
                            value={texts?.subtitle || ''}
                            onChange={(e) => updateDashboardText(section, { subtitle: e.target.value })}
                            className="h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Barra de guardado: aparece solo con cambios pendientes, sube desde abajo. */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, transform: 'translateY(16px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(12px)', transition: { duration: 0.15 } }}
            transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-float lg:bottom-6"
            role="status"
          >
            <span className="text-sm text-ink-2">Cambios sin guardar</span>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={discardChanges}>Descartar</Button>
              <Button size="sm" loading={saving} onClick={guardar}>Guardar</Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
