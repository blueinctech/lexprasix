"use client";

import { deleteProduct, saveProduct } from "@/app/admin/_actions/products";
import type { SeoFields } from "@/db/schema";
import { SeoPanel, StatusFields, TitleSlugFields } from "./EditorFields";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { ActionForm, btn, Card, SubmitButton, TextArea, TextInput } from "./ui";

export type ProductEditorData = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  body: string;
  priceLabel: string;
  priceAmount: string;
  priceCurrency: string;
  format: string;
  buyUrl: string;
  buyLabel: string;
  status: string;
  publishedAtInput: string;
  featuredImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  seo: SeoFields;
};

export function ProductEditor({ product }: { product: ProductEditorData }) {
  const livePath = `/product/${product.slug}/`;
  return (
    <div className="grid gap-6">
      <ActionForm action={saveProduct}>
        {product.id && <input type="hidden" name="id" value={product.id} />}
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <div className="grid gap-5">
                <TitleSlugFields initialTitle={product.title} initialSlug={product.slug} prefix="lexpraxisng.com/product/" />
                <TextArea label="Summary" name="summary" defaultValue={product.summary} rows={3} maxLength={600} hint="One or two sentences shown on the shop page and next to the cover." />
                <RichTextEditor name="body" initialHtml={product.body} label="Description" />
              </div>
            </Card>
            <Card title="Price and payment">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Price shown" name="priceLabel" defaultValue={product.priceLabel} maxLength={60} placeholder="₦5,000" hint="As visitors should see it. Leave empty to show “Price on request”." />
                <TextInput label="Format" name="format" defaultValue={product.format} maxLength={80} placeholder="eBook (PDF)" />
                <TextInput label="Price for search engines (optional)" name="priceAmount" defaultValue={product.priceAmount} maxLength={20} inputMode="decimal" placeholder="5000" hint="Number only. Lets Google show the price; used only when “Price shown” is filled in." />
                <TextInput label="Currency code" name="priceCurrency" defaultValue={product.priceCurrency} maxLength={3} placeholder="NGN" />
                <TextInput
                  label="Buy link"
                  name="buyUrl"
                  type="url"
                  defaultValue={product.buyUrl}
                  maxLength={500}
                  placeholder="https://paystack.com/pay/…"
                  className="sm:col-span-2"
                  hint="Paste a payment/checkout link, e.g. a Paystack or Selar payment page. Leave empty and the page shows an order request form instead (requests arrive in Enquiries)."
                />
                <TextInput label="Buy button text" name="buyLabel" defaultValue={product.buyLabel} maxLength={40} placeholder="Buy now" hint="Used only with a buy link." />
              </div>
            </Card>
            <SeoPanel seo={product.seo} defaultTitle={`${product.title || "Product"} - Lexpraxis Solicitors`} defaultDescription={product.summary || "The product summary is used."} path={`/product/${product.slug || "…"}/`} ogImage={product.ogImage} />
          </div>
          <div className="grid content-start gap-6">
            <StatusFields status={product.status} publishedAtInput={product.publishedAtInput} canPublish />
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{product.id ? "Save changes" : "Create product"}</SubmitButton>
              {product.id && product.status === "published" && (
                <a href={livePath} target="_blank" rel="noopener" className={btn("secondary")}>
                  View on site
                </a>
              )}
            </div>
            <Card title="Cover image">
              <MediaField name="featuredImageId" label="Featured image" initial={product.featuredImage} />
            </Card>
          </div>
        </div>
      </ActionForm>
      {product.id && (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid content-start gap-6 xl:col-start-2">
            <Card title="Danger zone">
              <ActionForm action={deleteProduct}>
                <input type="hidden" name="id" value={product.id} />
                <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this product permanently? Consider unpublishing instead.">
                  Delete product
                </SubmitButton>
              </ActionForm>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
