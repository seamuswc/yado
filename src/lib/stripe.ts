import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/** Stripe client, or null when STRIPE_SECRET_KEY is not configured (demo mode). */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}

export const stripeConfigured = () => getStripe() !== null;

/** Local development may finish a stay or the annual fee without a card. Production never does. */
export function demoPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Annual partner fee in JPY. */
export const PARTNER_ANNUAL_FEE = Number(process.env.PARTNER_ANNUAL_FEE_JPY ?? 30000);
