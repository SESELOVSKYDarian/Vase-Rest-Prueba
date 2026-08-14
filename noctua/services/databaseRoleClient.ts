import { database } from '@/hooks/lib/databaseClient';

// La autorizacion real se valida en la API. Se conserva esta fabrica para que
// los servicios de dominio compartan una sola interfaz de acceso a PostgreSQL.
export function createDatabaseClientWithNoctuaRole() {
  return database;
}
