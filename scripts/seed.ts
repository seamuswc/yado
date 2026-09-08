/* Seeds the head admin, a demo partner and the demo inventory. Safe to re-run. */
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/password";
import { newId } from "../src/lib/ids";
import { seedHotels, seedReviews } from "./seed-data";
import { recomputeRating } from "../src/lib/reviews";

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";

type Role = "head_admin" | "partner" | "guest";
const findUserByEmail = (email: string) => db.select().from(schema.users).where(eq(schema.users.email, email)).get();
function createUser(i: { email: string; name: string; role: Role; password: string; verified: boolean; locale?: string }) {
  const id = newId("u_");
  db.insert(schema.users).values({ id, email: i.email, name: i.name, role: i.role, passwordHash: hashPassword(i.password), locale: i.locale ?? "en", emailVerifiedAt: i.verified ? new Date().toISOString() : null }).run();
  return db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
}

let admin = findUserByEmail(adminEmail);
if (!admin) {
  admin = createUser({ email: adminEmail, name: process.env.ADMIN_NAME ?? "Head Admin", role: "head_admin", password: adminPassword, verified: true });
  console.log(`✔ head admin created: ${adminEmail} / ${adminPassword}`);
} else {
  console.log(`· head admin exists: ${adminEmail}`);
}

let partner = findUserByEmail("partner@example.com");
if (!partner) {
  partner = createUser({ email: "partner@example.com", name: "Demo Partner", role: "partner", password: "partner-demo-1234", verified: true, locale: "ja" });
  console.log("✔ demo partner created: partner@example.com / partner-demo-1234");
}

const paidUntil = new Date(Date.now() + 365 * 86_400_000).toISOString();
let inserted = 0;
for (const h of seedHotels) {
  const exists = db.select({ id: schema.hotels.id }).from(schema.hotels).where(eq(schema.hotels.slug, h.id)).get();
  if (exists) continue;
  const hotelId = newId("h_");
  db.insert(schema.hotels).values({
    id: hotelId, slug: h.id, ownerId: partner.id,
    nameEn: h.name.en, nameJa: h.name.ja, city: h.city, areaEn: h.area.en, areaJa: h.area.ja, type: h.type,
    descriptionEn: h.description.en, descriptionJa: h.description.ja, accessEn: h.access.en, accessJa: h.access.ja,
    stationEn: h.station?.en ?? "", stationJa: h.station?.ja ?? "", latitude: h.lat ?? null, longitude: h.lng ?? null,
    amenities: h.amenities, images: h.images, checkInTime: h.checkIn, checkOutTime: h.checkOut,
    legalName: h.name.ja, address: h.address ?? h.area.ja, phone: "03-0000-0000", licenseNumber: "DEMO",
    translation: "manual", status: "approved", paidUntil, reviewedAt: new Date().toISOString(),
  }).run();
  h.rooms.forEach((r, i) => {
    db.insert(schema.rooms).values({
      id: newId("r_"), hotelId, nameEn: r.name.en, nameJa: r.name.ja, descriptionEn: r.description.en, descriptionJa: r.description.ja,
      sleeps: r.sleeps, sizeSqm: r.sizeSqm ?? null, pricePerNight: r.pricePerNight, breakfast: r.breakfast, refundable: r.refundable, quantity: r.quantity ?? 3, image: r.image, sortOrder: i,
    }).run();
  });
  for (const rv of seedReviews.filter((x) => x.hotel === h.id)) {
    db.insert(schema.reviews).values({
      id: newId("rv_"), hotelId, authorName: rv.author, rating: rv.rating, title: rv.title.en, body: rv.body.en, locale: "en", stayMonth: rv.stayMonth,
    }).run();
    // Japanese copy of the same review so both locales read naturally.
    db.insert(schema.reviews).values({
      id: newId("rv_"), hotelId, authorName: rv.author, rating: rv.rating, title: rv.title.ja, body: rv.body.ja, locale: "ja", stayMonth: rv.stayMonth,
    }).run();
  }
  recomputeRating(hotelId);
  inserted++;
}
console.log(`✔ ${inserted} demo hotels inserted (${seedHotels.length - inserted} already present)`);
