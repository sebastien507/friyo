/** Appel OpenAI GPT-4o mini — la clé API ne quitte jamais le serveur. */
export async function chatJSON<T>(
  system: string,
  user: string,
): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français canadien (québécois : « souper », « épicerie »)",
  en: "Canadian English",
};
