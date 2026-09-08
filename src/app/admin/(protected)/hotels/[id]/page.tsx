import { requireAdminPage } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { reviewHotel } from "@/actions/admin";
import { updateListing } from "@/actions/partner";
import ListingForm from "@/components/ListingForm";
import { Badge, Btn, Card, PageTitle, fmtDate, fmtDay } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n";
import { isLive } from "@/lib/hotels";
import { translationAvailable } from "@/lib/translate";
import { toDraft } from "@/lib/listing-draft";

export default async function AdminHotelPage(props: PageProps<"/admin/hotels/[id]">) {
  await requireAdminPage();
  const { id } = await props.params;
  const h = db.select().from(schema.hotels).where(eq(schema.hotels.id, id)).get();
  if (!h) notFound();
  const owner = h.ownerId ? db.select().from(schema.users).where(eq(schema.users.id, h.ownerId)).get() : null;
  const rooms = db.select().from(schema.rooms).where(eq(schema.rooms.hotelId, h.id)).all();
  const back = `/admin/hotels/${h.id}`;
  return (
    <div>
      <PageTitle sub={<>{h.nameEn} · <Link className="underline" href={`/en/hotels/${h.slug}`}>/en/hotels/{h.slug}</Link></>}>{h.nameJa}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Status">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone={h.status === "approved" ? (isLive(h) ? "ok" : "warn") : h.status === "pending" ? "warn" : "bad"}>{h.status}{h.status === "approved" && !isLive(h) ? " · fee unpaid" : ""}</Badge>
              <Badge tone={h.translation === "pending" ? "warn" : "muted"}>translation: {h.translation}</Badge>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Owner</dt><dd>{owner ? `${owner.name} · ${owner.email}` : "—"}</dd>
              <dt className="text-muted">Verified</dt><dd>{owner?.emailVerifiedAt ? "yes" : "no"}</dd>
              <dt className="text-muted">Licence</dt><dd className="font-mono">{h.licenseNumber || "—"}</dd>
              <dt className="text-muted">Paid until</dt><dd>{fmtDay(h.paidUntil)}</dd>
              <dt className="text-muted">Stripe</dt><dd className="font-mono text-xs">{h.stripeSubscriptionId ?? "—"}</dd>
              <dt className="text-muted">Submitted</dt><dd>{fmtDate(h.createdAt)}</dd>
              <dt className="text-muted">Reviewed</dt><dd>{fmtDate(h.reviewedAt)}</dd>
            </dl>
            {h.reviewNote && <p className="mt-2 text-sm rounded-lg bg-paper px-2 py-1"><span className="text-muted">Note:</span> {h.reviewNote}</p>}
            <form action={reviewHotel} className="mt-3 space-y-2">
              <input type="hidden" name="hotelId" value={h.id} /><input type="hidden" name="back" value={back} />
              <input name="note" placeholder="Note to partner" className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm" />
              <div className="flex flex-wrap gap-2">
                {h.status !== "approved" && <Btn tone="primary" name="decision" value={h.status === "suspended" ? "reinstate" : "approve"}>✓ {h.status === "suspended" ? "Reinstate" : "Approve"}</Btn>}
                {h.status === "pending" && <Btn tone="danger" name="decision" value="reject">✕ Reject</Btn>}
                {h.status === "approved" && <Btn tone="danger" name="decision" value="suspend">Suspend</Btn>}
                {h.status === "approved" && <Btn name="decision" value="mark_paid">Mark fee paid (+1 year)</Btn>}
              </div>
            </form>
          </Card>
        </div>
        <Card title="Listing (admin edit)">
          <ListingForm locale="en" dict={getDictionary("en")} initial={toDraft(h, rooms)} mode="edit" action={updateListing} translationAvailable={translationAvailable()} />
        </Card>
      </div>
    </div>
  );
}
