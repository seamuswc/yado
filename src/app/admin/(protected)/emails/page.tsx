import { requireAdminPage } from "@/lib/auth";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Badge, PageTitle, Table, fmtDate } from "@/components/admin/ui";

export default async function EmailsPage() {
  await requireAdminPage();
  const rows = db.select().from(schema.emails).orderBy(desc(schema.emails.createdAt)).limit(200).all();
  const configured = !!process.env.RESEND_API_KEY;
  return (
    <div>
      <PageTitle sub={configured ? "Sent through Resend." : "No email provider configured (RESEND_API_KEY). Emails are recorded here instead of being sent, so you can open sign-in and verification links from this page during testing."}>Email outbox</PageTitle>
      <Table head={["When", "To", "Subject", "Status", "Body"]}>
        {rows.map((e) => (
          <tr key={e.id} className="align-top hover:bg-paper">
            <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(e.createdAt)}</td>
            <td className="px-3 py-2 text-xs">{e.to}</td>
            <td className="px-3 py-2">{e.subject}</td>
            <td className="px-3 py-2"><Badge tone={e.status === "sent" ? "ok" : e.status.startsWith("failed") ? "bad" : "muted"}>{e.provider}: {e.status}</Badge></td>
            <td className="px-3 py-2 text-xs whitespace-pre-line max-w-lg">{linkify(e.body)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} className="text-primary underline break-all">{p}</a> : <span key={i}>{p}</span>));
}
