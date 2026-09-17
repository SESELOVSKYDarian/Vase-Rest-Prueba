import { createDatabaseClientWithNoctuaRole } from '@/services/databaseRoleClient';
import type { PaymentMethod, Promotion, PromotionDish } from '@/types/promotions';

type ProductoRelationRow = {
  id: string;
  nombre: string;
  precio: number | string;
};

type PromocionProductoRow = {
  producto_id: string;
  productos?: ProductoRelationRow | ProductoRelationRow[] | null;
};

type PromocionRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  valor: number | string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  creado_en: string;
  metodos_pago: string[] | null;
  promocion_productos?: PromocionProductoRow[] | null;
};

export interface PromocionInput {
  nombre: string;
  descripcion?: string;
  discountPercentage: number;
  productoIds: string[];
  metodosPago: PaymentMethod[];
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapPromocion(row: PromocionRow): Promotion {
  const discountPercentage = Number(row.valor ?? 0);

  const applicableDishes: PromotionDish[] = (row.promocion_productos ?? []).map((relacion) => {
    const producto = singleRelation(relacion.productos);
    const originalPrice = Number(producto?.precio ?? 0);
    return {
      dishId: relacion.producto_id,
      dishName: producto?.nombre || 'Plato eliminado',
      originalPrice,
      discountedPrice: Math.max(0, originalPrice - (originalPrice * discountPercentage) / 100),
    };
  });

  const metodosPago = row.metodos_pago && row.metodos_pago.length > 0 ? row.metodos_pago : ['todos'];

  return {
    id: row.id,
    name: row.nombre,
    description: row.descripcion ?? undefined,
    discountPercentage,
    applicableDishes,
    paymentMethods: metodosPago as PaymentMethod[],
    startDate: row.fecha_inicio ? new Date(row.fecha_inicio) : new Date(row.creado_en),
    // fecha_fin es nullable en el schema; una promoción sin fecha de vencimiento cargada
    // no debe aparecer como "vencida" — se trata como sin límite (fecha muy lejana).
    expirationDate: row.fecha_fin ? new Date(row.fecha_fin) : new Date('9999-12-31'),
    isActive: row.activo,
    createdAt: new Date(row.creado_en),
  };
}

function validatePromocionInput(input: PromocionInput) {
  if (!input.nombre.trim()) throw new Error('El nombre de la promoción es obligatorio.');
  if (!Number.isFinite(input.discountPercentage) || input.discountPercentage <= 0 || input.discountPercentage > 100) {
    throw new Error('El porcentaje de descuento debe estar entre 1 y 100.');
  }
  if (input.productoIds.length === 0) throw new Error('Selecciona al menos un plato para la promoción.');
  if (input.metodosPago.length === 0) throw new Error('Selecciona al menos un método de pago.');
  if (!input.fechaInicio) throw new Error('La fecha de inicio es obligatoria.');
  if (!input.fechaFin) throw new Error('La fecha de vencimiento es obligatoria.');
  if (new Date(input.fechaFin) <= new Date(input.fechaInicio)) {
    throw new Error('La fecha de vencimiento debe ser posterior a la fecha de inicio.');
  }
}

async function replaceProductos(promocionId: string, productoIds: string[]): Promise<void> {
  const database = createDatabaseClientWithNoctuaRole();

  const { error: deleteError } = await database
    .from('promocion_productos')
    .delete()
    .eq('promocion_id', promocionId);

  if (deleteError) throw new Error(deleteError.message);
  if (productoIds.length === 0) return;

  const rows = productoIds.map((productoId) => ({ promocion_id: promocionId, producto_id: productoId }));
  const { error: insertError } = await database.from('promocion_productos').insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export const promocionesService = {
  async getPromociones(): Promise<Promotion[]> {
    const database = createDatabaseClientWithNoctuaRole();

    const { data, error } = await database
      .from('promociones')
      .select(`
        id,
        nombre,
        descripcion,
        valor,
        fecha_inicio,
        fecha_fin,
        activo,
        creado_en,
        metodos_pago,
        promocion_productos(
          producto_id,
          productos(id,nombre,precio)
        )
      `)
      .order('creado_en', { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as PromocionRow[]).map(mapPromocion);
  },

  async createPromocion(input: PromocionInput): Promise<Promotion> {
    validatePromocionInput(input);
    const database = createDatabaseClientWithNoctuaRole();

    const { data: promocion, error } = await database
      .from('promociones')
      .insert({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        tipo: 'porcentaje',
        valor: input.discountPercentage,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
        activo: input.activo,
        metodos_pago: input.metodosPago,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const promocionId = (promocion as { id: string }).id;
    await replaceProductos(promocionId, input.productoIds);

    const promociones = await promocionesService.getPromociones();
    const created = promociones.find((promo) => promo.id === promocionId);
    if (!created) throw new Error('La promoción fue creada, pero no se pudo recargar desde PostgreSQL.');
    return created;
  },

  async updatePromocion(id: string, input: PromocionInput): Promise<Promotion> {
    validatePromocionInput(input);
    const database = createDatabaseClientWithNoctuaRole();

    const { error } = await database
      .from('promociones')
      .update({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        valor: input.discountPercentage,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
        activo: input.activo,
        metodos_pago: input.metodosPago,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    await replaceProductos(id, input.productoIds);

    const promociones = await promocionesService.getPromociones();
    const updated = promociones.find((promo) => promo.id === id);
    if (!updated) throw new Error('La promoción fue actualizada, pero no se pudo recargar desde PostgreSQL.');
    return updated;
  },

  async toggleActivo(id: string, activo: boolean): Promise<void> {
    const database = createDatabaseClientWithNoctuaRole();
    const { error } = await database.from('promociones').update({ activo }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Las promociones no tienen un flag de "eliminado" separado del de activo/inactivo
  // (a diferencia de productos.activo en Platos) — eliminar es un DELETE real; la FK de
  // promocion_productos tiene ON DELETE CASCADE, así que la relación se limpia sola.
  async deletePromocion(id: string): Promise<void> {
    const database = createDatabaseClientWithNoctuaRole();
    const { error } = await database.from('promociones').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
