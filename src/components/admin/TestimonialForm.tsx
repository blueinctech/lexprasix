import { deleteTestimonial, saveTestimonial } from "@/app/admin/_actions/testimonials";
import { ActionForm, Card, Checkbox, Select, SubmitButton, TextArea, TextInput } from "./ui";

export type TestimonialData = { id: string | null; name: string; role: string; quote: string; source: string; sourceUrl: string; featured: boolean; status: string };

export function TestimonialForm({ t }: { t: TestimonialData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <Card>
        <ActionForm action={saveTestimonial}>
          {t.id && <input type="hidden" name="id" value={t.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Client name" name="name" defaultValue={t.name} required maxLength={120} />
            <TextInput label="Role / company" name="role" defaultValue={t.role} maxLength={120} placeholder="Founder, Flourish Her Africa" />
          </div>
          <TextArea label="Testimonial" name="quote" defaultValue={t.quote} rows={6} required maxLength={2000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Where it was given"
              name="source"
              defaultValue={t.source}
              options={[
                { value: "website", label: "Directly to the firm" },
                { value: "google", label: "Google review" },
                { value: "linkedin", label: "LinkedIn" },
                { value: "email", label: "Email" },
                { value: "other", label: "Other" },
              ]}
            />
            <TextInput label="Link to the original (optional)" name="sourceUrl" type="url" defaultValue={t.sourceUrl} placeholder="https://…" />
          </div>
          <Select label="Status" name="status" defaultValue={t.status === "published" ? "published" : "draft"} options={[{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published" }]} />
          <Checkbox name="featured" label="Feature on the homepage" defaultChecked={t.featured} />
          <div>
            <SubmitButton>{t.id ? "Save changes" : "Create testimonial"}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      {t.id && (
        <div className="content-start">
          <Card title="Delete">
            <ActionForm action={deleteTestimonial}>
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this testimonial?">
                Delete testimonial
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}
    </div>
  );
}
