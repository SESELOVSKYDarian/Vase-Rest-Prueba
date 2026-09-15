export type SeccionSistema =
  | 'analytics'
  | 'mesas'
  | 'pedidos'
  | 'cocina'
  | 'cajero'
  | 'historial'
  | 'stock'
  | 'platos'
  | 'promociones'
  | 'reservas'
  | 'administracion'
  | 'delivery'
  | 'soporte'
  | 'mozos'
  | 'diseno';

export type RolSistema =
  | 'admin'
  | 'encargado'
  | 'cajero'
  | 'cocina'
  | 'mozo'
  | 'stock'
  | 'delivery'
  | 'soporte'
  | 'desarrollador';

export const SECCIONES_POR_ROL: Record<RolSistema, SeccionSistema[]> = {
  admin: [
    'analytics',
    'mesas',
    'pedidos',
    'cocina',
    'cajero',
    'historial',
    'stock',
    'platos',
    'promociones',
    'reservas',
    'administracion',
    'delivery',
    'soporte',
    'mozos',
    'diseno',
  ],
  // Encargado (supervisor de turno): todas las secciones operativas del admin,
  // sin las de sistema (administración de usuarios ni tickets de soporte).
  encargado: [
    'mesas',
    'pedidos',
    'cocina',
    'cajero',
    'historial',
    'stock',
    'platos',
    'promociones',
    'reservas',
    'delivery',
  ],
  cajero: ['mesas', 'pedidos', 'cajero', 'historial'],
  cocina: ['cocina'],
  mozo: ['mesas', 'pedidos', 'cocina'],
  stock: ['stock', 'platos', 'promociones'],
  delivery: ['delivery'],
  soporte: ['soporte'],
  desarrollador: ['soporte'],
};

export const RUTA_POR_SECCION: Record<SeccionSistema, string> = {
  analytics:      '/dashboard/analytics',
  mesas:          '/dashboard/mesas',
  pedidos:        '/dashboard/pedido',
  cocina:         '/dashboard/cocina',
  cajero:         '/dashboard/facturas',
  historial:      '/dashboard/historial',
  stock:          '/dashboard/stock',
  platos:         '/dashboard/platos',
  promociones:    '/dashboard/promociones',
  reservas:       '/dashboard/reservas',
  administracion: '/dashboard/administracion',
  delivery:       '/dashboard/delivery',
  soporte:        '/dashboard/soporte',
  mozos:          '/dashboard/mozos',
  diseno:         '/dashboard/diseno',
};

export const LABEL_POR_SECCION: Record<SeccionSistema, string> = {
  analytics:      'Analítica',
  mesas:          'Mesas',
  pedidos:        'Pedidos',
  cocina:         'Cocina',
  cajero:         'Facturas',
  historial:      'Historial',
  stock:          'Stock',
  platos:         'Platos',
  promociones:    'Promociones',
  reservas:       'Reservas',
  administracion: 'Administración',
  delivery:       'Delivery',
  soporte:        'Soporte',
  mozos:          'Mozos',
  diseno:         'Diseño',
};

// Todos los roles aterrizan en "Inicio" (/dashboard, ver Fase E) y desde ahí saltan
// con un clic a su sección principal — Inicio ya no es un alias de /dashboard/analytics.
export const HOME_POR_ROL: Record<RolSistema, string> = {
  admin: '/dashboard',
  encargado: '/dashboard',
  cajero: '/dashboard',
  cocina: '/dashboard',
  mozo: '/dashboard',
  stock: '/dashboard',
  delivery: '/dashboard',
  soporte: '/dashboard',
  desarrollador: '/dashboard',
};

export function obtenerSeccionesPorRol(rol?: string | null): SeccionSistema[] {
  // Fail-closed: un rol ausente o desconocido no debe caer en acceso total de admin.
  if (!rol || !(rol in SECCIONES_POR_ROL)) return [];

  return SECCIONES_POR_ROL[rol as RolSistema];
}

export function puedeAccederASeccion(
  rol: string | null | undefined,
  seccion: SeccionSistema
) {
  return obtenerSeccionesPorRol(rol).includes(seccion);
}
