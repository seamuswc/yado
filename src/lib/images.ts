/** Hosts configured in next.config.ts `images.remotePatterns`. Anything else is rendered unoptimized so partner photos never crash a page. */
const optimizedHosts = new Set(["picsum.photos", "images.unsplash.com"]);

export function imgOpts(src: string): { unoptimized: boolean } {
  try {
    return { unoptimized: !optimizedHosts.has(new URL(src).hostname) };
  } catch {
    return { unoptimized: true };
  }
}
