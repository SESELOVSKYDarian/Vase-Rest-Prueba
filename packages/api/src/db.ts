import { apiFetch } from './http';

type Filtro = { method: string; column?: string; value: unknown };

export interface ConsultaDb {
  table: string;
  operation?: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  selection?: string;
  payload?: unknown;
  filters?: Filtro[];
  orders?: { column: string; ascending: boolean }[];
  limit?: number;
  single?: 'single' | 'maybe';
}

/** Cliente del passthrough genérico /data/query del backend (mismo contrato que usa el panel Next). */
export async function consultarDb<T = unknown>(consulta: ConsultaDb): Promise<T> {
  const resultado = await apiFetch<{ data: T; error: { message: string } | null }>('/data/query', {
    method: 'POST',
    body: JSON.stringify({ operation: 'select', selection: '*', ...consulta }),
  });
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data;
}
