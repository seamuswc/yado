/** Pulls a pin out of a Google Maps link. Short links are followed only across Maps hosts. */

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

export class MapsLinkError extends Error {
  constructor() { super("maps_link"); }
}

function allowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (host === "maps.google.com" || host.endsWith(".google.com") || host.endsWith(".google.co.jp")) {
    return host.startsWith("maps.") || url.pathname.startsWith("/maps");
  }
  return false;
}

function coordsFrom(url: URL): { latitude: number; longitude: number } | null {
  const text = decodeURIComponent(url.href);
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return { latitude, longitude };
  }
  return null;
}

async function follow(start: URL): Promise<URL> {
  let current = start;
  for (let i = 0; i < 5; i++) {
    if (!SHORT_HOSTS.has(current.hostname.toLowerCase())) return current;
    let res: Response;
    try {
      res = await fetch(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4000) });
    } catch {
      return current;
    }
    const loc = res.headers.get("location");
    if (!loc) return current;
    const next = new URL(loc, current);
    if (!allowed(next)) return current;
    current = next;
  }
  return current;
}

export async function resolveMapsLink(raw: string): Promise<{ latitude: number | null; longitude: number | null }> {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new MapsLinkError(); }
  if (!allowed(url)) throw new MapsLinkError();
  const finalUrl = SHORT_HOSTS.has(url.hostname.toLowerCase()) ? await follow(url) : url;
  const coords = coordsFrom(finalUrl);
  return { latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null };
}
