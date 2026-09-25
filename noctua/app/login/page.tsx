'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { HOME_POR_ROL, type RolSistema } from '@/config/roles';
import { TableSetting } from '@/components/ui/Illustrations';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { login, isAuthenticated, usuario: sesion, isLoading, error, clearError } = useAuthStore();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const homeDelRol = (rol?: string) => HOME_POR_ROL[rol as RolSistema] ?? '/dashboard';

  useEffect(() => {
    if (isAuthenticated) router.replace(homeDelRol(sesion?.rol));
  }, [isAuthenticated, sesion, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(usuario, password);
    if (success) {
      router.push(homeDelRol(useAuthStore.getState().usuario?.rol));
    } else {
      // Error de credenciales: la tarjeta tiembla una vez (feedback físico, no solo texto).
      setShakeKey((k) => k + 1);
    }
  };

  const puedeEnviar = !!usuario && !!password && !isLoading;

  return (
    <main className="min-h-dvh bg-canvas grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-surface-2 border-r border-line px-14 py-12">
        <div className="flex items-center gap-3">
          <Image src="/vaserestlogo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" priority />
          <span className="font-display text-2xl text-ink">Vase Rest</span>
        </div>

        <div className="max-w-md">
          <TableSetting className="w-full max-w-[420px] h-auto text-ink-2" />
          <h1 className="mt-10 !text-[3.25rem] leading-[1.02]">
            Cada mesa,
            <br />
            <em className="text-brand-strong">en su punto.</em>
          </h1>
          <p className="mt-4 text-ink-2 text-pretty max-w-sm">
            Salón, cocina y caja en un mismo lugar, al ritmo del servicio.
          </p>
        </div>

        <p className="text-xs text-ink-3">© {new Date().getFullYear()} Vase Rest</p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-center">
            <TableSetting className="mx-auto w-56 h-auto text-ink-2" />
            <p className="mt-2 font-display text-3xl text-ink">Vase Rest</p>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, transform: 'translateY(12px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Te damos la bienvenida</h2>
            <p className="mt-1.5 text-sm text-ink-3">Ingresá con tu usuario del local.</p>
          </motion.div>

          <motion.form
            key={shakeKey}
            onSubmit={handleSubmit}
            noValidate
            className="mt-8 space-y-5"
            initial={reduce ? false : shakeKey > 0 ? { transform: 'translateX(0px)' } : { opacity: 0, transform: 'translateY(12px)' }}
            animate={
              shakeKey > 0 && !reduce
                ? { transform: ['translateX(-7px)', 'translateX(6px)', 'translateX(-4px)', 'translateX(3px)', 'translateX(0px)'], opacity: 1 }
                : { opacity: 1, transform: 'translateY(0px)' }
            }
            transition={{ duration: shakeKey > 0 ? 0.36 : 0.5, delay: shakeKey > 0 ? 0 : 0.08, ease: EASE_OUT }}
          >
            <div className="space-y-2">
              <label htmlFor="login-usuario" className="text-sm font-medium text-ink-2">
                Usuario
              </label>
              <input
                id="login-usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={usuario}
                onChange={(e) => { setUsuario(e.target.value); clearError(); }}
                placeholder="tu usuario"
                className="w-full h-12 rounded-xl bg-surface border border-line-strong px-4 text-ink shadow-soft transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
                aria-label="Nombre de usuario"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium text-ink-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  placeholder="••••••"
                  className="w-full h-12 rounded-xl bg-surface border border-line-strong pl-4 pr-12 text-ink shadow-soft transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
                  aria-label="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="text-sm text-red-700 dark:text-red-300 bg-red-500/10 rounded-xl px-4 py-3"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={!puedeEnviar}
              aria-label="Iniciar sesión"
              className="pressable group w-full h-12 rounded-xl bg-brand text-on-brand font-semibold inline-flex items-center justify-center gap-2 hover:bg-brand-strong disabled:bg-surface-3 disabled:text-ink-3 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight size={18} className="transition-transform duration-200 [@media(hover:hover)]:group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </motion.form>

          {process.env.NODE_ENV !== 'production' && (
            <p className="mt-8 text-center text-xs text-ink-3">
              Demo local: <span className="tabular text-ink-2">admin / 1234</span>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
