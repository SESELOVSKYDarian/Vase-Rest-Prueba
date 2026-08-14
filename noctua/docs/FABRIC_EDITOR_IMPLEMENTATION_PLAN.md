# Plan de implementación del editor Fabric.js

## Objetivo

Reemplazar únicamente el viewport actual de mesas por un editor basado en Fabric.js. El navbar, sidebar, pedidos, reservas, estados de mesa y servicios de PostgreSQL continúan funcionando durante la migración.

Cada sección será un documento de plano independiente. Fabric.js será responsable de selección, zoom, paneo, transformación, capas e imágenes. React será responsable de los paneles, modales y acciones de negocio.

## Modelo único del plano

```ts
type FloorObject =
  | TableObject
  | ChairObject
  | SofaObject
  | WallObject
  | ImageObject
  | TextObject;

interface FloorDocument {
  version: 1;
  sectionId: string;
  viewport: { zoom: number; x: number; y: number };
  objects: FloorObject[];
  fabricJson: Record<string, unknown>;
  updatedAt: string;
}
```

Reglas:

- `Mesa.capacidad` se deriva de las sillas relacionadas; no se incrementa desde dos estados distintos.
- Cada silla tiene un único `tableId` o `null`.
- Cada objeto tiene `id`, `sectionId`, `type`, posición, escala, rotación y orden de capa.
- Los datos de negocio de la mesa siguen en `public.mesas`.
- La geometría del plano se guarda en el documento de la sección.

## Persistencia en PostgreSQL

Crear dos tablas:

```sql
create table public.floor_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.floor_documents (
  section_id uuid primary key references public.floor_sections(id) on delete cascade,
  version integer not null default 1,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

Agregar políticas RLS coherentes con el resto del dashboard y un índice por `updated_at`.

## Fase 1 — Base técnica

- Instalar `fabric`.
- Crear `FabricFloorEditor.tsx` cargado solo en cliente.
- Crear `FloorEditorToolbar`, `FloorLibraryPanel`, `SectionsPanel` y `ObjectInspector`.
- Implementar un adaptador para no importar Fabric.js desde Server Components.
- Crear feature flag `NEXT_PUBLIC_FABRIC_FLOOR_EDITOR` para alternar entre editor viejo y nuevo.

Criterio de aceptación: canvas de pantalla completa con cuadrícula, zoom centrado en cursor, paneo con mano/espacio y selección estable.

## Fase 2 — Herramientas gráficas

- Mesa circular y rectangular.
- Silla individual.
- Sillón con forma propia.
- Pared horizontal o vertical, editable en cualquier ángulo.
- Texto y etiquetas.
- Imágenes desde archivo, con validación de tipo y tamaño.
- Tiradores nativos para escala, tamaño y rotación.
- Eliminar con botón, menú contextual y teclado.
- Duplicar, copiar, pegar, bloquear y ordenar capas.

Criterio de aceptación: todos los objetos se mueven y transforman sin descentrarse, incluso con zoom y paneo.

## Fase 3 — Mesas y sillas

- Crear mesa mediante modal de número, forma y capacidad.
- Generar exactamente `capacidad` sillas con IDs deterministas.
- Agrupar visualmente mesa y sillas sin perder la edición individual.
- Al acercar una silla, mostrar una guía de conexión y asociarla a la mesa más cercana.
- Al alejarla o eliminarla, retirar la relación.
- Calcular la capacidad desde las relaciones, sin incrementos manuales paralelos.
- Permitir distribuir sillas en círculo, lados, parte superior, parte inferior o manualmente.

Criterio de aceptación: capacidad 2 siempre produce y conserva exactamente dos sillas.

## Fase 4 — Ayudas de edición

- Ajuste opcional a cuadrícula de 1, 2, 4, 8 o 16 px.
- Guías inteligentes para centros, bordes y separación uniforme.
- Alinear izquierda, centro, derecha, arriba, medio y abajo.
- Distribuir horizontal y verticalmente.
- Evitar superposición de mesas mediante geometría del canvas.
- Deshacer y rehacer con historial de comandos.
- Atajos: espacio para paneo, rueda para zoom, Delete, Ctrl/Cmd+Z, copiar y pegar.

## Fase 5 — Secciones

- Cada sección carga un `FloorDocument` diferente en el mismo canvas.
- Cambiar de sección guarda primero los cambios pendientes.
- Crear, renombrar, duplicar, ordenar y eliminar secciones.
- Mantener zoom y posición del viewport por sección.
- Indicar claramente la sección activa y el estado de guardado.

## Fase 6 — Guardado e imágenes

- Guardado con debounce y botón explícito.
- Control de versión para evitar sobrescribir cambios recientes.
- Guardar imágenes en PostgreSQL Storage; el JSON conserva la URL y metadatos.
- Comprimir imágenes grandes antes de subirlas.
- Mostrar estados `Sin cambios`, `Guardando`, `Guardado` y `Error`.

## Fase 7 — Migración

- Leer mesas actuales desde `public.mesas`.
- Convertir posiciones existentes a objetos Fabric.
- Convertir `vase-rest-salon-items` solo una vez.
- Asignar datos sin sección a `Salón principal`.
- Crear copia del documento migrado antes de eliminar datos locales.
- Mantener el editor anterior disponible mediante feature flag durante validación.

## Fase 8 — Retiro del editor anterior

- Verificar pedidos, reservas, unión de mesas y estados en tiempo real.
- Ejecutar pruebas con 1, 20, 50 y 100 objetos.
- Probar desktop, tablet y móvil.
- Eliminar Framer Motion del viewport, efectos de generación automática y persistencia duplicada en `localStorage`.
- Conservar Framer Motion donde siga siendo útil en otras pantallas.

## Orden de entrega

1. Canvas Fabric.js y feature flag.
2. Mobiliario y transformaciones.
3. Mesas, sillas y capacidad derivada.
4. Secciones y persistencia PostgreSQL.
5. Imágenes, capas y herramientas avanzadas.
6. Migración y retiro del editor anterior.

## Riesgos y mitigaciones

- SSR de Next.js: importación dinámica con `ssr: false`.
- Documentos incompatibles: campo `version` y funciones de migración.
- Doble guardado: una única capa de repositorio para el documento.
- Imágenes pesadas: Storage, límites y compresión.
- Pérdida de cambios: autosave, estado visible y copia previa a migrar.
- Regresiones operativas: feature flag y convivencia temporal de ambos editores.
