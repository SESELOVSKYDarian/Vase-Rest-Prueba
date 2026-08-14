import { env } from "./config/env.js";
import app from "./app.js";
import { seedLocalAdmin } from "./controllers/auth.controller.js";
import { runMigrations } from "./config/migrations.js";

const PORT = env.port;

// Inicia Express usando el puerto validado por configuracion.
await runMigrations();
await seedLocalAdmin();
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `El puerto ${PORT} ya esta siendo utilizado. Cierra la instancia anterior del servidor.`
    );
    process.exit(1);
  }

  throw error;
});
