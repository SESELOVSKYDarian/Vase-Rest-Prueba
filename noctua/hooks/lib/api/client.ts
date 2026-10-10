const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/** El backend exige sesión: se manda el token guardado al iniciar sesión (igual que databaseClient). */
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = JSON.parse(localStorage.getItem("noctua-auth") || "{}")?.state?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}


export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Error en la petición: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage += ` - ${errorData.error}`;
      } else if (errorData.mensaje) {
        errorMessage += ` - ${errorData.mensaje}`;
      }
    } catch {
      // If we can't parse JSON, just use text
      try {
        const text = await response.text();
        if (text) errorMessage += ` - ${text}`;
      } catch {}
    }
    throw new Error(errorMessage);
  }

  return response.json();
}