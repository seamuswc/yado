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
  name: string; area: string; description: string; access: string; station?: string;
  rooms: { name: string; description: string }[];
};

const Out = z.object({
  name: z.string(),
  area: z.string(),
  description: z.string(),
  access: z.string(),
  station: z.string(),
  rooms: z.array(z.object({ name: z.string(), description: z.string() })),
});
export type ListingTextEn = z.infer<typeof Out>;

/** True when the text contains kana or kanji. */
export const hasJapanese = (s: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(s);

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

export function anthropic(): Anthropic | null {
  return getClient();
}

const JA_TO_EN =
  "You translate Japanese hotel listing copy into natural, concise English for an international booking site. " +
  "Keep place names in standard romanization (e.g. Shinjuku, Gion), keep numbers, times and units, and keep the same number of rooms in the same order. " +
  "Do not add information that is not in the source. Return only the translated fields.";

const EN_TO_JA =
  "You translate English hotel listing copy into natural Japanese for a Japanese booking site (丁寧語, the register of a hotel website). " +
  "Write place names and station names the way they are written in Japan (祇園, 祇園四条). Keep numbers, times and units. Keep the same number of rooms in the same order. " +
  "Leave the property name as it is unless it is a plain description. Do not add information that is not in the source. Return only the translated fields.";

async function run(text: ListingTextJa, system: string, label: string): Promise<{ out: ListingTextEn; machine: boolean; error?: string }> {
  const fallback: ListingTextEn = { ...text, station: text.station ?? "", rooms: text.rooms.map((r) => ({ ...r })) };
  const c = getClient();
  if (!c) return { out: fallback, machine: false, error: "translation not configured" };
  try {
    const res = await c.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(Out) },
      system,
      messages: [{ role: "user", content: JSON.stringify({ ...text, station: text.station ?? "" }) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return { out: fallback, machine: false, error: "translation declined" };
    const out = res.parsed_output;
    if (out.rooms.length !== text.rooms.length) out.rooms = text.rooms.map((r, i) => out.rooms[i] ?? { ...r });
    return { out, machine: true };
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : (e as Error).message;
    console.warn(`${label} failed:`, msg);
    return { out: fallback, machine: false, error: msg };
  }
}

export async function translateListing(ja: ListingTextJa): Promise<{ en: ListingTextEn; machine: boolean; error?: string }> {
  const r = await run(ja, JA_TO_EN, "translateListing");
  return { en: r.out, machine: r.machine, error: r.error };
}

/** The other direction: an assistant sent English, Japanese guests need Japanese. */
export async function translateListingToJa(en: ListingTextJa): Promise<{ ja: ListingTextEn; machine: boolean; error?: string }> {
  const r = await run(en, EN_TO_JA, "translateListingToJa");
  return { ja: r.out, machine: r.machine, error: r.error };
}
