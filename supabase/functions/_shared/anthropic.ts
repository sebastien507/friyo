/** Appel Claude Haiku — la clé API ne quitte jamais le serveur. */
export async function chatJSON<T>(
  system: string,
  user: string,
): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude ${res.status}: ${body}`);
  }

  const data = await res.json();
  const rawText: string = data.content?.[0]?.text ?? "";

  // Claude ne garantit pas un JSON pur — on extrait le premier objet JSON trouvé
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in Claude response: ${rawText.slice(0, 300)}`);
  }

  return JSON.parse(jsonMatch[0]) as T;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français canadien (québécois : « souper », « épicerie »)",
  en: "Canadian English",
};
