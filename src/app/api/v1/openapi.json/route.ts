import { apiJson } from "@/lib/api-http";
import { openApiDocument } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export function GET() {
  return apiJson(openApiDocument());
}
