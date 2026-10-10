import { crearIndice } from "../src/services/ia/indice.js";

export const categorias = [
  { id: "c-ent", nombre: "Entradas", orden: 1 },
  { id: "c-pri", nombre: "Principales", orden: 2 },
  { id: "c-beb", nombre: "Bebidas", orden: 3 },
  { id: "c-pos", nombre: "Postres", orden: 4 },
];
const p = (id, categoriaId, nombre, descripcion, precio, etiquetas = [], disponible = true) => ({ id, categoriaId, nombre, descripcion, precio, etiquetas, disponible });
export const productos = [
  p("empanadas", "c-ent", "Empanadas de carne (x3)", "Cortadas a cuchillo, al horno", 7800),
  p("provoleta", "c-ent", "Provoleta a la parrilla", "Con orégano y ají molido", 8900, ["vegetariano", "sin_tacc", "picante"]),
  p("tabla", "c-ent", "Tabla de fiambres", "Jamón crudo, salame y quesos", 16500, ["sin_tacc"]),
  p("bife", "c-pri", "Bife de chorizo", "300 g, con guarnición a elección", 21500, ["sin_tacc"]),
  p("mila", "c-pri", "Milanesa napolitana", "Con jamón, salsa y queso, y papas fritas", 15900),
  p("ravioles", "c-pri", "Ravioles de ricota", "Salsa fileto o crema", 13800, ["vegetariano"]),
  p("risotto", "c-pri", "Risotto de hongos", "Parmesano y manteca", 16200, ["vegetariano", "sin_tacc"]),
  p("ensalada", "c-pri", "Ensalada completa", "Hojas verdes, tomate, huevo y atún", 11200, ["sin_tacc", "sin_lactosa"]),
  p("agua", "c-beb", "Agua mineral 500 ml", "", 2600, ["vegano", "sin_tacc", "sin_lactosa", "vegetariano"]),
  p("ipa", "c-beb", "Cerveza artesanal IPA", "Pinta de 473 ml", 5200, ["vegano"]),
  p("malbec", "c-beb", "Copa de Malbec", "Mendoza", 6400, ["vegano", "sin_tacc"]),
  p("limonada", "c-beb", "Limonada con menta", "Natural, con jengibre", 4300, ["vegano", "sin_tacc", "sin_lactosa", "vegetariano"]),
  p("flan", "c-pos", "Flan casero", "Con dulce de leche y crema", 6200, ["vegetariano", "sin_tacc"], false),
  p("brownie", "c-pos", "Brownie con helado", "Chocolate y vainilla", 7400, ["vegetariano"]),
];
export const indice = crearIndice({ productos, categorias });
