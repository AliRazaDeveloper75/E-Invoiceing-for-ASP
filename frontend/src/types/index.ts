// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'admin' | 'supplier' | 'accountant' | 'viewer' | 'inbound_supplier';
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: string;
  full_name: string;
}

// ─── Company ──────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  legal_name: string;
  trn: string;
  tin: string;
  is_vat_group: boolean;
  street_address: string;
  city: string;
  emirate: string;
  po_box: string;
  country: string;
  formatted_address: string;
  phone: string;
  email: string;
  website: string;
  peppol_endpoint: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  role: 'admin' | 'supplier' | 'accountant' | 'viewer' | 'inbound_supplier';
  is_active: boolean;
  created_at: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  company: string;
  name: string;
  legal_name: string;
  customer_type: 'b2b' | 'b2g' | 'b2c';
  trn: string;
  tin: string;
  vat_number: string;
  peppol_endpoint: string;
  street_address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'draft'
  | 'pending'
  | 'submitted'
  | 'validated'
  | 'rejected'
  | 'cancelled'
  | 'paid';

export type InvoiceType = 'tax_invoice' | 'simplified' | 'credit_note' | 'commercial_invoice' | 'continuous_supply';
export type TransactionType = 'b2b' | 'b2g' | 'b2c';
export type VATRateType = 'standard' | 'zero' | 'exempt' | 'out_of_scope';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat_rate_type: VATRateType;
  vat_rate_type_display: string;
  vat_rate: string;
  subtotal: string;
  vat_amount: string;
  total_amount: string;
  sort_order: number;
  is_active: boolean;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  type_display: string;
  transaction_type: TransactionType;
  status: InvoiceStatus;
  status_display: string;
  company_name: string;
  company_trn: string;
  customer: string;
  customer_name: string;
  customer_trn: string;
  issue_date: string;
  due_date: string | null;
  supply_date: string | null;
  supply_date_end: string | null;
  contract_reference: string;
  currency: string;
  exchange_rate: string;
  subtotal: string;
  discount_amount: string;
  taxable_amount: string;
  total_vat: string;
  total_amount: string;
  reference_number: string;
  purchase_order_number: string;
  xml_file: string | null;
  xml_generated_at: string | null;
  asp_submission_id: string;
  asp_submitted_at: string | null;
  items: InvoiceItem[];
  item_count: number;
  is_editable: boolean;
  is_submittable: boolean;
  is_cancellable: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  type_display: string;
  status: InvoiceStatus;
  status_display: string;
  customer: string;
  customer_name: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  subtotal: string;
  total_vat: string;
  total_amount: string;
  item_count: number;
  has_xml: boolean;
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  company_id: string;
  company_name: string;
  total_invoices: number;
  status_breakdown: Partial<Record<InvoiceStatus, number>>;
  total_revenue: string;
  total_vat: string;
}

// ─── 5-Corner Flow / Timeline ────────────────────────────────────────────────

export type CornerFlowStatus = 'idle' | 'processing' | 'complete' | 'error';

export interface CornerFlowState {
  corner:      number;
  label:       string;
  sublabel:    string;
  description: string;
  status:      CornerFlowStatus;
  timestamp:   string;   // ISO 8601 or empty string
}

export interface TimelineEvent {
  type:        string;
  corner:      number;
  timestamp:   string;
  title:       string;
  description: string;
  status:      CornerFlowStatus;
  data:        Record<string, unknown>;
}

export interface InvoiceTimeline {
  invoice_id:     string;
  invoice_number: string;
  current_status: string;
  flow:           CornerFlowState[];
  events:         TimelineEvent[];
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface APISuccess<T> {
  success: true;
  message?: string;
  data: T;
}

export interface APIPaginated<T> {
  success: true;
  pagination: {
    count: number;
    total_pages: number;
    current_page: number;
    next: string | null;
    previous: string | null;
  };
  results: T[];
}

export interface APIError {
  success: false;
  error: {
    code: number;
    message: string;
    details?: Record<string, string[]>;
  };
}
