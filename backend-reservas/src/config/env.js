import { config } from "dotenv";
// Carga .env y .env.local (Next.js convention)
config();
config({ path: ".env.local", override: false });

// Variables obligatorias del backend; no se envian al frontend.
const requiredEnv = [
  "DATABASE_URL",
];

for (const variable of requiredEnv) {
  if (!process.env[variable]) {
    throw new Error(`Falta la variable de entorno ${variable}`);
  }
}

export const env = {
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true",
};
