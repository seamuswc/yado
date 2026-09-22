import { requireAdminPage } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { setReviewVisibility } from "@/actions/admin";
import { Badge, Btn, PageTitle, Table, fmtDate, HotelLink } from "@/components/admin/ui";

export default async function ReviewsPage() {
  await requireAdminPage();
  const rows = db.select({ r: schema.reviews, h: schema.hotels }).from(schema.reviews).innerJoin(schema.hotels, eq(schema.reviews.hotelId, schema.hotels.id)).orderBy(desc(schema.reviews.createdAt)).limit(300).all();
  return (
    <div>
      <PageTitle sub="Reviews can only be posted by guests with a completed, confirmed booking. Hidden reviews are excluded from ratings.">Reviews</PageTitle>
      <Table head={["Property", "Rating", "Review", "Author", "Source", "Posted", ""]}>
        {rows.map(({ r, h }) => (
          <tr key={r.id} className={`hover:bg-paper ${r.status === "hidden" ? "opacity-60" : ""}`}>
            <td className="px-3 py-2"><HotelLink id={h.id} name={h.nameJa} /></td>
            <td className="px-3 py-2 text-accent">{"★".repeat(r.rating)}</td>
            <td className="px-3 py-2 max-w-md">
              <div className="font-medium">{r.titleEn || r.title}</div>
              <div className="text-xs text-muted line-clamp-2">{r.bodyEn || r.body}</div>
              {(r.titleJa || r.bodyJa) && (r.titleJa !== r.titleEn || r.bodyJa !== r.bodyEn) && (
                <div className="mt-1 text-xs text-muted line-clamp-2">JA: {r.titleJa || r.title} — {r.bodyJa || r.body}</div>
              )}
            </td>
            <td className="px-3 py-2 text-xs">{r.authorName}<br />{r.locale} · {r.stayMonth}</td>
            <td className="px-3 py-2"><Badge tone={r.bookingId ? "ok" : "muted"}>{r.bookingId ? "verified booking" : "seed"}</Badge></td>
            <td className="px-3 py-2 text-xs">{fmtDate(r.createdAt)}</td>
            <td className="px-3 py-2">
              <form action={setReviewVisibility}>
                <input type="hidden" name="reviewId" value={r.id} />
                <Btn name="status" value={r.status === "hidden" ? "visible" : "hidden"}>{r.status === "hidden" ? "Show" : "Hide"}</Btn>
              </form>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
