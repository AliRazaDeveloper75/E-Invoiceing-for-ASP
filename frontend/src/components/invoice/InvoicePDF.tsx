/**
 * InvoicePDF — @react-pdf/renderer document component.
 *
 * Renders a professional A4 invoice PDF entirely in the browser.
 * No server, no system dependencies, no xhtml2pdf limitations.
 *
 * Props:
 *   invoice  — Invoice object from the API
 *   company  — Full Company object (for address/phone/email)
 *              Falls back to invoice.company_name / company_trn if null.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Company, Invoice } from '@/types'

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  navy:      '#0f2557',
  navyMid:   '#1a3a6e',
  navyDeep:  '#0a1a42',
  blue:      '#1d4ed8',
  blueLight: '#93c5fd',
  bluePale:  '#dbeafe',
  gold:      '#d97706',
  white:     '#ffffff',
  g50:       '#f8fafc',
  g100:      '#f1f5f9',
  g200:      '#e2e8f0',
  g300:      '#cbd5e1',
  g400:      '#94a3b8',
  g500:      '#64748b',
  g700:      '#334155',
  g900:      '#0f172a',
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Page
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.g900,
    backgroundColor: C.white,
    flexDirection: 'column',
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: C.navy,
    paddingHorizontal: 28,
    paddingVertical: 5,
  },
  topBarTxt: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.g400,
    letterSpacing: 1.5,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: { flexDirection: 'row', backgroundColor: C.navy },
  hdrLeft: {
    flex: 54,
    paddingTop: 20, paddingBottom: 20, paddingLeft: 28, paddingRight: 18,
  },
  hdrDivider: { width: 1, backgroundColor: C.navyMid },
  hdrRight: {
    flex: 46,
    paddingTop: 20, paddingBottom: 20, paddingLeft: 18, paddingRight: 28,
    alignItems: 'flex-end',
  },

  // Logo
  logoRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoBox:   {
    width: 46, height: 46, backgroundColor: C.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter:   { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white },
  coName:       { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white, marginLeft: 10 },
  coLegal:      { fontSize: 7, color: C.blueLight, marginLeft: 10, marginTop: 2 },

  // Contact list
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  contactLbl: {
    width: 38, fontSize: 6, fontFamily: 'Helvetica-Bold',
    color: '#60a5fa', letterSpacing: 0.5, paddingTop: 1,
  },
  contactVal: { flex: 1, fontSize: 7.5, color: C.g300, lineHeight: 1.4 },

  // Invoice identity (right column)
  invWord:   { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 2 },
  invNo:     { fontSize: 8.5, color: C.blueLight, marginTop: 6 },
  invNoVal:  { fontFamily: 'Helvetica-Bold', color: C.white },
  invType:   { fontSize: 7, color: '#7ea8e0', marginTop: 5 },

  // Status badge
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 3, marginTop: 7, marginBottom: 5 },
  badgeTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },

  // ── Gold line ────────────────────────────────────────────────────────────
  goldLine: { height: 4, backgroundColor: C.gold },

  // ── Body wrapper ─────────────────────────────────────────────────────────
  body: { paddingHorizontal: 28, paddingTop: 20, flex: 1 },

  // ── Detail strip (dates / currency) ──────────────────────────────────────
  strip: { flexDirection: 'row', borderWidth: 1, borderColor: C.g200, marginBottom: 18 },
  stripCell: {
    flex: 1, backgroundColor: C.g50, padding: 9,
    borderRightWidth: 1, borderRightColor: C.g200,
  },
  stripLast: { borderRightWidth: 0 },
  stripLbl:  { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.g400, letterSpacing: 0.8, marginBottom: 3 },
  stripVal:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.g900 },

  // ── Credit note banner ───────────────────────────────────────────────────
  crBanner: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 3, borderLeftColor: '#f97316',
    borderTopWidth: 1, borderTopColor: '#fed7aa',
    borderRightWidth: 1, borderRightColor: '#fed7aa',
    borderBottomWidth: 1, borderBottomColor: '#fed7aa',
    padding: 9, marginBottom: 14,
  },
  crTxt: { fontSize: 8, color: '#9a3412' },

  // ── From / Bill To cards ──────────────────────────────────────────────────
  partiesRow: { flexDirection: 'row', marginBottom: 20 },
  partyCol:   { flex: 1 },
  partyGap:   { width: '4%' },
  partyHdr:   { backgroundColor: C.navy, paddingHorizontal: 13, paddingVertical: 7 },
  partyHdrTxt:{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 },
  partyBody: {
    backgroundColor: C.g50,
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: '#dde5f0', padding: 13,
  },
  partyName:    { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.g900, marginBottom: 4 },
  partyLegal:   { fontSize: 7.5, color: C.g500, marginBottom: 4 },
  partyAddr:    { fontSize: 7.5, color: C.g500, lineHeight: 1.8, marginBottom: 6 },
  partyTrnLbl:  { fontSize: 6, color: C.g400, letterSpacing: 0.5, marginBottom: 2 },
  partyTrnVal:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 2 },
  partyContact: { fontSize: 7, color: C.g400, marginTop: 1 },

  // ── Items table ───────────────────────────────────────────────────────────
  tblWrap: { borderWidth: 1, borderColor: C.g200, marginBottom: 20 },
  thead:   { flexDirection: 'row', backgroundColor: C.navy },
  th: {
    paddingHorizontal: 7, paddingVertical: 9,
    fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.white,
    borderRightWidth: 1, borderRightColor: C.navyMid,
  },
  thLast: { borderRightWidth: 0 },
  thR:    { textAlign: 'right' },
  thC:    { textAlign: 'center' },

  trow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.g100 },
  trowAlt: { backgroundColor: '#f4f7ff' },
  td: {
    paddingHorizontal: 7, paddingVertical: 10, fontSize: 8.5, color: C.g700,
    borderRightWidth: 1, borderRightColor: C.g100, justifyContent: 'center',
  },
  tdLast: { borderRightWidth: 0 },
  tdR:    { alignItems: 'flex-end' },
  tdC:    { alignItems: 'center' },

  itemName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.g900 },
  itemDesc: { fontSize: 7, color: C.g400, marginTop: 2 },
  itemSku:  { fontSize: 6.5, color: C.g300, marginTop: 1 },

  vpPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 },
  vpTxt:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
  vpStd:  { backgroundColor: '#eff6ff' }, vpStdT:  { color: '#1d4ed8' },
  vpZero: { backgroundColor: '#f0fdf4' }, vpZeroT: { color: '#15803d' },
  vpEx:   { backgroundColor: C.g50 },    vpExT:   { color: C.g500 },

  // ── Totals ────────────────────────────────────────────────────────────────
  totOuter: { flexDirection: 'row', marginBottom: 18 },
  totSpace: { flex: 46 },
  totBox:   { flex: 54, borderWidth: 1, borderColor: C.g200 },
  totRow:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eef2f8' },
  totLbl:   { flex: 1, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.g50, fontSize: 8.5, color: C.g500 },
  totVal:   { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.g50, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.g900, textAlign: 'right', minWidth: 110 },
  totDisc:  { color: '#dc2626' },
  totVat:   { color: '#1d4ed8' },
  totGrand: { flexDirection: 'row' },
  totGLbl:  { flex: 1, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: C.navy, fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.blueLight },
  totGVal:  { paddingHorizontal: 14, paddingVertical: 13, backgroundColor: C.navy, fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white, textAlign: 'right', minWidth: 110 },

  // ── ASP refs ─────────────────────────────────────────────────────────────
  refsBox: { borderWidth: 1, borderColor: C.g200, marginBottom: 16 },
  refsHdr: { backgroundColor: C.g100, borderBottomWidth: 1, borderBottomColor: C.g200, paddingHorizontal: 14, paddingVertical: 5 },
  refsHdrTxt: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.navy },
  refRow:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.g100, paddingHorizontal: 14, paddingVertical: 6 },
  refLast: { borderBottomWidth: 0 },
  refKey:  { width: '38%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.g400 },
  refVal:  { flex: 1, fontSize: 7.5, color: C.g700, fontFamily: 'Courier' },

  // ── Notes ────────────────────────────────────────────────────────────────
  notesBox: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4, borderLeftColor: C.gold,
    borderTopWidth: 1, borderTopColor: '#fde68a',
    borderRightWidth: 1, borderRightColor: '#fde68a',
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
    padding: 11, marginBottom: 16,
  },
  notesLbl: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#92400e', letterSpacing: 1, marginBottom: 4 },
  notesTxt: { fontSize: 8, color: '#44403c', lineHeight: 1.7 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: C.navy, paddingHorizontal: 28, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  footerLeft: { flex: 1 },
  footerTxt:  { fontSize: 6.5, color: '#475569', lineHeight: 1.9 },
  footerBold: { fontFamily: 'Helvetica-Bold', color: '#94a3b8' },
  footerRight:{ flexDirection: 'row', alignItems: 'center' },
  fbadge:    { backgroundColor: C.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, marginLeft: 4 },
  fbadgeTxt: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.navy },
})

// ─── Badge colours map ────────────────────────────────────────────────────────
const BADGE: Record<string, { bg: string; color: string }> = {
  draft:        { bg: '#334155', color: C.g300 },
  pending:      { bg: '#451a03', color: '#fde68a' },
  submitted:    { bg: '#1e3a8a', color: C.bluePale },
  validated:    { bg: '#14532d', color: '#a7f3d0' },
  rejected:     { bg: '#7f1d1d', color: '#fecaca' },
  cancelled:    { bg: '#1e293b', color: C.g400 },
  paid:         { bg: '#14532d', color: '#a7f3d0' },
  partially_paid:{ bg: '#1e3a8a', color: C.bluePale },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: string | number | null | undefined, decimals = 2): string {
  if (v == null || v === '') return '—'
  return Number(v).toFixed(decimals)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nonZero(v: string | number | null | undefined): boolean {
  return v != null && v !== '' && Number(v) !== 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContactRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={S.contactRow}>
      <Text style={S.contactLbl}>{label}</Text>
      <Text style={S.contactVal}>{value}</Text>
    </View>
  )
}

function DetailCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[S.stripCell, last ? S.stripLast : undefined]}>
      <Text style={S.stripLbl}>{label.toUpperCase()}</Text>
      <Text style={S.stripVal}>{value}</Text>
    </View>
  )
}

function PartyCard({
  title, name, legal, address, trnLabel, trn, phone, email,
}: {
  title: string; name: string; legal?: string; address: string;
  trnLabel?: string; trn?: string; phone?: string; email?: string;
}) {
  return (
    <View style={S.partyCol}>
      <View style={S.partyHdr}>
        <Text style={S.partyHdrTxt}>{title.toUpperCase()}</Text>
      </View>
      <View style={S.partyBody}>
        <Text style={S.partyName}>{name}</Text>
        {!!legal && <Text style={S.partyLegal}>{legal}</Text>}
        <Text style={S.partyAddr}>{address}</Text>
        {!!trn && (
          <>
            <Text style={S.partyTrnLbl}>{(trnLabel || 'TAX REGISTRATION NUMBER').toUpperCase()}</Text>
            <Text style={S.partyTrnVal}>{trn}</Text>
          </>
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
    <View style={[S.vpPill, isStd ? S.vpStd : isZero ? S.vpZero : S.vpEx]}>
      <Text style={[S.vpTxt, isStd ? S.vpStdT : isZero ? S.vpZeroT : S.vpExT]}>
        {isStd ? '5%' : isZero ? '0%' : 'Exempt'}
      </Text>
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export interface InvoicePDFProps {
  invoice: Invoice
  company: Company | null
}

export function InvoicePDF({ invoice, company }: InvoicePDFProps) {
  const badgeStyle = BADGE[invoice.status] ?? BADGE.draft

  // Supplier address string
  const supplierAddr = [
    company?.street_address,
    company?.city && company?.emirate
      ? `${company.city}, ${company.emirate}`
      : (company?.city || company?.emirate),
    company?.po_box ? `P.O. Box ${company.po_box}` : null,
    company?.country || 'UAE',
  ].filter(Boolean).join('\n')

  // Customer address string
  const customerAddr = [
    invoice.customer_street_address,
    invoice.customer_city,
    invoice.customer_country,
  ].filter(Boolean).join('\n') || invoice.customer_name

  const isCreditNote   = invoice.invoice_type === 'credit_note'
  const isContSupply   = invoice.invoice_type === 'continuous_supply'
  const hasDiscount    = nonZero(invoice.discount_amount)
  const hasAspRef      = !!invoice.asp_submission_id

  return (
    <Document title={invoice.invoice_number} author="E-Numerak">
      <Page size="A4" style={S.page}>

        {/* ── Top label bar ─────────────────────────────────────── */}
        <View style={S.topBar}>
          <Text style={S.topBarTxt}>
            TAX INVOICE  •  UAE FTA COMPLIANT  •  PEPPOL BIS 3.0  •  UBL 2.1
          </Text>
        </View>

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={S.header}>

          {/* Left — supplier branding */}
          <View style={S.hdrLeft}>
            <View style={S.logoRow}>
              <View style={S.logoBox}>
                <Text style={S.logoLetter}>
                  {(company?.name || invoice.company_name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={S.coName}>{company?.name || invoice.company_name}</Text>
                {!!company?.legal_name && company.legal_name !== company.name && (
                  <Text style={S.coLegal}>{company.legal_name}</Text>
                )}
              </View>
            </View>

            <ContactRow label="TEL"   value={company?.phone} />
            <ContactRow label="EMAIL" value={company?.email} />
            {!!company?.street_address && (
              <ContactRow
                label="ADDR"
                value={[
                  company.street_address,
                  company.city,
                  company.country || 'UAE',
                ].filter(Boolean).join(', ')}
              />
            )}
            <ContactRow label="TRN"   value={company?.trn || invoice.company_trn} />
          </View>

          <View style={S.hdrDivider} />

          {/* Right — invoice identity */}
          <View style={S.hdrRight}>
            <Text style={S.invWord}>INVOICE</Text>
            <Text style={S.invNo}>
              No.{'  '}
              <Text style={S.invNoVal}>{invoice.invoice_number}</Text>
            </Text>

            {/* Status badge */}
            <View style={[S.badge, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[S.badgeTxt, { color: badgeStyle.color }]}>
                {invoice.status_display || invoice.status}
              </Text>
            </View>

            <Text style={S.invType}>
              {invoice.type_display?.toUpperCase() || invoice.invoice_type.toUpperCase()}
              {'  •  '}
              {invoice.transaction_type?.toUpperCase()}
              {'  •  '}
              {invoice.currency}
            </Text>
          </View>
        </View>

        {/* Gold accent line */}
        <View style={S.goldLine} />

        {/* ── Body ──────────────────────────────────────────────── */}
        <View style={S.body}>

          {/* Invoice details strip */}
          <View style={S.strip}>
            <DetailCell label="Issue Date"   value={fmtDate(invoice.issue_date)} />
            <DetailCell label="Due Date"     value={fmtDate(invoice.due_date)} />
            {isContSupply ? (
              <>
                <DetailCell label="Period Start" value={fmtDate(invoice.supply_date)} />
                <DetailCell label="Period End"   value={fmtDate(invoice.supply_date_end)} />
              </>
            ) : (
              <DetailCell label="Supply Date" value={fmtDate(invoice.supply_date)} />
            )}
            <DetailCell label="Currency" value={invoice.currency} />
            {!!invoice.purchase_order_number && (
              <DetailCell label="PO Number" value={invoice.purchase_order_number} />
            )}
            {!!invoice.payment_means_code && (
              <DetailCell label="Payment Code" value={invoice.payment_means_code} last />
            )}
          </View>

          {/* Credit note banner */}
          {isCreditNote && !!invoice.reference_number && (
            <View style={S.crBanner}>
              <Text style={S.crTxt}>
                {'CREDIT NOTE — References original invoice: '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{invoice.reference_number}</Text>
              </Text>
            </View>
          )}

          {/* From / Bill To */}
          <View style={S.partiesRow}>
            <PartyCard
              title="From Supplier"
              name={company?.name || invoice.company_name}
              legal={company?.legal_name !== company?.name ? company?.legal_name : undefined}
              address={supplierAddr}
              trn={company?.trn || invoice.company_trn}
              phone={company?.phone}
              email={company?.email}
            />
            <View style={S.partyGap} />
            <PartyCard
              title="Bill To (Buyer)"
              name={invoice.customer_name}
              address={customerAddr}
              trnLabel={invoice.customer_trn ? 'Tax Registration Number' : undefined}
              trn={invoice.customer_trn}
            />
          </View>

          {/* ── Line items ─────────────────────────────────────── */}
          <View style={S.tblWrap}>
            {/* Table header */}
            <View style={S.thead}>
              <View style={[S.th, { width: '4%', textAlign: 'center' }]}><Text>#</Text></View>
              <View style={[S.th, { flex: 1 }]}><Text>DESCRIPTION</Text></View>
              <View style={[S.th, S.thR, { width: '8%' }]}><Text>QTY</Text></View>
              <View style={[S.th, S.thC, { width: '7%' }]}><Text>UNIT</Text></View>
              <View style={[S.th, S.thR, { width: '12%' }]}><Text>UNIT PRICE</Text></View>
              <View style={[S.th, S.thC, { width: '10%' }]}><Text>VAT</Text></View>
              <View style={[S.th, S.thR, { width: '9%' }]}><Text>VAT AMT</Text></View>
              <View style={[S.th, S.thLast, S.thR, { width: '14%' }]}><Text>TOTAL</Text></View>
            </View>

            {/* Table rows */}
            {invoice.items
              .filter((it) => it.is_active !== false)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((item, i) => (
                <View key={item.id} style={[S.trow, i % 2 === 1 ? S.trowAlt : undefined]}>
                  <View style={[S.td, { width: '4%', alignItems: 'center' }]}>
                    <Text style={{ color: C.g300, fontFamily: 'Helvetica-Bold' }}>{i + 1}</Text>
                  </View>
                  <View style={[S.td, { flex: 1 }]}>
                    {!!(item as any).item_name && (
                      <Text style={S.itemName}>{(item as any).item_name}</Text>
                    )}
                    <Text style={(item as any).item_name ? S.itemDesc : S.itemName}>
                      {item.description}
                    </Text>
                    {!!(item as any).item_code && (
                      <Text style={S.itemSku}>SKU: {(item as any).item_code}</Text>
                    )}
                  </View>
                  <View style={[S.td, S.tdR, { width: '8%' }]}>
                    <Text style={{ color: C.g700 }}>{item.quantity}</Text>
                  </View>
                  <View style={[S.td, S.tdC, { width: '7%' }]}>
                    <Text style={{ color: C.g400 }}>{item.unit || '—'}</Text>
                  </View>
                  <View style={[S.td, S.tdR, { width: '12%' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: C.g900 }}>
                      {fmt(item.unit_price)}
                    </Text>
                  </View>
                  <View style={[S.td, S.tdC, { width: '10%' }]}>
                    <VatPill type={item.vat_rate_type} />
                  </View>
                  <View style={[S.td, S.tdR, { width: '9%' }]}>
                    <Text style={{ color: C.g400 }}>{fmt(item.vat_amount)}</Text>
                  </View>
                  <View style={[S.td, S.tdLast, S.tdR, { width: '14%' }]}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: C.navy }}>
                      {fmt(item.total_amount)}
                    </Text>
                  </View>
                </View>
              ))}
          </View>

          {/* ── Totals ─────────────────────────────────────────── */}
          <View style={S.totOuter}>
            <View style={S.totSpace} />
            <View style={S.totBox}>
              {/* Subtotal */}
              <View style={S.totRow}>
                <Text style={S.totLbl}>Subtotal</Text>
                <Text style={S.totVal}>{invoice.currency} {fmt(invoice.subtotal)}</Text>
              </View>

              {/* Discount (conditional) */}
              {hasDiscount && (
                <>
                  <View style={S.totRow}>
                    <Text style={[S.totLbl, S.totDisc]}>Discount</Text>
                    <Text style={[S.totVal, S.totDisc]}>
                      − {invoice.currency} {fmt(invoice.discount_amount)}
                    </Text>
                  </View>
                  <View style={S.totRow}>
                    <Text style={S.totLbl}>Taxable Amount</Text>
                    <Text style={S.totVal}>{invoice.currency} {fmt(invoice.taxable_amount)}</Text>
                  </View>
                </>
              )}

              {/* VAT */}
              <View style={S.totRow}>
                <Text style={[S.totLbl, S.totVat]}>VAT (5%)</Text>
                <Text style={[S.totVal, S.totVat]}>{invoice.currency} {fmt(invoice.total_vat)}</Text>
              </View>

              {/* Grand total — navy row */}
              <View style={S.totGrand}>
                <Text style={S.totGLbl}>Total Due</Text>
                <Text style={S.totGVal}>{invoice.currency} {fmt(invoice.total_amount)}</Text>
              </View>
            </View>
          </View>

          {/* ── ASP References ─────────────────────────────────── */}
          {hasAspRef && (
            <View style={S.refsBox}>
              <View style={S.refsHdr}>
                <Text style={S.refsHdrTxt}>ELECTRONIC SUBMISSION REFERENCES</Text>
              </View>
              <View style={S.refRow}>
                <Text style={S.refKey}>ASP Submission ID (Corner 2)</Text>
                <Text style={S.refVal}>{invoice.asp_submission_id}</Text>
              </View>
              {!!invoice.asp_submitted_at && (
                <View style={[S.refRow, S.refLast]}>
                  <Text style={S.refKey}>Submitted At</Text>
                  <Text style={S.refVal}>{fmtDate(invoice.asp_submitted_at)} UTC</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Notes ──────────────────────────────────────────── */}
          {!!invoice.notes && (
            <View style={S.notesBox}>
              <Text style={S.notesLbl}>NOTES</Text>
              <Text style={S.notesTxt}>{invoice.notes}</Text>
            </View>
          )}

        </View>{/* /body */}

        {/* ── Footer ────────────────────────────────────────────── */}
        <View style={S.footer}>
          <View style={S.footerLeft}>
            <Text style={S.footerTxt}>
              {'Computer-generated tax invoice  •  UAE Federal Decree-Law No. 8 of 2017 on VAT\n'}
              <Text>{'Issuer TRN: '}</Text>
              <Text style={S.footerBold}>{company?.trn || invoice.company_trn}</Text>
              {'   •   Taxable Amount: '}
              {invoice.currency} {fmt(invoice.taxable_amount)}
              {'   •   Generated: '}
              {fmtDate(invoice.created_at)}
            </Text>
          </View>
          <View style={S.footerRight}>
            {['PEPPOL BIS 3.0', 'UBL 2.1', 'FTA'].map((b) => (
              <View key={b} style={S.fbadge}>
                <Text style={S.fbadgeTxt}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

      </Page>
    </Document>
  )
}
