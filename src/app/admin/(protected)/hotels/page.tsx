import { requireAdminPage } from "@/lib/auth";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, PageTitle, Table, fmtDay, HotelLink } from "@/components/admin/ui";
import { isLive } from "@/lib/hotels";

export default async function HotelsPage() {
  await requireAdminPage();
  const rows = db.select({
    h: schema.hotels, owner: schema.users.email,
    rooms: sql<number>`(select count(*) from rooms r where r.hotel_id = ${schema.hotels.id} and r.active = 1)`,
    bookings: sql<number>`(select count(*) from bookings b where b.hotel_id = ${schema.hotels.id} and b.status = 'confirmed')`,
  }).from(schema.hotels).leftJoin(schema.users, eq(schema.hotels.ownerId, schema.users.id)).orderBy(desc(schema.hotels.createdAt)).all();

  const statusBadge = (h: schema.Hotel) => {
    if (h.status === "pending") return <Badge tone="warn">Pending review</Badge>;
    if (h.status === "rejected") return <Badge tone="bad">Rejected</Badge>;
    if (h.status === "suspended") return <Badge tone="bad">Suspended</Badge>;
    return isLive(h) ? <Badge tone="ok">Live</Badge> : <Badge tone="warn">Approved · fee unpaid</Badge>;
  };

  return (
    <div>
      <PageTitle sub={`${rows.length} properties. Live = approved and annual fee paid.`}>Hotels</PageTitle>
      <Table head={["Property", "Owner", "Status", "Paid until", "Rooms", "Bookings", "Rating", "EN copy"]}>
        {rows.map(({ h, owner, rooms, bookings }) => (
          <tr key={h.id} className="hover:bg-paper">
            <td className="px-3 py-2"><HotelLink id={h.id} name={h.nameJa} /><div className="text-xs text-muted">{h.nameEn} · {h.city}</div></td>
            <td className="px-3 py-2 text-xs">{owner ?? "—"}</td>
            <td className="px-3 py-2">{statusBadge(h)}</td>
            <td className="px-3 py-2 text-xs">{fmtDay(h.paidUntil)}</td>
            <td className="px-3 py-2">{rooms}</td>
            <td className="px-3 py-2">{bookings}</td>
            <td className="px-3 py-2">{h.reviewCount ? `${h.rating.toFixed(1)} (${h.reviewCount})` : "—"}</td>
            <td className="px-3 py-2"><Badge tone={h.translation === "pending" ? "warn" : "muted"}>{h.translation}</Badge></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
