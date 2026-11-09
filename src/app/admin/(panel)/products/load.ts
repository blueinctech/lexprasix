import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { pickedMedia, toLagosInput } from "@/lib/admin/editing";
import { resolveMediaInHtml } from "@/lib/content/queries";
import type { ProductEditorData } from "@/components/admin/ProductEditor";

export async function loadProduct(id: string): Promise<ProductEditorData | null> {
  const db = await getDb();
  const [row] = await db.select().from(products).where(eq(products.id, id));
  if (!row) return null;
  const media = await pickedMedia([row.featuredImageId, row.seo.ogImageId]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: resolveMediaInHtml(row.body),
    priceLabel: row.priceLabel,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    format: row.format,
    buyUrl: row.buyUrl,
    buyLabel: row.buyLabel,
    status: row.status,
    publishedAtInput: toLagosInput(row.publishedAt),
    featuredImage: media.get(row.featuredImageId ?? "") ?? null,
    ogImage: media.get(row.seo.ogImageId ?? "") ?? null,
    seo: row.seo,
  };
}
