import { database } from "../databaseClient";

export interface Reserva {
  id: string;
  nombre_cliente: string;
  email_cliente?: string;
  telefono?: string;
  cantidad_personas: number;
  fecha: string;
  hora: string;
  estado: "activa" | "cancelada" | "completada";
  codigo_reserva: string;
  mesa_id?: string;
  mesas_ids?: string[];
  creada_en: string;
  cancelada_en?: string | null;
}

export async function obtenerReservas(): Promise<Reserva[]> {
  const { data, error } = await database
    .from("reservas")
    // El esquema actual guarda email en `email` y el horario en timestamps.
    // No pedir columnas legacy (`email_cliente`, `fecha`, `hora`, etc.) porque
    // PostgreSQL rechaza toda la consulta cuando una sola no existe.
    .select("id, nombre_cliente, email, telefono, cantidad_personas, fecha_hora_inicio, estado, mesa_id, creado_en")
    .order("fecha_hora_inicio", { ascending: true });

  if (error) {
    console.error("Error al obtener reservas de PostgreSQL:", error);
    throw new Error(error.message);
  }

  return (data || []).map((r: Record<string, any>) => ({
    id: String(r.id),
    nombre_cliente: r.nombre_cliente || "Sin nombre",
    email_cliente: r.email ?? undefined,
    telefono: r.telefono ?? undefined,
    cantidad_personas: r.cantidad_personas ?? 1,
    fecha: r.fecha_hora_inicio ? String(r.fecha_hora_inicio).slice(0, 10) : "",
    hora: r.fecha_hora_inicio ? String(r.fecha_hora_inicio).slice(11, 16) : "",
    estado: (r.estado === "pendiente" || r.estado === "confirmada" ? "activa" : r.estado ?? "activa") as Reserva["estado"],
    codigo_reserva: String(r.id).slice(0, 8).toUpperCase(),
    mesa_id: r.mesa_id ? String(r.mesa_id) : undefined,
    mesas_ids: undefined,
    creada_en: r.creado_en,
    cancelada_en: null,
  }));
}

export async function cancelarReserva(id: string): Promise<void> {
  const { error } = await database
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("id", id);

  if (error) {
    console.error("Error al cancelar reserva:", error);
    throw new Error(error.message);
  }
}

export async function completarReserva(id: string): Promise<void> {
  const { error } = await database
    .from("reservas")
    .update({ estado: "completada" })
    .eq("id", id);

  if (error) {
    console.error("Error al completar reserva:", error);
    throw new Error(error.message);
  }
}
