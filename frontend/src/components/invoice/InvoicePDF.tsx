/**
 * InvoicePDF v4 — Premium UAE Tax Invoice with logos
 *
 * react-pdf constraints:
 *  • NO gap / rowGap / columnGap  — use marginRight on siblings
 *  • NO flex:1 on page body       — blank-page-1 bug
 *  • NO border shorthand          — per-side only
 *  • NO gradients                 — solid colors only
 *  • Image src must be absolute URL or data URI
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Company, Invoice } from '@/types'

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  brand:    '#1a3050',
  brandDk:  '#0f1e33',
  brandLt:  '#243d63',
  brandBd:  '#2a4878',
  brandTint:'#eef2f8',

  teal:     '#0d9488',
  tealTint: '#f0fdfa',

  ink:   '#111827',
  n800:  '#1f2937',
  n700:  '#374151',
  n600:  '#4b5563',
  n500:  '#6b7280',
  n400:  '#9ca3af',
  n300:  '#d1d5db',
  n200:  '#e5e7eb',
  n100:  '#f3f4f6',
  n50:   '#f9fafb',
  white: '#ffffff',

  okBg: '#ecfdf5', okFg: '#065f46',
  erBg: '#fef2f2', erFg: '#991b1b',
  waBg: '#fffbeb', waFg: '#92400e',
  blBg: '#eff6ff', blFg: '#1d4ed8',
  muBg: '#f3f4f6', muFg: '#4b5563',

  red:  '#dc2626',
  blue: '#1d4ed8',
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.ink,
    backgroundColor: C.white,
  },

  topBar: { height: 4, backgroundColor: C.brand },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.n200,
    backgroundColor: C.white,
  },
  hdrLeft:  { flex: 1, paddingRight: 20 },
  hdrRight: { width: 185, alignItems: 'flex-end' },

  // Supplier logo / mark
  coLogoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  coLogoImg: {
    width: 48, height: 48,
    borderRadius: 6,
    objectFit: 'contain',
    marginRight: 12,
    backgroundColor: C.n50,
    borderWidth: 1,
    borderColor: C.n200,
  },
  coMark: {
    width: 48, height: 48,
    backgroundColor: C.brand,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  coMarkLetter: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.white },

  coNameBlock: { flex: 1, justifyContent: 'center' },
  coName:      { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 2 },
  coLegal:     { fontSize: 7, color: C.n500 },

  coInfoRow:    { flexDirection: 'row', marginTop: 3 },
  coInfoKey:    { width: 38, fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.4 },
  coInfoVal:    { flex: 1, fontSize: 7, color: C.n600 },

  // Right column: invoice identity
  invTypeLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 1.5, marginBottom: 4 },
  invTitle:     { fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 1.5, marginBottom: 2 },
  invNum:       { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 10 },

  badge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 3, marginBottom: 10 },
  badgeTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  amtLbl: { fontSize: 6, color: C.n400, marginBottom: 2, letterSpacing: 0.3 },
  amtVal: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.brand },
  amtCur: { fontSize: 9, color: C.n500, marginTop: 1 },

  // ── Date strip ────────────────────────────────────────────────────────────
  strip: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: C.n50,
  },
  stripCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderRightWidth: 1,
    borderRightColor: C.n200,
  },
  stripCellLast: { borderRightWidth: 0 },
  stripKey: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.7, marginBottom: 3 },
  stripVal: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink },

  // ── Credit note banner ────────────────────────────────────────────────────
  crBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 30,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 7,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
    borderRadius: 4,
  },
  crLbl: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#c2410c', marginRight: 5 },
  crVal: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9a3412' },

  // ── Party cards ───────────────────────────────────────────────────────────
  partiesRow: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginBottom: 14,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  partyCardLeft: { marginRight: 10 },

  partyHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.n200,
    borderLeftWidth: 3,
  },
  partyMark: {
    width: 22, height: 22,
    borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 7,
  },
  partyMarkTxt: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white },
  partyMarkImg: {
    width: 22, height: 22,
    borderRadius: 3,
    objectFit: 'contain',
    marginRight: 7,
    backgroundColor: C.white,
  },
  partyHdrLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.7 },

  partyBody:    { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 9 },
  partyName:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 1 },
  partyLegal:   { fontSize: 7, color: C.n500, marginBottom: 5 },
  partyAddr:    { fontSize: 7, color: C.n700, lineHeight: 1.5, marginBottom: 6 },
  partyTrnRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  partyTrnKey:  { width: 30, fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.3 },
  partyTrnVal:  { fontSize: 7.5, fontFamily: 'Courier', color: C.brand },
  partyContact: { fontSize: 6.5, color: C.n500, marginTop: 2 },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableWrap: {
    marginHorizontal: 30,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  thead: { flexDirection: 'row', backgroundColor: C.brand },
  th: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 0.5,
    borderRightWidth: 1,
    borderRightColor: C.brandBd,
  },
  thLast: { borderRightWidth: 0 },
  thR: { textAlign: 'right' },
  thC: { textAlign: 'center' },

  trow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.n100 },
  trowAlt:  { backgroundColor: C.n50 },
  trowLast: { borderBottomWidth: 0 },

  td: {
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 7,
    fontSize: 7.5,
    color: C.n700,
    borderRightWidth: 1,
    borderRightColor: C.n100,
    justifyContent: 'center',
  },
  tdLast: { borderRightWidth: 0 },
  tdR:    { alignItems: 'flex-end' },
  tdC:    { alignItems: 'center' },

  tdBold:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 1.5 },
  tdSub:   { fontSize: 7, color: C.n500 },
  tdNum:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.n800 },
  tdMuted: { fontSize: 7.5, color: C.n600 },
  tdTotal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.brand },
  tdIdx:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.n400 },

  vatPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2 },
  vatTxt:  { fontSize: 6, fontFamily: 'Helvetica-Bold' },

  // ── Totals ────────────────────────────────────────────────────────────────
  totOuter: { flexDirection: 'row', marginHorizontal: 30, marginBottom: 14 },
  totLeft:  { flex: 1, paddingRight: 12 },

  notesBox: {
    borderWidth: 1,
    borderColor: C.n200,
    borderLeftWidth: 3,
    borderLeftColor: C.n300,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 9,
    backgroundColor: C.n50,
  },
  notesLbl: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.7, marginBottom: 4 },
  notesTxt: { fontSize: 7, color: C.n700, lineHeight: 1.6 },

  totRight: {
    width: '50%',
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  totRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.n100 },
  totKey:    { flex: 1, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7, fontSize: 7.5, color: C.n500 },
  totVal:    { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right', minWidth: 95 },
  totRedKey: { color: C.red },
  totRedVal: { color: C.red },
  totBluKey: { color: C.blue },
  totBluVal: { color: C.blue },

  totGrand:    { flexDirection: 'row', backgroundColor: C.brand },
  totGrandKey: { flex: 1, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white },
  totGrandVal: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, textAlign: 'right', minWidth: 95 },

  totPaidRow: { flexDirection: 'row', backgroundColor: C.okBg },
  totPaidKey: { flex: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, fontSize: 7.5, color: C.okFg },
  totPaidVal: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.okFg, textAlign: 'right', minWidth: 95 },

  totBalRow: { flexDirection: 'row', backgroundColor: C.erBg },
  totBalKey: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.erFg },
  totBalVal: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.erFg, textAlign: 'right', minWidth: 95 },

  // ── QR + payment info bar ─────────────────────────────────────────────────
  infoBar: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  qrCell: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: C.brandTint,
    borderRightWidth: 1,
    borderRightColor: C.n200,
  },
  qrBox: {
    width: 38, height: 38,
    borderWidth: 1.5,
    borderColor: C.n300,
    borderRadius: 3,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 18, height: 18 },
  qrDot:  { width: 5, height: 5, backgroundColor: C.brand, margin: 1, borderRadius: 1 },
  qrCap:  { fontSize: 5.5, color: C.n500, textAlign: 'center' },

  payCell:     { flex: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, borderRightWidth: 1, borderRightColor: C.n200 },
  payCellLast: { borderRightWidth: 0 },
  payKey:  { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.5, marginBottom: 3 },
  payVal:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.n700 },
  payMono: { fontSize: 7, fontFamily: 'Courier', color: C.n700 },

  // ── ASP refs ──────────────────────────────────────────────────────────────
  refBox: {
    marginHorizontal: 30,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  refHdr:    { backgroundColor: C.n50, borderBottomWidth: 1, borderBottomColor: C.n200, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5 },
  refHdrTxt: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.n500, letterSpacing: 0.6 },
  refRow:    { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.n100 },
  refRowLast:{ borderBottomWidth: 0 },
  refKey:    { width: '34%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.n400 },
  refVal:    { flex: 1, fontSize: 7, fontFamily: 'Courier', color: C.n700 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerRule: { height: 1, backgroundColor: C.n200, marginHorizontal: 30, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 8,
    paddingBottom: 8,
  },
  footerLeft: { flex: 1, paddingRight: 10 },
  footerTxt:  { fontSize: 6, color: C.n400, lineHeight: 1.7 },
  footerBold: { fontFamily: 'Helvetica-Bold', color: C.n500 },

  footerPills: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: C.n50,
    marginLeft: 3,
  },
  pillTxt: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n500 },

  bottomBar: { height: 4, backgroundColor: C.brand },
})

// ─── Badge map ────────────────────────────────────────────────────────────────
const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  draft:          { bg: C.muBg, fg: C.muFg, label: 'DRAFT' },
  pending:        { bg: C.waBg, fg: C.waFg, label: 'PENDING' },
  submitted:      { bg: C.blBg, fg: C.blFg, label: 'SUBMITTED' },
  validated:      { bg: C.okBg, fg: C.okFg, label: 'VALIDATED' },
  rejected:       { bg: C.erBg, fg: C.erFg, label: 'REJECTED' },
  cancelled:      { bg: C.muBg, fg: C.muFg, label: 'CANCELLED' },
  paid:           { bg: C.okBg, fg: C.okFg, label: 'PAID' },
  partially_paid: { bg: C.blBg, fg: C.blFg, label: 'PARTIAL' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: string | number | null | undefined, dec = 2): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-AE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

const nonZero = (v: string | number | null | undefined) =>
  v != null && v !== '' && Number(v) !== 0

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoInfoRow({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null
  return (
    <View style={S.coInfoRow}>
      <Text style={S.coInfoKey}>{k}</Text>
      <Text style={S.coInfoVal}>{v}</Text>
    </View>
  )
}

function SCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[S.stripCell, ...(last ? [S.stripCellLast] : [])]}>
      <Text style={S.stripKey}>{label.toUpperCase()}</Text>
      <Text style={S.stripVal}>{value}</Text>
    </View>
  )
}

function PartyCard({
  title, name, legal, address, trn, phone, email, isLeft, accentColor, logoUrl,
}: {
  title: string; name: string; legal?: string; address: string
  trn?: string; phone?: string; email?: string; isLeft?: boolean
  accentColor?: string; logoUrl?: string | null
}) {
  const accent  = accentColor ?? C.brand
  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <View style={[S.partyCard, ...(isLeft ? [S.partyCardLeft] : [])]}>

      {/* Card header with icon + label */}
      <View style={[S.partyHdr, { backgroundColor: C.n50, borderLeftColor: accent }]}>
        {logoUrl ? (
          <Image src={logoUrl} style={S.partyMarkImg} />
        ) : (
          <View style={[S.partyMark, { backgroundColor: accent }]}>
            <Text style={S.partyMarkTxt}>{initial}</Text>
          </View>
        )}
        <Text style={[S.partyHdrLabel, { color: accent }]}>{title.toUpperCase()}</Text>
      </View>

      {/* Card body */}
      <View style={S.partyBody}>
        <Text style={S.partyName}>{name}</Text>
        {!!legal && <Text style={S.partyLegal}>{legal}</Text>}
        {!!address && <Text style={S.partyAddr}>{address}</Text>}
        {!!trn && (
          <View style={S.partyTrnRow}>
            <Text style={S.partyTrnKey}>TRN</Text>
            <Text style={S.partyTrnVal}>{trn}</Text>
          </View>
        )}
        {!!phone && <Text style={S.partyContact}>{phone}</Text>}
        {!!email && <Text style={S.partyContact}>{email}</Text>}
      </View>
    </View>
  )
}

function VatPill({ type }: { type: string }) {
  const isStd  = type === 'standard'
  const isZero = type === 'zero'
  return (
    <View style={[S.vatPill, { backgroundColor: isStd ? C.blBg : isZero ? C.okBg : C.muBg }]}>
      <Text style={[S.vatTxt, { color: isStd ? C.blFg : isZero ? C.okFg : C.muFg }]}>
        {isStd ? 'VAT 5%' : isZero ? '0%' : 'Exempt'}
      </Text>
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export interface InvoicePDFProps { invoice: Invoice; company: Company | null }

export function InvoicePDF({ invoice, company }: InvoicePDFProps) {
  const bc     = BADGE[invoice.status] ?? BADGE.draft
  const isCN   = invoice.invoice_type === 'credit_note'
  const isCS   = invoice.invoice_type === 'continuous_supply'
  const hasDsc = nonZero(invoice.discount_amount)
  const hasPaid = nonZero(invoice.amount_paid)
  const hasAsp = !!invoice.asp_submission_id

  const balanceDue = hasPaid
    ? Number(invoice.total_amount) - Number(invoice.amount_paid ?? 0)
    : null

  const supplierAddr = [
    company?.street_address,
    company?.city && company?.emirate
      ? `${company.city}, ${company.emirate}`
      : (company?.city || company?.emirate),
    company?.po_box ? `P.O. Box ${company.po_box}` : null,
    company?.country || 'United Arab Emirates',
  ].filter(Boolean).join('\n')

  const buyerAddr = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_country || 'United Arab Emirates',
  ].filter(Boolean).join('\n') || invoice.customer_name

  const activeItems = (invoice.items ?? [])
    .filter(it => it.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const invTypeLabel = isCN ? 'CREDIT NOTE' : isCS ? 'SUPPLY INVOICE' : 'TAX INVOICE'

  const pmLabel =
    invoice.payment_means_code === '10' ? 'Cash' :
    invoice.payment_means_code === '30' ? 'Bank Transfer' :
    invoice.payment_means_code === '48' ? 'Card' :
    invoice.payment_means_code || 'Bank Transfer'

  const coInitial = (company?.name || invoice.company_name || 'A').charAt(0).toUpperCase()

  return (
    <Document title={invoice.invoice_number} author="E-Numerak">
      <Page size="A4" style={S.page}>

        {/* 1 ── Top accent bar */}
        <View style={S.topBar} />

        {/* 2 ── Header */}
        <View style={S.header}>

          {/* Left: supplier identity with logo */}
          <View style={S.hdrLeft}>
            <View style={S.coLogoRow}>
              {company?.logo_url ? (
                <Image src={company.logo_url} style={S.coLogoImg} />
              ) : (
                <View style={S.coMark}>
                  <Text style={S.coMarkLetter}>{coInitial}</Text>
                </View>
              )}
              <View style={S.coNameBlock}>
                <Text style={S.coName}>{company?.name || invoice.company_name}</Text>
                {!!(company?.legal_name && company.legal_name !== company.name) && (
                  <Text style={S.coLegal}>{company.legal_name}</Text>
                )}
              </View>
            </View>
            <CoInfoRow k="TEL"   v={company?.phone} />
            <CoInfoRow k="EMAIL" v={company?.email} />
            {!!company?.street_address && (
              <CoInfoRow k="ADDR" v={[company.street_address, company.city, company.country || 'UAE'].filter(Boolean).join(', ')} />
            )}
            <CoInfoRow k="TRN" v={company?.trn || invoice.company_trn} />
            {!!company?.website && <CoInfoRow k="WEB" v={company.website} />}
          </View>

          {/* Right: invoice identity */}
          <View style={S.hdrRight}>
            <Text style={S.invTypeLabel}>{invTypeLabel}</Text>
            <Text style={S.invTitle}>INVOICE</Text>
            <Text style={S.invNum}>{invoice.invoice_number}</Text>

            <View style={[S.badge, { backgroundColor: bc.bg }]}>
              <Text style={[S.badgeTxt, { color: bc.fg }]}>{bc.label}</Text>
            </View>

            <Text style={S.amtLbl}>TOTAL AMOUNT DUE</Text>
            <Text style={S.amtVal}>{fmt(invoice.total_amount)}</Text>
            <Text style={S.amtCur}>{invoice.currency}</Text>
          </View>
        </View>

        {/* 3 ── Date / reference strip */}
        <View style={S.strip}>
          <SCell label="Issue Date"  value={fmtDate(invoice.issue_date)} />
          <SCell label="Due Date"    value={fmtDate(invoice.due_date)} />
          {isCS ? (
            <>
              <SCell label="Period Start" value={fmtDate(invoice.supply_date)} />
              <SCell label="Period End"   value={fmtDate(invoice.supply_date_end)} />
            </>
          ) : (
            <SCell label="Supply Date" value={fmtDate(invoice.supply_date)} />
          )}
          <SCell label="Currency" value={invoice.currency} last={!invoice.purchase_order_number} />
          {!!invoice.purchase_order_number && (
            <SCell label="PO Number" value={invoice.purchase_order_number} last />
          )}
        </View>

        {/* Credit note banner */}
        {isCN && !!invoice.reference_number && (
          <View style={S.crBanner}>
            <Text style={S.crLbl}>CREDIT NOTE —</Text>
            <Text style={S.crVal}>References original invoice: {invoice.reference_number}</Text>
          </View>
        )}

        {/* 4 ── Party cards */}
        <View style={S.partiesRow}>
          <PartyCard
            isLeft
            title="Supplier"
            accentColor={C.brand}
            logoUrl={company?.logo_url}
            name={company?.name || invoice.company_name}
            legal={company?.legal_name !== company?.name ? company?.legal_name : undefined}
            address={supplierAddr}
            trn={company?.trn || invoice.company_trn}
            phone={company?.phone}
            email={company?.email}
          />
          <PartyCard
            title="Bill To"
            accentColor={C.teal}
            name={invoice.customer_name}
            address={buyerAddr}
            trn={invoice.customer_trn}
            phone={invoice.customer_phone}
            email={invoice.customer_email}
          />
        </View>

        {/* 5 ── Line items table */}
        <View style={S.tableWrap}>
          <View style={S.thead}>
            <View style={[S.th, S.thC, { width: '4%' }]}><Text>#</Text></View>
            <View style={[S.th, { flex: 1 }]}><Text>DESCRIPTION</Text></View>
            <View style={[S.th, S.thR, { width: '7%' }]}><Text>QTY</Text></View>
            <View style={[S.th, S.thC, { width: '6%' }]}><Text>UNIT</Text></View>
            <View style={[S.th, S.thR, { width: '12%' }]}><Text>UNIT PRICE</Text></View>
            <View style={[S.th, S.thC, { width: '9%' }]}><Text>VAT</Text></View>
            <View style={[S.th, S.thR, { width: '10%' }]}><Text>VAT AMT</Text></View>
            <View style={[S.th, S.thLast, S.thR, { width: '13%' }]}><Text>TOTAL</Text></View>
          </View>

          {activeItems.map((item, i) => {
            const isLast = i === activeItems.length - 1
            return (
              <View
                key={item.id}
                style={[S.trow,
                  ...(i % 2 === 1 ? [S.trowAlt] : []),
                  ...(isLast       ? [S.trowLast] : []),
                ]}
              >
                <View style={[S.td, S.tdC, { width: '4%' }]}>
                  <Text style={S.tdIdx}>{i + 1}</Text>
                </View>
                <View style={[S.td, { flex: 1 }]}>
                  {!!(item as any).item_name && (
                    <Text style={S.tdBold}>{(item as any).item_name}</Text>
                  )}
                  <Text style={(item as any).item_name ? S.tdSub : S.tdBold}>
                    {item.description}
                  </Text>
                </View>
                <View style={[S.td, S.tdR, { width: '7%' }]}>
                  <Text style={S.tdMuted}>{item.quantity}</Text>
                </View>
                <View style={[S.td, S.tdC, { width: '6%' }]}>
                  <Text style={{ fontSize: 7, color: C.n400 }}>{item.unit || '—'}</Text>
                </View>
                <View style={[S.td, S.tdR, { width: '12%' }]}>
                  <Text style={S.tdNum}>{fmt(item.unit_price)}</Text>
                </View>
                <View style={[S.td, S.tdC, { width: '9%' }]}>
                  <VatPill type={item.vat_rate_type} />
                </View>
                <View style={[S.td, S.tdR, { width: '10%' }]}>
                  <Text style={S.tdMuted}>{fmt(item.vat_amount)}</Text>
                </View>
                <View style={[S.td, S.tdLast, S.tdR, { width: '13%' }]}>
                  <Text style={S.tdTotal}>{fmt(item.total_amount)}</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* 6 ── Totals + notes */}
        <View style={S.totOuter}>
          <View style={S.totLeft}>
            {!!invoice.notes && (
              <View style={S.notesBox}>
                <Text style={S.notesLbl}>NOTES & TERMS</Text>
                <Text style={S.notesTxt}>{invoice.notes}</Text>
              </View>
            )}
          </View>

          <View style={S.totRight}>
            <View style={S.totRow}>
              <Text style={S.totKey}>Subtotal</Text>
              <Text style={S.totVal}>{invoice.currency} {fmt(invoice.subtotal)}</Text>
            </View>

            {hasDsc && (
              <>
                <View style={S.totRow}>
                  <Text style={[S.totKey, S.totRedKey]}>Discount</Text>
                  <Text style={[S.totVal, S.totRedVal]}>− {invoice.currency} {fmt(invoice.discount_amount)}</Text>
                </View>
                <View style={S.totRow}>
                  <Text style={S.totKey}>Taxable Amount</Text>
                  <Text style={S.totVal}>{invoice.currency} {fmt(invoice.taxable_amount)}</Text>
                </View>
              </>
            )}

            <View style={S.totRow}>
              <Text style={[S.totKey, S.totBluKey]}>VAT (5%)</Text>
              <Text style={[S.totVal, S.totBluVal]}>{invoice.currency} {fmt(invoice.total_vat)}</Text>
            </View>

            <View style={S.totGrand}>
              <Text style={S.totGrandKey}>Total Due</Text>
              <Text style={S.totGrandVal}>{invoice.currency} {fmt(invoice.total_amount)}</Text>
            </View>

            {hasPaid && (
              <View style={S.totPaidRow}>
                <Text style={S.totPaidKey}>Amount Paid</Text>
                <Text style={S.totPaidVal}>− {invoice.currency} {fmt(invoice.amount_paid)}</Text>
              </View>
            )}

            {balanceDue !== null && balanceDue > 0 && (
              <View style={S.totBalRow}>
                <Text style={S.totBalKey}>Balance Due</Text>
                <Text style={S.totBalVal}>{invoice.currency} {fmt(balanceDue)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 7 ── QR + payment info bar */}
        <View style={S.infoBar}>
          <View style={S.qrCell}>
            <View style={S.qrBox}>
              {/* Stylised QR grid placeholder */}
              <View style={S.qrGrid}>
                {[1,1,0,1,1,0,1,0,0,1].map((on, i) => (
                  <View key={i} style={[S.qrDot, { opacity: on ? 1 : 0 }]} />
                ))}
              </View>
            </View>
            <Text style={S.qrCap}>{'Scan to\nverify'}</Text>
          </View>

          <View style={S.payCell}>
            <Text style={S.payKey}>PAYMENT METHOD</Text>
            <Text style={S.payVal}>{pmLabel}</Text>
          </View>
          <View style={S.payCell}>
            <Text style={S.payKey}>DUE DATE</Text>
            <Text style={[S.payVal, { color: invoice.due_date ? C.erFg : C.n700 }]}>
              {fmtDate(invoice.due_date)}
            </Text>
          </View>
          {company?.iban ? (
            <View style={S.payCell}>
              <Text style={S.payKey}>IBAN</Text>
              <Text style={S.payMono}>{company.iban}</Text>
            </View>
          ) : (
            <View style={S.payCell}>
              <Text style={S.payKey}>INVOICE TYPE</Text>
              <Text style={S.payVal}>{invTypeLabel}</Text>
            </View>
          )}
          <View style={[S.payCell, S.payCellLast]}>
            <Text style={S.payKey}>ISSUER TRN</Text>
            <Text style={S.payMono}>{company?.trn || invoice.company_trn || '—'}</Text>
          </View>
        </View>

        {/* 8 ── ASP submission refs */}
        {hasAsp && (
          <View style={S.refBox}>
            <View style={S.refHdr}>
              <Text style={S.refHdrTxt}>ELECTRONIC SUBMISSION REFERENCES  ·  E-Invoice 5-CORNER MODEL</Text>
            </View>
            <View style={S.refRow}>
              <Text style={S.refKey}>ASP Submission ID</Text>
              <Text style={S.refVal}>{invoice.asp_submission_id}</Text>
            </View>
            {!!invoice.asp_submitted_at && (
              <View style={[S.refRow, S.refRowLast]}>
                <Text style={S.refKey}>Submitted At</Text>
                <Text style={S.refVal}>{fmtDate(invoice.asp_submitted_at)}</Text>
              </View>
            )}
          </View>
        )}

        {/* 9 ── Footer */}
        <View style={S.footerRule} />
        <View style={S.footer}>
          <View style={S.footerLeft}>
            <Text style={S.footerTxt}>
              {'Computer-generated tax invoice  ·  UAE Federal Decree-Law No. 8 of 2017 on Value Added Tax\n'}
              <Text style={S.footerBold}>Issuer TRN: {company?.trn || invoice.company_trn || '—'}</Text>
              {'  ·  Taxable Amount: '}
              <Text style={S.footerBold}>{invoice.currency} {fmt(invoice.taxable_amount)}</Text>
              {'  ·  Generated: '}{fmtDate(invoice.created_at)}
            </Text>
          </View>
          <View style={S.footerPills}>
            {['BIS 3.0', 'UAE PINT', 'UBL 2.1', 'FTA'].map(lbl => (
              <View key={lbl} style={S.pill}>
                <Text style={S.pillTxt}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 10 ── Bottom accent bar */}
        <View style={S.bottomBar} />

      </Page>
    </Document>
  )
}
