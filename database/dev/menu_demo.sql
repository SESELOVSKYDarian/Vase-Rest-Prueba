-- Menú de ejemplo SOLO para desarrollo local (idempotente). No usar en producción.
-- Uso: psql "$DATABASE_URL" -f database/dev/menu_demo.sql
with cat as (select id, nombre from categorias),
datos(categoria, nombre, descripcion, precio, stock) as (values
  ('Entradas','Provoleta a la parrilla','Con orégano y ají molido',8900,40),
  ('Entradas','Empanadas de carne (x3)','Cortadas a cuchillo, al horno',7800,60),
  ('Entradas','Tabla de fiambres','Jamón crudo, salame y quesos',16500,20),
  ('Principales','Milanesa napolitana','Con papas fritas',15900,35),
  ('Principales','Bife de chorizo','300 g, con guarnición a elección',21500,25),
  ('Principales','Ravioles de ricota','Salsa fileto o crema',13800,30),
  ('Principales','Risotto de hongos','Parmesano y manteca',16200,18),
  ('Principales','Ensalada completa','Hojas verdes, tomate, huevo y atún',11200,30),
  ('Bebidas','Cerveza artesanal IPA','Pinta 473 ml',5200,80),
  ('Bebidas','Limonada con menta','Jarra individual',4300,50),
  ('Bebidas','Agua mineral 500 ml','Con o sin gas',2600,120),
  ('Bebidas','Copa de Malbec','Selección de la casa',6400,45),
  ('Postres','Flan casero','Dulce de leche y crema',6200,22),
  ('Postres','Brownie con helado','Chocolate semiamargo',7400,18)
)
insert into productos (categoria_id, nombre, descripcion, precio, stock_actual, stock, disponible, activo)
select cat.id, d.nombre, d.descripcion, d.precio, d.stock, d.stock, true, true
from datos d join cat on cat.nombre = d.categoria
where not exists (select 1 from productos p where p.nombre = d.nombre);
