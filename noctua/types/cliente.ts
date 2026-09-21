export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
  observaciones?: string | null;
  creadoEn?: string | null;
}

export interface ClienteInput {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
  observaciones?: string | null;
}
