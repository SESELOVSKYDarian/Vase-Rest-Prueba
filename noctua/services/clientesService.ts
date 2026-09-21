import { createDatabaseClientWithNoctuaRole } from '@/services/databaseRoleClient';
import type { Cliente, ClienteInput } from '@/types/cliente';

type ClienteRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  documento: string | null;
  observaciones: string | null;
  creado_en: string | null;
};

function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    email: row.email,
    documento: row.documento,
    observaciones: row.observaciones,
    creadoEn: row.creado_en,
  };
}

function validateClienteInput(input: ClienteInput) {
  if (!input.nombre.trim()) throw new Error('El nombre del cliente es obligatorio.');
}

export const clientesService = {
  async getClientes(): Promise<Cliente[]> {
    const database = createDatabaseClientWithNoctuaRole();

    const { data, error } = await database
      .from('clientes')
      .select('id,nombre,telefono,email,documento,observaciones,creado_en')
      .order('nombre', { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as ClienteRow[]).map(mapCliente);
  },

  async createCliente(input: ClienteInput): Promise<Cliente> {
    validateClienteInput(input);
    const database = createDatabaseClientWithNoctuaRole();

    const { data, error } = await database
      .from('clientes')
      .insert({
        nombre: input.nombre.trim(),
        telefono: input.telefono?.trim() || null,
        email: input.email?.trim() || null,
        documento: input.documento?.trim() || null,
        observaciones: input.observaciones?.trim() || null,
      })
      .select('id,nombre,telefono,email,documento,observaciones,creado_en')
      .single();

    if (error) throw new Error(error.message);
    return mapCliente(data as ClienteRow);
  },

  async updateCliente(id: string, input: ClienteInput): Promise<Cliente> {
    validateClienteInput(input);
    const database = createDatabaseClientWithNoctuaRole();

    const { data, error } = await database
      .from('clientes')
      .update({
        nombre: input.nombre.trim(),
        telefono: input.telefono?.trim() || null,
        email: input.email?.trim() || null,
        documento: input.documento?.trim() || null,
        observaciones: input.observaciones?.trim() || null,
      })
      .eq('id', id)
      .select('id,nombre,telefono,email,documento,observaciones,creado_en')
      .single();

    if (error) throw new Error(error.message);
    return mapCliente(data as ClienteRow);
  },

  // Igual que Promociones (Fase L): `clientes` no tiene una columna de "activo"/borrado
  // lógico — eliminar es un DELETE real. Las FKs que la referencian (reservas, pedidos,
  // facturas, cuentas_corrientes) son todas `on delete set null`, así que borrar un
  // cliente nunca rompe ni arrastra su historial, solo desvincula la referencia.
  async deleteCliente(id: string): Promise<void> {
    const database = createDatabaseClientWithNoctuaRole();
    const { error } = await database.from('clientes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
