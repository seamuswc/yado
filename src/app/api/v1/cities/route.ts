import { apiJson } from "@/lib/api-http";
import { cities } from "@/lib/hotels-shared";

export const dynamic = "force-dynamic";

export function GET() {
  return apiJson({
    cities: cities.map((c) => ({ id: c.id, name: c.name })),
  });
}
