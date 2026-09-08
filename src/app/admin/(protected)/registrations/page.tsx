import { requireAdminPage } from "@/lib/auth";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { reviewHotel } from "@/actions/admin";
import { Badge, Btn, Card, Empty, PageTitle, fmtDate, HotelLink } from "@/components/admin/ui";
import { cities } from "@/lib/hotels-shared";

export default async function RegistrationsPage() {
  await requireAdminPage();
  const rows = db.select({ h: schema.hotels, u: schema.users })
    .from(schema.hotels).leftJoin(schema.users, eq(schema.hotels.ownerId, schema.users.id))
    .where(inArray(schema.hotels.status, ["pending", "rejected"]))
    .orderBy(desc(schema.hotels.createdAt)).all();
  const pending = rows.filter((r) => r.h.status === "pending");
  const rejected = rows.filter((r) => r.h.status === "rejected");
  const roomCount = (id: string) => db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, id)).all().length;

  return (
    <div>
      <PageTitle sub="Properties submitted by partners. Approve to let them pay the annual fee and go live; reject with a note they can act on.">Registrations</PageTitle>
      <h2 className="font-semibold mb-2">Awaiting review ({pending.length})</h2>
      {pending.length === 0 && <Empty>Nothing waiting for review.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {pending.map(({ h, u }) => (
          <Card key={h.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold"><HotelLink id={h.id} name={h.nameJa} /></h3>
                <p className="text-sm text-muted">{h.nameEn}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={u?.emailVerifiedAt ? "ok" : "warn"}>{u?.emailVerifiedAt ? "Email verified" : "Email not verified"}</Badge>
                <Badge tone={h.translation === "machine" ? "info" : h.translation === "manual" ? "ok" : "warn"}>{h.translation === "machine" ? "Auto-translated" : h.translation === "manual" ? "Manual EN" : "Not translated"}</Badge>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Type / area</dt><dd>{h.type} · {cities.find((c) => c.id === h.city)?.name.en ?? h.city}</dd>
              <dt className="text-muted">Address</dt><dd>{h.address}</dd>
              <dt className="text-muted">Licence</dt><dd className="font-mono">{h.licenseNumber || "—"}</dd>
              <dt className="text-muted">Contact</dt><dd>{u?.name} · {u?.email} · {h.phone}</dd>
              <dt className="text-muted">Rooms</dt><dd>{roomCount(h.id)}</dd>
              <dt className="text-muted">Submitted</dt><dd>{fmtDate(h.createdAt)}</dd>
            </dl>
            <p className="mt-2 text-sm whitespace-pre-line line-clamp-4">{h.descriptionJa}</p>
            <form action={reviewHotel} className="mt-3 space-y-2">
              <input type="hidden" name="hotelId" value={h.id} />
              <input type="hidden" name="back" value="/admin/registrations" />
              <input name="note" placeholder="Note to partner (required when rejecting)" className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm" />
              <div className="flex gap-2">
                <Btn tone="primary" name="decision" value="approve">✓ Approve</Btn>
                <Btn tone="danger" name="decision" value="reject">✕ Reject</Btn>
              </div>
            </form>
          </Card>
        ))}
      </div>

      {rejected.length > 0 && (
        <>
          <h2 className="font-semibold mt-8 mb-2">Rejected ({rejected.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {rejected.map(({ h, u }) => (
              <Card key={h.id} className="opacity-80">
                <div className="flex justify-between gap-2">
                  <div><HotelLink id={h.id} name={h.nameJa} /><p className="text-xs text-muted">{u?.email} · {fmtDate(h.reviewedAt)}</p></div>
                  <Badge tone="bad">Rejected</Badge>
                </div>
                <p className="text-sm mt-2"><span className="text-muted">Note:</span> {h.reviewNote || "—"}</p>
                <form action={reviewHotel} className="mt-2">
                  <input type="hidden" name="hotelId" value={h.id} /><input type="hidden" name="back" value="/admin/registrations" />
                  <Btn name="decision" value="approve">Approve after all</Btn>
                </form>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
