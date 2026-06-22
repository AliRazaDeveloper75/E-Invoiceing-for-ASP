# Database ER Diagram

**Document:** E-Numerak — Entity Relationship Diagram (core data model)
**Service Provider:** AL MERAK TAX CONSULTANT L.L.C
**Date:** 2026-06-20

---

## 1. In simple words

This diagram shows **what information the system stores and how it is linked**.

- A **Company** (the seller/business) has **users**, **customers**, **products**,
  and the **invoices** it sends.
- Each **Invoice** belongs to one company and one customer, and has many
  **line items**, an **audit trail**, and an optional **fraud check**.
- For invoices **received** from other businesses, a **Supplier** sends an
  **Inbound Invoice** to a receiving company.

Only the **core** tables are shown for clarity (the platform has more supporting
tables for auth tokens, reporting, etc.).

---

## 2. Identity & Outbound (Sales) data model

How users, companies, customers, products and **outgoing invoices** relate.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Segoe UI, Arial, sans-serif","primaryColor":"#0b4f8a","primaryTextColor":"#ffffff","primaryBorderColor":"#0b4f8a","lineColor":"#5a7fa3","textColor":"#1a1a1a","attributeBackgroundColorOdd":"#ffffff","attributeBackgroundColorEven":"#eef4fa"},"er":{"useMaxWidth":true,"diagramPadding":14,"entityPadding":12,"minEntityWidth":150,"fontSize":13,"stroke":"#0b4f8a"}}}%%
erDiagram
    USER ||--o{ COMPANY_MEMBER : "belongs to"
    COMPANY ||--o{ COMPANY_MEMBER : "has"
    COMPANY ||--o{ CUSTOMER : "has"
    COMPANY ||--o{ PRODUCT : "owns"
    COMPANY ||--o{ INVOICE : "issues"
    CUSTOMER ||--o{ INVOICE : "billed on"
    USER ||--o{ INVOICE : "created"
    INVOICE ||--o{ INVOICE_ITEM : "contains"
    INVOICE ||--o{ INVOICE_AUDIT_LOG : "tracked by"
    INVOICE ||--o| INVOICE_FRAUD_ALERT : "checked by"

    USER {
        uuid id PK
        string email
        string role
        bool is_active
    }
    COMPANY {
        uuid id PK
        string name
        string legal_name
        string trn "VAT TRN"
        string tin "Tax ID"
        string emirate
        string legal_registration_id
    }
    COMPANY_MEMBER {
        uuid id PK
        uuid company_id FK
        uuid user_id FK
        string role
    }
    CUSTOMER {
        uuid id PK
        uuid company_id FK
        string name
        string customer_type
        string trn
        string peppol_endpoint
        string country
    }
    PRODUCT {
        uuid id PK
        uuid company_id FK
        string name
        decimal unit_price
        decimal vat_rate
    }
    INVOICE {
        uuid id PK
        uuid company_id FK
        uuid customer_id FK
        uuid created_by FK
        string invoice_number
        string invoice_type
        string status
        date issue_date
        string currency
        decimal total_amount
    }
    INVOICE_ITEM {
        uuid id PK
        uuid invoice_id FK
        string item_name
        decimal quantity
        decimal unit_price
        decimal vat_rate
        decimal total_amount
    }
    INVOICE_AUDIT_LOG {
        uuid id PK
        uuid invoice_id FK
        uuid performed_by FK
        string action
        datetime created_at
    }
    INVOICE_FRAUD_ALERT {
        uuid id PK
        uuid invoice_id FK
        string risk_level
        uuid resolved_by FK
    }
```

---

## 3. Inbound (Purchase) data model

How **suppliers** and **received invoices** relate to the receiving company.

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"Segoe UI, Arial, sans-serif","primaryColor":"#0b4f8a","primaryTextColor":"#ffffff","primaryBorderColor":"#0b4f8a","lineColor":"#5a7fa3","textColor":"#1a1a1a","attributeBackgroundColorOdd":"#ffffff","attributeBackgroundColorEven":"#eef4fa"},"er":{"useMaxWidth":true,"diagramPadding":14,"entityPadding":12,"minEntityWidth":160,"fontSize":13,"stroke":"#0b4f8a"}}}%%
erDiagram
    COMPANY ||--o{ SUPPLIER : "registers"
    USER ||--o| SUPPLIER : "is"
    SUPPLIER ||--o{ INBOUND_INVOICE : "sends"
    COMPANY ||--o{ INBOUND_INVOICE : "receives"
    INBOUND_INVOICE ||--o{ INBOUND_INVOICE_ITEM : "contains"
    INBOUND_INVOICE ||--o{ INBOUND_OBSERVATION : "has"
    INBOUND_INVOICE ||--o{ INBOUND_AUDIT_LOG : "tracked by"

    COMPANY {
        uuid id PK
        string name
        string trn "VAT TRN"
    }
    USER {
        uuid id PK
        string email
        string role
    }
    SUPPLIER {
        uuid id PK
        uuid user_id FK
        uuid receiving_company_id FK
        string name
        string trn
        string api_key_prefix
    }
    INBOUND_INVOICE {
        uuid id PK
        uuid supplier_id FK
        uuid receiving_company_id FK
        string channel
        string status
        string supplier_invoice_number
        date issue_date
        decimal total_amount
    }
    INBOUND_INVOICE_ITEM {
        uuid id PK
        uuid invoice_id FK
        string item_name
        decimal quantity
        decimal total_amount
    }
    INBOUND_OBSERVATION {
        uuid id PK
        uuid invoice_id FK
        string type
        string message
    }
    INBOUND_AUDIT_LOG {
        uuid id PK
        uuid invoice_id FK
        uuid actor FK
        string action
    }
```

---

## 4. Relationship legend

| Symbol | Meaning |
|--------|---------|
| `||--o{` | one-to-many (e.g. one Company → many Invoices) |
| `||--o|` | one-to-one / optional (e.g. one Invoice → at most one Fraud Alert) |
| `PK` | primary key (UUID) |
| `FK` | foreign key (link to another table) |

---

## 5. Key relationships in plain terms

- **User ↔ Company** is many-to-many through **Company Member** (a user can belong
  to several companies; a company can have several users, each with a role).
- **Outbound side:** Company → Customer → **Invoice** → Invoice Items
  (+ audit log + optional fraud alert).
- **Inbound side:** a **Supplier** (linked to a login user) sends an
  **Inbound Invoice** to a receiving Company, with its own items, observations and
  audit log.
- All primary keys are **UUIDs**; money fields use exact **decimal** values
  (no floating-point rounding).
