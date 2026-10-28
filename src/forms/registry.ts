import type { FormDefinition } from "./types";
import applicationForTaxClearanceCertificate from "./definitions/application-for-tax-clearance-certificate.json";
import businessNameRegistration from "./definitions/business-name-registration.json";
import companyRegistration from "./definitions/company-registration.json";
import companySeal from "./definitions/company-seal.json";
import companyStamp from "./definitions/company-stamp.json";
import copyrightRegistration from "./definitions/copyright-registration.json";
import deedOfAssignment from "./definitions/deed-of-assignment.json";
import employmentContract from "./definitions/employment-contract.json";
import hirePurchaseAgreement from "./definitions/hire-purchase-agreement.json";
import incorporatedTrustee from "./definitions/incorporated-trustee.json";
import independentContractorsAgreement from "./definitions/independent-contractors-agreement.json";
import leaseAgreement from "./definitions/lease-agreement.json";
import letterOfConfirmation from "./definitions/letter-of-confirmation.json";
import loanAgreement from "./definitions/loan-agreement.json";
import nonDisclosureAgreements from "./definitions/non-disclosure-agreements.json";
import noticeOfRentIncrease from "./definitions/notice-of-rent-increase.json";
import partnershipAgreement from "./definitions/partnership-agreement.json";
import powerOfAttorney from "./definitions/power-of-attorney.json";
import resolutionOfBoardOfDirectors from "./definitions/resolution-of-board-of-directors.json";
import tenancyAgreement from "./definitions/tenancy-agreement.json";
import trademarkAssignment from "./definitions/trademark-assignment.json";
import trademarkRegistration from "./definitions/trademark-registration.json";
import usCompanyRegistration from "./definitions/us-company-registration.json";

// All forms on the site. Document forms are generated from the old Gravity
// Forms (scripts/build-form-definitions.mjs); contact and newsletter are defined here.

const contact: FormDefinition = {
  id: "contact",
  title: "Contact",
  kind: "contact",
  submitLabel: "Send message",
  successMessage: "Thank you for getting in touch. A member of our team will reply within one business day.",
  legacy: { engine: "contact-form-7", id: 930 },
  steps: [
    {
      title: "Your message",
      items: [
        { kind: "field", id: "name", type: "text", label: "Full name", required: true, role: "name", width: "half" },
        { kind: "field", id: "email", type: "email", label: "Email address", required: true, role: "email", width: "half" },
        { kind: "field", id: "phone", type: "tel", label: "Phone number", required: true, role: "phone", width: "half" },
        {
          kind: "field",
          id: "topic",
          type: "select",
          label: "What do you need help with?",
          required: false,
          width: "half",
          choices: [
            "Company formation (Nigeria)",
            "Company formation (international)",
            "Legal service subscription",
            "Tax registration and compliance",
            "Intellectual property",
            "Licences and permits",
            "Contracts and agreements",
            "Funding and investor due diligence",
            "Non-profits and charities",
            "Real estate",
            "Data protection",
            "Something else",
          ],
        },
        { kind: "field", id: "message", type: "textarea", label: "Your message", required: true, width: "full", placeholder: "Briefly describe your business and what you need." },
      ],
    },
  ],
};

const newsletter: FormDefinition = {
  id: "newsletter",
  title: "Newsletter sign-up",
  kind: "newsletter",
  submitLabel: "Subscribe",
  successMessage: "You're subscribed. Thank you!",
  steps: [{ title: "Subscribe", items: [{ kind: "field", id: "email", type: "email", label: "Email address", required: true, role: "email" }] }],
};


// Generated definitions, one per legal-document page.
const documents = [
  applicationForTaxClearanceCertificate, businessNameRegistration, companyRegistration, companySeal, companyStamp, copyrightRegistration,
  deedOfAssignment, employmentContract, hirePurchaseAgreement, incorporatedTrustee, independentContractorsAgreement, leaseAgreement,
  letterOfConfirmation, loanAgreement, nonDisclosureAgreements, noticeOfRentIncrease, partnershipAgreement, powerOfAttorney,
  resolutionOfBoardOfDirectors, tenancyAgreement, trademarkAssignment, trademarkRegistration, usCompanyRegistration,
] as unknown as FormDefinition[];

const FORMS = new Map<string, FormDefinition>([contact, newsletter, ...documents].map((f) => [f.id, f]));

export function getFormDefinition(id: string): FormDefinition | null {
  return FORMS.get(id) ?? null;
}

export function allForms(): FormDefinition[] {
  return [...FORMS.values()];
}
