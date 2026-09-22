import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null for guests (magic-link only)
  name: text("name").notNull().default(""),
  role: text("role", { enum: ["head_admin", "partner", "guest"] }).notNull().default("guest"),
  emailVerifiedAt: text("email_verified_at"),
  locale: text("locale").notNull().default("en"),
  disabledAt: text("disabled_at"),
  createdAt: text("created_at").notNull().default(now),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha256(token)
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(), // sha256(token)
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().default(""), // magic links for not-yet-existing guests carry the email instead
  purpose: text("purpose", { enum: ["verify_email", "reset_password", "magic_link"] }).notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

export const hotels = sqliteTable("hotels", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  nameEn: text("name_en").notNull(),
  nameJa: text("name_ja").notNull(),
  city: text("city").notNull(),
  areaEn: text("area_en").notNull().default(""),
  areaJa: text("area_ja").notNull().default(""),
  type: text("type", { enum: ["hotel", "ryokan", "business", "hostel"] }).notNull().default("hotel"),
  descriptionEn: text("description_en").notNull().default(""),
  descriptionJa: text("description_ja").notNull().default(""),
  accessEn: text("access_en").notNull().default(""),
  accessJa: text("access_ja").notNull().default(""),
  stationEn: text("station_en").notNull().default(""), // nearest station
  stationJa: text("station_ja").notNull().default(""),
  latitude: real("latitude"),
  longitude: real("longitude"),
  amenities: text("amenities", { mode: "json" }).$type<string[]>().notNull().default([]),
  images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
  checkInTime: text("check_in_time").notNull().default("15:00"),
  checkOutTime: text("check_out_time").notNull().default("11:00"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  // Legal / contact details collected at registration
  legalName: text("legal_name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  licenseNumber: text("license_number").notNull().default(""), // 旅館業許可番号
  // How the English copy was produced: partner writes Japanese; English is machine-translated on save.
  translation: text("translation", { enum: ["pending", "machine", "manual"] }).notNull().default("pending"),
  status: text("status", { enum: ["pending", "approved", "rejected", "suspended"] }).notNull().default("pending"),
  // Annual partner fee. Listing is public only while status = approved AND paidUntil is in the future.
  paidUntil: text("paid_until"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  lastFeeSource: text("last_fee_source"), // Checkout session / invoice id already applied (idempotency)
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("hotels_status_idx").on(t.status), index("hotels_owner_idx").on(t.ownerId)]);

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
  nameEn: text("name_en").notNull(),
  nameJa: text("name_ja").notNull(),
  descriptionEn: text("description_en").notNull().default(""),
  descriptionJa: text("description_ja").notNull().default(""),
  sleeps: integer("sleeps").notNull().default(2),
  sizeSqm: integer("size_sqm"), // room size in m²
  pricePerNight: integer("price_per_night").notNull(), // JPY incl. tax
  breakfast: integer("breakfast", { mode: "boolean" }).notNull().default(false),
  refundable: integer("refundable", { mode: "boolean" }).notNull().default(true),
  quantity: integer("quantity").notNull().default(1), // how many of this room exist
  image: text("image").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("rooms_hotel_idx").on(t.hotelId)]);

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  ref: text("ref").notNull().unique(),
  hotelId: text("hotel_id").notNull().references(() => hotels.id),
  roomId: text("room_id").notNull().references(() => rooms.id),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  guests: integer("guests").notNull(),
  nights: integer("nights").notNull(),
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("jpy"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  requests: text("requests").notNull().default(""),
  locale: text("locale").notNull().default("en"),
  status: text("status", { enum: ["pending_payment", "confirmed", "cancelled", "refunded"] }).notNull().default("pending_payment"),
  paymentMode: text("payment_mode", { enum: ["stripe", "demo"] }).notNull().default("demo"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: text("paid_at"),
  cancelledAt: text("cancelled_at"),
  viewTokenHash: text("view_token_hash"), // sha256 of the secret that opens the confirmation page
  createdAt: text("created_at").notNull().default(now),
}, (t) => [
  index("bookings_hotel_idx").on(t.hotelId),
  index("bookings_room_dates_idx").on(t.roomId, t.checkIn, t.checkOut),
  index("bookings_created_idx").on(t.createdAt),
  index("bookings_email_idx").on(t.email),
]);

/** Product analytics: one row per notable event (page view, search, booking…). */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  path: text("path").notNull().default(""),
  locale: text("locale").notNull().default(""),
  visitorId: text("visitor_id").notNull().default(""),
  meta: text("meta").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("events_created_idx").on(t.createdAt), index("events_type_idx").on(t.type)]);

/** Server health samples taken every minute by instrumentation.ts. */
export const serverSamples = sqliteTable("server_samples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rssMb: real("rss_mb").notNull(),
  heapUsedMb: real("heap_used_mb").notNull(),
  totalMemMb: real("total_mem_mb").notNull(),
  load1: real("load1").notNull(),
  cpus: integer("cpus").notNull(),
  eventLoopLagMs: real("event_loop_lag_ms").notNull(),
  dbSizeMb: real("db_size_mb").notNull(),
  requestsLastMinute: integer("requests_last_minute").notNull().default(0),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("samples_created_idx").on(t.createdAt)]);

/** Outbound emails. Stored so the admin can see them even without an email provider configured. */
export const emails = sqliteTable("emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  provider: text("provider").notNull().default("console"),
  status: text("status").notNull().default("logged"),
  createdAt: text("created_at").notNull().default(now),
});

/** Bearer keys for ChatGPT, Grok, and other assistants. The secret is stored only as a hash. */
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  token: text("token"), // kept so the owner can copy the key again from the dashboard
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull().default(""),
  prefix: text("prefix").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
}, (t) => [index("api_keys_user_idx").on(t.userId)]);

/** Successful API writes, so a retried assistant call does not book or list twice. */
export const idempotencyKeys = sqliteTable("idempotency_keys", {
  id: text("id").primaryKey(),
  status: integer("status").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
});

/** Guest reviews. One per booking; only confirmed bookings whose stay has ended can be reviewed. */
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull().default(""),
  rating: integer("rating").notNull(), // 1–5
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  locale: text("locale").notNull().default("en"),
  stayMonth: text("stay_month").notNull().default(""), // YYYY-MM of the stay
  status: text("status", { enum: ["visible", "hidden"] }).notNull().default("visible"),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("reviews_hotel_idx").on(t.hotelId), index("reviews_booking_idx").on(t.bookingId)]);

export type User = typeof users.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Hotel = typeof hotels.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
