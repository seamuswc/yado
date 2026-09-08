import { requireAdminPage } from "@/lib/auth";
import { cancelBooking } from "@/actions/admin";
import { Badge, Btn, PageTitle, Table, fmtDate, yen, HotelLink } from "@/components/admin/ui";
import { allBookings } from "@/lib/booking-server";

export default async function BookingsPage() {
  await requireAdminPage();
  const rows = allBookings(300);
  const tone = (s: string) => (s === "confirmed" ? "ok" : s === "pending_payment" ? "warn" : "muted") as "ok" | "warn" | "muted";
  const total = rows.filter((b) => b.status === "confirmed").reduce((a, b) => a + b.total, 0);
  return (
    <div>
      <PageTitle sub={`${rows.length} most recent · confirmed revenue shown: ${yen(total)}`}>Bookings</PageTitle>
      <Table head={["Ref", "Property", "Guest", "Stay", "Total", "Payment", "Status", "Created", ""]}>
        {rows.map((b) => (
          <tr key={b.id} className="hover:bg-paper">
            <td className="px-3 py-2 font-mono text-xs">{b.ref}</td>
            <td className="px-3 py-2"><HotelLink id={b.hotelId} name={b.hotel.nameJa} /><div className="text-xs text-muted">{b.room?.nameJa}</div></td>
            <td className="px-3 py-2">{b.lastName} {b.firstName}<div className="text-xs text-muted">{b.email}</div></td>
            <td className="px-3 py-2 text-xs">{b.checkIn} → {b.checkOut}<br />{b.nights}n · {b.guests}p</td>
            <td className="px-3 py-2 font-medium">{yen(b.total)}</td>
            <td className="px-3 py-2"><Badge tone={b.paymentMode === "stripe" ? "info" : "muted"}>{b.paymentMode}</Badge></td>
            <td className="px-3 py-2"><Badge tone={tone(b.status)}>{b.status}</Badge></td>
            <td className="px-3 py-2 text-xs">{fmtDate(b.createdAt)}</td>
            <td className="px-3 py-2">
              {(b.status === "confirmed" || b.status === "pending_payment") && (
                <form action={cancelBooking} className="flex gap-1">
                  <input type="hidden" name="bookingId" value={b.id} />
                  <Btn name="refund" value="0">Cancel</Btn>
                  {b.status === "confirmed" && <Btn tone="danger" name="refund" value="1">Cancel + refund</Btn>}
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
