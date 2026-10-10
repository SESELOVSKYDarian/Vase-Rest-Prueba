export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
  get esSesionVencida() { return this.status === 401; }
  get esSinConexion() { return this.status === 0; }
}

export interface ApiConfig {
  /** Ej.: http://192.168.0.10:3001/api — en emulador Android, 10.0.2.2 en vez de localhost. */
  baseUrl: string;
  getToken: () => string | null | undefined;
  /** Se llama cuando el servidor responde 401 (sesión vencida o inválida). */
  onUnauthorized?: () => void;
}

let config: ApiConfig = { baseUrl: 'http://localhost:3001/api', getToken: () => null };

export function configureApi(next: Partial<ApiConfig>) {
  config = { ...config, ...next };
}

export const getApiBaseUrl = () => config.baseUrl;

async function leerError(response: Response): Promise<string> {
  try {
    const cuerpo = await response.json();
    return cuerpo?.error?.message ?? cuerpo?.error ?? cuerpo?.mensaje ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

export async function apiFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const token = config.getToken();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (!response.ok) {
    if (response.status === 401) config.onUnauthorized?.();
    throw new ApiError(await leerError(response), response.status);
  }
  return response.json() as Promise<T>;
}
