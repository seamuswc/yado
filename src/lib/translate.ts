import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Japanese → English translation for partner-entered listing text.
 * Uses the Claude API when credentials are available (ANTHROPIC_API_KEY or an `ant auth login` profile);
 * otherwise returns the Japanese text unchanged and reports `machine: false` so the listing is flagged.
 */

export type ListingTextJa = {
  name: string; area: string; description: string; access: string;
  rooms: { name: string; description: string }[];
};

const Out = z.object({
  name: z.string(),
  area: z.string(),
  description: z.string(),
  access: z.string(),
  rooms: z.array(z.object({ name: z.string(), description: z.string() })),
});
export type ListingTextEn = z.infer<typeof Out>;

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  try {
    client = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.TRANSLATION_ENABLED === "1"
      ? new Anthropic()
      : null;
  } catch {
    client = null;
  }
  return client;
}

export const translationAvailable = () => getClient() !== null;

export async function translateListing(ja: ListingTextJa): Promise<{ en: ListingTextEn; machine: boolean; error?: string }> {
  const fallback: ListingTextEn = { ...ja, rooms: ja.rooms.map((r) => ({ ...r })) };
  const c = getClient();
  if (!c) return { en: fallback, machine: false, error: "translation not configured" };
  try {
    const res = await c.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(Out) },
      system:
        "You translate Japanese hotel listing copy into natural, concise English for an international booking site. " +
        "Keep place names in standard romanization (e.g. Shinjuku, Gion), keep numbers, times and units, and keep the same number of rooms in the same order. " +
        "Do not add information that is not in the source. Return only the translated fields.",
      messages: [{ role: "user", content: JSON.stringify(ja) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return { en: fallback, machine: false, error: "translation declined" };
    const out = res.parsed_output;
    if (out.rooms.length !== ja.rooms.length) out.rooms = ja.rooms.map((r, i) => out.rooms[i] ?? { ...r });
    return { en: out, machine: true };
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : (e as Error).message;
    console.warn("translateListing failed:", msg);
    return { en: fallback, machine: false, error: msg };
  }
}
