import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-5xl mb-4">🗺️</p>
      <h1 className="text-xl font-semibold mb-2">Page not found / ページが見つかりません</h1>
      <Link href="/" className="text-primary underline">Home / ホーム</Link>
    </div>
  );
}
