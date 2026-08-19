const API_URL = (typeof window === 'undefined' ? process.env.INTERNAL_API_URL : undefined) || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {};
  try {
    const token = JSON.parse(localStorage.getItem('noctua-auth') || '{}')?.state?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

type Filter = { method: string; column?: string; value: unknown };
class DatabaseQuery implements PromiseLike<{ data: any; error: { message: string; code?: string; details?: string; hint?: string } | null; count?: number }> {
  private operation = 'select'; private payload: unknown; private selection = '*'; private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = []; private max?: number; private slice?: { from: number; to: number }; private one?: 'single' | 'maybe';
  constructor(private table: string) {}
  select(columns = '*') { this.selection = columns; return this; }
  insert(value: unknown) { this.operation = 'insert'; this.payload = value; return this; }
  upsert(value: unknown) { this.operation = 'upsert'; this.payload = value; return this; }
  update(value: unknown) { this.operation = 'update'; this.payload = value; return this; }
  delete() { this.operation = 'delete'; return this; }
  private filter(method: string, column: string, value: unknown) { this.filters.push({ method, column, value }); return this; }
  eq(column: string, value: unknown) { return this.filter('eq', column, value); }
  neq(column: string, value: unknown) { return this.filter('neq', column, value); }
  like(column: string, value: unknown) { return this.filter('like', column, value); }
  ilike(column: string, value: unknown) { return this.filter('ilike', column, value); }
  gt(column: string, value: unknown) { return this.filter('gt', column, value); }
  gte(column: string, value: unknown) { return this.filter('gte', column, value); }
  lt(column: string, value: unknown) { return this.filter('lt', column, value); }
  lte(column: string, value: unknown) { return this.filter('lte', column, value); }
  is(column: string, value: unknown) { return this.filter('is', column, value); }
  in(column: string, value: unknown[]) { return this.filter('in', column, value); }
  or(value: string) { this.filters.push({ method: 'or', value }); return this; }
  order(column: string, options: { ascending?: boolean } = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
  limit(value: number) { this.max = value; return this; }
  range(from: number, to: number) { this.slice = { from, to }; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  async execute() {
    try {
      const response = await fetch(`${API_URL}/data/query`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ table: this.table, operation: this.operation, payload: this.payload, selection: this.selection, filters: this.filters, orders: this.orders, limit: this.max, range: this.slice, single: this.one }) });
      const result = await response.json();
      if (!response.ok && !result.error) return { data: null, error: { message: 'Error de PostgreSQL' } };
      return result;
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'No se pudo conectar con la API' } }; }
  }
  then<TResult1 = { data: any; error: { message: string; code?: string; details?: string; hint?: string } | null; count?: number }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: { message: string; code?: string; details?: string; hint?: string } | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.execute().then(onfulfilled, onrejected); }
}

type ChangeCallback = (...args: any[]) => void;
const channels = new Map<object, ReturnType<typeof setInterval>>();
type Subscription = { event: string; table: string; callback: ChangeCallback };
export const database = {
  from: (table: string) => new DatabaseQuery(table),
  rpc: async (name: string, args: Record<string, unknown>) => {
    const response = await fetch(`${API_URL}/data/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name, args }) });
    return response.json();
  },
  auth: { getSession: async () => ({ data: { session: null as { user?: { id?: string } } | null }, error: null as { message: string } | null }) },
  channel: (_name?: string) => {
    const subscriptions: Subscription[] = [];
    const snapshots = new Map<string, Map<string, any>>();
    const poll = async () => {
      for (const subscription of subscriptions) {
        const result = await new DatabaseQuery(subscription.table).select('*').execute();
        const current = new Map<string, any>((Array.isArray(result.data) ? result.data : []).map((row: any) => [String(row.id), row]));
        const previous = snapshots.get(subscription.table);
        if (previous) {
          current.forEach((row, id) => {
            const old = previous.get(id);
            if (!old && (subscription.event === 'INSERT' || subscription.event === '*')) subscription.callback({ eventType: 'INSERT', new: row, old: {} });
            else if (old && JSON.stringify(old) !== JSON.stringify(row) && (subscription.event === 'UPDATE' || subscription.event === '*')) subscription.callback({ eventType: 'UPDATE', new: row, old });
          });
          previous.forEach((row, id) => { if (!current.has(id) && (subscription.event === 'DELETE' || subscription.event === '*')) subscription.callback({ eventType: 'DELETE', new: {}, old: row }); });
        }
        snapshots.set(subscription.table, current);
      }
    };
    const channel: { on: (_event: string, filter: any, callback: ChangeCallback) => typeof channel; subscribe: () => typeof channel; unsubscribe: () => void } = {
      on: (_event, filter, callback) => { subscriptions.push({ event: filter.event || '*', table: filter.table, callback }); return channel; },
      subscribe: () => { void poll(); const timer = setInterval(() => void poll(), 5000); channels.set(channel, timer); return channel; },
      unsubscribe: () => { const timer = channels.get(channel); if (timer) clearInterval(timer); channels.delete(channel); },
    };
    return channel;
  },
  removeChannel: (channel: object) => { const timer = channels.get(channel); if (timer) clearInterval(timer); channels.delete(channel); },
};
