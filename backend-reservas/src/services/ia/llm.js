/**
 * IA gratuita opcional. Orden de preferencia: LLM_PROVIDER, o la primera clave que haya.
 *  - Gemini (Google AI Studio, nivel gratuito):  GEMINI_API_KEY   (modelo GEMINI_MODEL)
 *  - Groq (nivel gratuito, Llama):                GROQ_API_KEY     (modelo GROQ_MODEL)
 *  - Claude:                                      ANTHROPIC_API_KEY (modelo ANTHROPIC_FAST_MODEL)
 * Sin ninguna clave todo sigue funcionando con el motor local; la IA solo mejora casos difíciles.
 * Las respuestas siempre se validan contra la carta real antes de usarse.
 */
const TIEMPO_MAXIMO = 8000;

export function proveedorLlm() {
  const elegido = String(process.env.LLM_PROVIDER || "").toLowerCase();
  const claves = { gemini: process.env.GEMINI_API_KEY, groq: process.env.GROQ_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY };
  if (elegido && claves[elegido]) return elegido;
  return Object.keys(claves).find((p) => claves[p]) ?? null;
}

/** Saca el JSON de una respuesta aunque venga envuelta en ```json ... ```. */
export function leerJson(texto) {
  const limpio = String(texto ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(limpio); } catch { /* sigue */ }
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio >= 0 && fin > inicio) {
    try { return JSON.parse(limpio.slice(inicio, fin + 1)); } catch { /* nada */ }
  }
  return null;
}

async function llamar(url, init) {
  const respuesta = await fetch(url, { ...init, signal: AbortSignal.timeout(TIEMPO_MAXIMO) });
  if (!respuesta.ok) throw new Error(`${respuesta.status} ${(await respuesta.text()).slice(0, 200)}`);
  return respuesta.json();
}

/** Pide una respuesta en JSON. Devuelve null si no hay IA configurada o si falla (el llamador usa el motor local). */
export async function pedirJson({ sistema, usuario, maxTokens = 900 }) {
  const proveedor = proveedorLlm();
  if (!proveedor) return null;
  try {
    if (proveedor === "gemini") {
      const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
      const r = await llamar(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: maxTokens },
        }),
      });
      return leerJson(r.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "");
    }
    if (proveedor === "groq") {
      const r = await llamar("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: `${sistema}\nRespondé solo con un objeto JSON.` }, { role: "user", content: usuario }],
        }),
      });
      return leerJson(r.choices?.[0]?.message?.content ?? "");
    }
    const r = await llamar("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5",
        max_tokens: maxTokens,
        system: `${sistema}\nRespondé solo con un objeto JSON.`,
        messages: [{ role: "user", content: usuario }],
      }),
    });
    return leerJson(r.content?.map((b) => b.text ?? "").join("") ?? "");
  } catch (error) {
    console.warn(`[ia] ${proveedor} no respondió: ${String(error.message).slice(0, 160)}`);
    return null;
  }
}
