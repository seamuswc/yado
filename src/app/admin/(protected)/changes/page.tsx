import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveChangeRequest } from "@/actions/admin";
import { Badge, Btn, Card, Empty, PageTitle, fmtDate, HotelLink } from "@/components/admin/ui";
import { cities, typeLabel } from "@/lib/hotels-shared";

export const dynamic = "force-dynamic";

const current = (h: schema.Hotel, f: schema.ChangeRequest["field"]) =>
  f === "name" ? h.nameJa
  : f === "type" ? (typeLabel[h.type as keyof typeof typeLabel]?.en ?? h.type)
  : f === "city" ? (cities.find((c) => c.id === h.city)?.name.en ?? h.city)
  : f === "address" ? h.address
  : f === "pin" ? (h.latitude != null && h.longitude != null ? `${h.latitude}, ${h.longitude}` : "no pin")
  : "—";

/** Partners' requests to change registered details. Apply the change on the hotel page, then close the request here. */
export default async function ChangesPage() {
  await requireAdminPage();
  const rows = db.select({ r: schema.changeRequests, h: schema.hotels, u: schema.users })
    .from(schema.changeRequests)
    .innerJoin(schema.hotels, eq(schema.changeRequests.hotelId, schema.hotels.id))
    .leftJoin(schema.users, eq(schema.changeRequests.userId, schema.users.id))
    .orderBy(desc(schema.changeRequests.createdAt)).limit(200).all();
  const open = rows.filter((x) => x.r.status === "open");
  const closed = rows.filter((x) => x.r.status !== "open");

  return (
    <div>
      <PageTitle sub="Partners cannot edit name, type, area, address, or map pin themselves. Apply the change on the hotel page, then mark the request done (or decline it with a reason). The partner is emailed either way.">Change requests</PageTitle>
      <h2 className="font-semibold mb-2">Open ({open.length})</h2>
      {open.length === 0 && <Empty>No open change requests.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {open.map(({ r, h, u }) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold"><HotelLink id={h.id} name={h.nameJa} /></h3>
                <p className="text-xs text-muted">{u?.name} · {u?.email} · {fmtDate(r.createdAt)}</p>
              </div>
              <Badge tone="warn">{r.field}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Now</dt><dd>{current(h, r.field)}</dd>
              <dt className="text-muted">Requested</dt><dd className="font-medium">{r.requested}</dd>
              {r.reason && <><dt className="text-muted">Reason</dt><dd className="whitespace-pre-line">{r.reason}</dd></>}
            </dl>
            <p className="mt-2 text-xs text-muted">Edit the listing at <Link className="underline" href={`/admin/hotels/${h.id}`}>/admin/hotels/{h.id}</Link>, then close this request.</p>
            <form action={resolveChangeRequest} className="mt-3 space-y-2">
              <input type="hidden" name="requestId" value={r.id} />
              <input name="note" placeholder="Note to partner (required when declining)" className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm" />
              <div className="flex gap-2">
                <Btn tone="primary" name="decision" value="done">✓ Applied</Btn>
                <Btn tone="danger" name="decision" value="declined">✕ Decline</Btn>
              </div>
            </form>
          </Card>
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="font-semibold mt-8 mb-2">Closed ({closed.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {closed.map(({ r, h, u }) => (
              <Card key={r.id} className="opacity-80">
                <div className="flex justify-between gap-2">
                  <div><HotelLink id={h.id} name={h.nameJa} /><p className="text-xs text-muted">{u?.email} · {r.field} · {fmtDate(r.resolvedAt)}</p></div>
                  <Badge tone={r.status === "done" ? "ok" : "muted"}>{r.status}</Badge>
                </div>
                <p className="text-sm mt-2">{r.requested}</p>
                {r.adminNote && <p className="text-sm mt-1"><span className="text-muted">Note:</span> {r.adminNote}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
