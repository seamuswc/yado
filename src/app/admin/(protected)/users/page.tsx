import { requireAdminPage } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { setUserDisabled } from "@/actions/admin";
import { Badge, Btn, PageTitle, Table, fmtDate } from "@/components/admin/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function UsersPage() {
  await requireAdminPage();
  const me = await getCurrentUser();
  const rows = db.select({
    u: schema.users,
    bookings: sql<number>`(select count(*) from bookings b where b.user_id = ${schema.users.id} or b.email = ${schema.users.email})`,
  }).from(schema.users).orderBy(desc(schema.users.createdAt)).limit(500).all();
  const audit = db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(40).all();
  return (
    <div>
      <PageTitle sub="Guests sign in with email links (no password). Partners and admins use passwords.">Users</PageTitle>
      <Table head={["Email", "Name", "Role", "Verified", "Bookings", "Joined", ""]}>
        {rows.map(({ u, bookings }) => (
          <tr key={u.id} className={`hover:bg-paper ${u.disabledAt ? "opacity-60" : ""}`}>
            <td className="px-3 py-2">{u.email}</td>
            <td className="px-3 py-2">{u.name || "—"}</td>
            <td className="px-3 py-2"><Badge tone={u.role === "head_admin" ? "info" : u.role === "partner" ? "ok" : "muted"}>{u.role}</Badge></td>
            <td className="px-3 py-2 text-xs">{u.emailVerifiedAt ? "✓" : "—"}</td>
            <td className="px-3 py-2">{bookings}</td>
            <td className="px-3 py-2 text-xs">{fmtDate(u.createdAt)}</td>
            <td className="px-3 py-2">
              {u.id !== me?.id && (
                <form action={setUserDisabled}>
                  <input type="hidden" name="userId" value={u.id} />
                  <Btn tone={u.disabledAt ? "default" : "danger"} name="disabled" value={u.disabledAt ? "0" : "1"}>{u.disabledAt ? "Enable" : "Disable"}</Btn>
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="font-semibold mt-8 mb-2">Audit log</h2>
      <Table head={["When", "Actor", "Action", "Target", "Detail"]}>
        {audit.map((a) => (
          <tr key={a.id}><td className="px-3 py-1.5 text-xs">{fmtDate(a.createdAt)}</td><td className="px-3 py-1.5 text-xs font-mono">{a.actorId ?? "—"}</td><td className="px-3 py-1.5 text-xs">{a.action}</td><td className="px-3 py-1.5 text-xs font-mono">{a.target}</td><td className="px-3 py-1.5 text-xs text-muted">{a.detail}</td></tr>
        ))}
      </Table>
    </div>
  );
}
