import { apiJson } from "@/lib/api-http";
import { APP_URL } from "@/lib/email";
import { openApiDocument } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export function GET() {
  return apiJson(openApiDocument(APP_URL));
}
