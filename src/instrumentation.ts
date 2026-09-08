export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { takeServerSample, pruneSamples } = await import("@/lib/analytics");
  const { expireStaleBookings } = await import("@/lib/booking-server");

  // Event-loop lag: measure how late a 500 ms timer fires.
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    globalThis.__yadoLoopLag = Math.max(0, now - last - 500);
    last = now;
  }, 500).unref();

  const sample = () => {
    try { takeServerSample(); expireStaleBookings(); } catch (e) { console.warn("sample failed", e); }
  };
  setInterval(() => { try { pruneSamples(); } catch { /* ignore */ } }, 6 * 3_600_000).unref();
  setTimeout(sample, 5_000).unref();
  setInterval(sample, 60_000).unref();
}
