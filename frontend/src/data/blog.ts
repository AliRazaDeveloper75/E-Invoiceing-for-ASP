export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  readTime: string;
  tag: string;
  image?: string;
}

export const POSTS: BlogPost[] = [
  {
    slug: 'uae-e-invoicing-phase-1',
    title: 'UAE E-Invoicing Phase 1: Everything You Need to Know',
    excerpt: 'Phase 1 of the UAE mandatory e-invoicing framework goes live in 2026. Here is what businesses need to prepare for compliance.',
    content: `The UAE is about to embark on a new era of tax compliance. The Federal Tax Authority (FTA) and Ministry of Finance are implementing a compulsory e-invoicing system which will forever change the way businesses generate, send and keep their invoices.

## What Is the UAE E-Invoicing Framework?

The UAE e-invoicing system mandates that all VAT-registered entities must create invoices in a structured electronic format (XML/JSON based on UBL) and not as PDF, scan or paper.

Not only will invoices flow between businesses, but they will be sent through Accredited Service Providers (ASPs), using a five-corner data exchange model, and transaction data will be reported to the FTA in near real-time.

This places the UAE on a par with Saudi Arabia, the EU and other jurisdictions that have adopted continuous transaction controls, and is based on Ministerial Decisions No. 243 and No. 244 of 2025.

## Important Dates and Timeline

The rollout is phased — there is no single rollout date, and the schedule has already been changed once, so it is worth keeping a close eye on the timeline:

- **Pilot phase — July 1, 2026**: The Ministry of Finance will reach out to a number of taxpayers to participate in the pilot and confirm their participation in writing. All businesses are eligible to voluntarily opt in from this date.
- **Phase 1 — large businesses (revenue ≥ AED 50M)**: The deadline for appointment of the ASP has been extended to October 30, 2026 (from July 31, 2026 as previously announced). The mandatory go-live date remains unchanged at January 1, 2027.
- **Phase 2 — mid-size businesses (AED 20M to 50M)**: The appointment of the ASP is due no later than January 31, 2027, with mandatory go-live required from July 1, 2027.
- **Phase 3 — smaller businesses**: April 30, 2027 deadline for ASP appointment, with mandatory appointment required from October 1, 2027.

There is an important difference — the appointment deadline (choosing and onboarding an ASP) is much earlier than the required go-live date. When these are considered synonymous, businesses tend to run out of runway.

## Who Is Affected?

The first phase applies to business-to-business (B2B) and business-to-government (B2G) transactions:

- Companies of all sizes, including VAT-registered, mainland and free zone entities
- Government entities (on their own phased timeline)

Business-to-consumer (B2C) invoices are not included in the current phase and will be rolled out in the next phase, if one is announced.

## Why It Matters Beyond Compliance

It's not just a regulatory tick. Structured and automated invoicing will reduce the cost of invoicing by about 66–80%, and near real-time reporting will enhance fraud detection, audit preparedness and cash flow visibility. For businesses that are still using paper or PDF invoices, it is also a natural catalyst to clean up master data — TRNs, addresses, buyers and years of minor inconsistencies.

## What Do You Need to Do Now?

1. **Verify your phase** — Match your audited revenue with any of the above ranges. Any entity operating in the vicinity of the AED 50M line should verify their figure with their accountant now, as there is little time left before they cross the line.
2. **Review the current invoicing system** — Check if it can be optimized within your ERP or invoicing system, or if a new platform is required.
3. **Choose and designate an ASP** — Being pre-approved is not an indicator of being accredited by the FTA under Article 16.
4. **Get your data and team ready** — Before go-live, clean up master data and train finance and accounting teams on this new structured-invoice workflow.
5. **Test end-to-end** — Conduct sandbox and parallel testing to ensure that invoices are generated, sent and acknowledged properly before going live.

## How E-Numerak Can Help

Designed from the ground up with UAE FTA compliance in mind, E-Numerak automates structured invoice generation, prepares them for ASP transmission and addresses the technical requirements of the e-invoice mandate — allowing your team to concentrate on your business, not the plumbing.`,
    date: 'Jul 15, 2026',
    readTime: '5 min read',
    tag: 'Compliance',
  },
  {
    slug: '5-corner-model-e-invoicing',
    title: 'Understanding the 5-Corner Model for E-Invoicing',
    excerpt: 'A deep dive into the 5-corner model that powers UAE\'s e-invoicing network — and where your business fits in.',
    content: `The UAE's e-invoicing framework is not simply a PDF-to-XML conversion; it is a completely new approach to the movement of invoice data, referred to as the 5-Corner Model. For any business seeking compliance, it's not an option — it's the foundation upon which all other work with your ASP, integration, reporting, and more rests.

## What Is the 5-Corner Model?

The UAE's structured approach to the secure exchange, validation and reporting of e-invoices in accordance with the UAE FTA mandate is known as the 5-Corner Model, based on the globally recognised Peppol network and a decentralised continuous transaction control and exchange (DCTCE) approach. Invoices don't travel directly between businesses or straight to the government. Instead, accredited service providers (ASPs) serve as intermediaries that validate, standardise and securely send invoice information between trading partners and the tax authority.

It's a good design decision. In countries such as Italy, all invoices are channeled through a single central government point — a "closed loop" in which the entire system can come to a standstill if the central server fails. The UAE's hybrid strategy, however, focuses on government oversight and business continuity, spreading the workload across a network of certified providers instead of one central choke point.

## The Five Corners

### Corner 1: Seller (Supplier)

The seller creates the invoice in their own ERP, accounting or billing system. Critical: this must be in a structured digital format, not just a PDF, and generated in accordance with the PINT-AE data dictionary (the UAE's version of Peppol International's invoice data dictionary).

### Corner 2: Seller's ASP

The invoice data is then sent to the seller's Accredited Service Provider — the seller's access point to the network. The ASP processes the raw data, maps it to the required PINT-AE (UBL/XML) format and securely transmits it. This is where E-Numerak comes in — to handle the formatting, validation and transmission for the seller.

### Corner 3: Buyer's ASP

The verified information is handed over to the purchaser's Accredited Service Provider — either the same platform the seller uses or a different one. Both sides have certified, Peppol-supported access points, meaning company ERPs can exchange invoices without the need for custom, one-off integrations between each trading partner.

### Corner 4: Buyer

Unlike manually rekeying numbers from a PDF, the buyer receives the structured data directly into their finance system to process and pay automatically without leaving the system.

### Corner 5: The FTA Platform

While the commercial transaction between seller and buyer takes place, the ASPs forward the transaction details to the FTA platform. The FTA stores and validates this data and sends confirmation back up the ASP chain to the seller in Message Level Status (MLS) confirmations. That's what makes this model different from a typical 4-corner Peppol model: the FTA becomes the fifth corner, enabling real-time reporting of the transaction on top of the exchange of the invoice itself — without the need for a central clearance corner.

## Why It Matters

The model is not only for compliance; it's designed to fill the voids left by traditional invoicing. It is specifically aimed at enhancing security, minimising fraud, restricting access to important information and directing and processing invoices appropriately with controlled information flow. For your business, knowing it means:

- As the seller, you know what's important: you're now responsible for Corner 1 (compliant data) and Corner 2 (who will do it for you).
- You're not just selecting a vendor; you're selecting the organisation that will handle format compliance, secure transmission and FTA reporting for you.
- If something fails, understanding the flow (reported in parallel and not as a single blocking step) means you can trace the failure back to a particular corner instead of the whole system being a black box.`,
    date: 'Jul 8, 2026',
    readTime: '7 min read',
    tag: 'Technology',
  },
  {
    slug: 'vat-vs-excise-tax-key-differences',
    title: 'VAT vs Excise Tax: Key Differences for UAE Businesses',
    excerpt: 'Understand the distinction between VAT and Excise Tax reporting requirements under UAE FTA regulations.',
    content: `Both VAT and Excise Tax fall under the Federal Tax Authority umbrella, and it's easy to lump them together and call them "just another FTA obligation." They are, however, different taxes — different purpose, different rates, different compliance periods. This distinction is important because, at least in some cases, businesses could be liable for both at different times.

## What Is VAT?

Value Added Tax (VAT) is a broad-based consumption tax levied at every stage of the supply chain, from the point of production onwards, on the supply of most goods and services. The UAE has one of the lowest VAT rates globally at 5%, and it is levied on the vast majority of goods, services and supplies, except for certain exemptions and zero-rated items.

## What Is Excise Tax?

Excise Tax is different. It is not levied on all products and services as is the case with VAT, but is a targeted tax — an attempt at correction — levied on a specific, limited range of products that the government deems harmful to public health and/or the environment. This is sometimes referred to among economists as a "sin tax": not only is revenue sought but behaviour is also targeted, making harmful products more expensive than healthier or more sustainable alternatives.

This also means Excise Tax is much more flexible than VAT. The categories and rates are not fixed; they depend on changes in public health policy, and occasionally the classification of specific products and/or the rates change — from a fixed percentage of consumption to more detailed composition-based structures — as priorities shift. It is probably easier for businesses to comply with excise than with VAT, but it is not as "set and forgotten" as VAT, and certainly a category to watch.

## Key Differences

### Tax Base
VAT is wide-ranging and is levied on almost all goods and services. Excise Tax is focused: it only applies to products that are targeted as harmful.

### Rate Structure
VAT is 5% throughout the UAE. Excise Tax rates range widely by product type and may be tiered (as opposed to flat) according to the product's composition.

### Filing Frequency
VAT returns are normally submitted on a quarterly basis, although in some cases the FTA may ask for returns to be submitted monthly, depending on the risk profile and/or turnover of the business. Excise Tax returns, however, must be filed monthly by all registrants — excise goods are higher-risk, higher-scrutiny items.

### Record-Keeping
The data is markedly different, both in content and in form, though both require rigid, audit-ready records. The focus of VAT record-keeping is transaction value and input/output tax. Excise Tax record-keeping tends to be more product-specific than transaction-specific, because the applicable rate may be based on particular characteristics of the product.

## Compliance Requirements

Businesses responsible for both taxes must keep them distinct in accounting records, registration and tax returns — they are not the same tax. And since excise categories and rates change more frequently than VAT, it is also important to proactively keep track of FTA changes rather than relying on the assumption that what happened last year will happen again this year.

E-Numerak's platform natively supports both types of tax and offers dedicated reporting modules for VAT (quarterly) and Excise Tax (monthly) — even tracking product classification level, which is increasingly required for Excise Tax compliance.`,

    date: 'Jun 28, 2026',
    readTime: '4 min read',
    tag: 'Tax',
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(current: BlogPost, count = 2): BlogPost[] {
  return POSTS
    .filter((p) => p.slug !== current.slug && p.tag === current.tag)
    .slice(0, count);
}
