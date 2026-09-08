import { redirect } from "next/navigation";
import PasswordLoginForm from "@/components/PasswordLoginForm";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

export default async function AdminLogin() {
  const user = await getCurrentUser();
  if (user?.role === "head_admin") redirect("/admin");
  return (
    <div className="max-w-sm mx-auto px-4 pt-16">
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white font-bold">宿</span>
        <span className="font-semibold text-lg">Yado Admin</span>
      </div>
      <PasswordLoginForm locale="en" dict={getDictionary("en")} title="Head admin sign-in" next="/admin" forgotHref="/en/partner/reset" />
      <p className="text-xs text-muted mt-4">Admin accounts are created with <code>npm run seed</code>. Partner accounts cannot sign in here.</p>
    </div>
  );
}
