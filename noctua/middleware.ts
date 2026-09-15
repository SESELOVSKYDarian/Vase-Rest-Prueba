import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { RUTA_POR_SECCION, HOME_POR_ROL, puedeAccederASeccion, type RolSistema, type SeccionSistema } from '@/config/roles';

const SECCION_POR_RUTA: Record<string, SeccionSistema> = Object.fromEntries(
  (Object.entries(RUTA_POR_SECCION) as [SeccionSistema, string][]).map(([seccion, ruta]) => [ruta, seccion])
);

function seccionDeRuta(pathname: string): SeccionSistema | undefined {
  // Match exacto primero, luego por prefijo (ej. /dashboard/facturas/cuentas-corrientes -> cajero)
  if (SECCION_POR_RUTA[pathname]) return SECCION_POR_RUTA[pathname];
  const prefijo = Object.keys(SECCION_POR_RUTA)
    .filter((ruta) => pathname.startsWith(`${ruta}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefijo ? SECCION_POR_RUTA[prefijo] : undefined;
}

function irALogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Route protection middleware: autenticación (cookie `noctua-auth`) + autorización real por
 * rol/sección (JWT firmado en `noctua-token`, verificado contra JWT_SECRET del backend).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('noctua-auth');
  let autenticado = false;
  try {
    const authData = JSON.parse(decodeURIComponent(authCookie?.value ?? ''));
    autenticado = Boolean(authData?.state?.isAuthenticated);
  } catch {
    // Cookie ausente o corrupta: no autenticado.
  }

  if (!autenticado) {
    return irALogin(request, pathname);
  }

  const seccion = seccionDeRuta(pathname);
  if (!seccion) {
    // Rutas no gateadas por sección (ej. /dashboard raíz = Inicio): accesibles a cualquier autenticado.
    return NextResponse.next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET no configurado en este entorno: se degrada a solo-autenticación (comportamiento
    // previo) en vez de bloquear todo el dashboard. Ver nota operativa: sin esta variable el
    // guard de rol/sección no está activo.
    return NextResponse.next();
  }

  const token = request.cookies.get('noctua-token')?.value;
  let rol: RolSistema | undefined;
  try {
    if (!token) throw new Error('sin token');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    rol = payload.rol as RolSistema | undefined;
  } catch {
    // Autenticado por la cookie liviana pero sin un JWT válido para verificar el rol de forma
    // confiable (sesión previa al guard, token vencido o manipulado): nunca se lo deja pasar a
    // una sección restringida sin verificación real — se lo manda a reloguearse.
    return irALogin(request, pathname);
  }

  if (puedeAccederASeccion(rol, seccion)) {
    return NextResponse.next();
  }

  const home = (rol && HOME_POR_ROL[rol]) || '/dashboard';
  return NextResponse.redirect(new URL(home, request.url));
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
