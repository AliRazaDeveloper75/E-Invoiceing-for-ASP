/**
 * InvoicePDF v5 — Premium UAE Tax Invoice
 *
 * react-pdf constraints:
 *  • NO gap / rowGap / columnGap  — use marginRight on siblings
 *  • NO flex:1 on page body       — blank-page-1 bug
 *  • NO border shorthand          — per-side only
 *  • NO gradients                 — solid colors only
 *  • Image src must be absolute URL or data URI
 */

import React, { useEffect, useState } from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Rect, Circle, Line } from '@react-pdf/renderer'
import type { Company, Invoice } from '@/types'
import QRCodeLib from 'qrcode'

const C = {
  navy:     '#0f2557',
  navyDk:   '#091840',
  navyLt:   '#1a3a7a',
  navyBd:   '#1e3e7e',
  navyTint: '#f0f4ff',

  teal:     '#0d9488',
  tealLt:   '#14b8a6',
  tealTint: '#f0fdfa',

  gold:     '#d97706',
  goldTint: '#fffbeb',

  ink:   '#0f172a',
  n800:  '#1e293b',
  n700:  '#334155',
  n600:  '#475569',
  n500:  '#64748b',
  n400:  '#94a3b8',
  n300:  '#cbd5e1',
  n200:  '#e2e8f0',
  n100:  '#f1f5f9',
  n50:   '#f8fafc',
  white: '#ffffff',

  okBg: '#f0fdf4', okFg: '#166534',
  erBg: '#fef2f2', erFg: '#991b1b',
  waBg: '#fffbeb', waFg: '#92400e',
  blBg: '#eff6ff', blFg: '#1d4ed8',
  muBg: '#f1f5f9', muFg: '#475569',
  red:  '#dc2626',
  blue: '#2563eb',
}

const S = StyleSheet.create({

  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.ink,
    backgroundColor: C.white,
    position: 'relative',
    paddingBottom: 60,
  },

  topBar: { height: 5, backgroundColor: C.navy },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: C.navy,
  },
  hdrLeft:  { flex: 1, paddingRight: 20 },
  hdrRight: { width: 200, alignItems: 'flex-end' },

  coLogoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  coLogoImg: {
    width: 46, height: 46,
    borderRadius: 6,
    objectFit: 'contain',
    marginRight: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.navyBd,
  },
  coMark: {
    width: 46, height: 46,
    backgroundColor: C.teal,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  coMarkLetter: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.white },

  coNameBlock: { flex: 1, justifyContent: 'center' },
  coName:      { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 1 },
  coLegal:     { fontSize: 7, color: C.n300 },

  coInfoRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  coInfoKey:    { width: 36, fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.6 },
  coInfoVal:    { flex: 1, fontSize: 7, color: C.white, marginLeft: 2 },

  invTypeLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.tealLt, letterSpacing: 1.5, marginBottom: 3 },
  invTitle:     { fontSize: 30, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 2, marginBottom: 2 },
  invNum:       { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.n300, marginBottom: 10 },

  badge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 3, marginBottom: 10 },
  badgeTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  amtLbl: { fontSize: 6, color: C.n400, marginBottom: 2, letterSpacing: 0.5 },
  amtVal: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.white },
  amtCur: { fontSize: 8, color: C.tealLt, marginTop: 1 },

  // ── Date strip ────────────────────────────────────────────────────────────
  strip: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.n200,
  },
  stripCell: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 0,
    paddingBottom: 0,
    borderRightWidth: 1,
    borderRightColor: C.n200,
  },
  stripCellLast: { borderRightWidth: 0 },
  stripAccent: { height: 3, backgroundColor: C.navy, marginBottom: 0 },
  stripCellBody: { flexDirection: 'row', flex: 1, paddingTop: 10, paddingBottom: 10 },
  stripIconCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.navyTint,
    borderRadius: 4,
    marginRight: 8,
    height: 24,
  },
  stripContentCol: { flex: 1, justifyContent: 'center' },
  stripKey: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.8, marginBottom: 2 },
  stripVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },

  // ── Credit note banner ────────────────────────────────────────────────────
  crBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 30,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 7,
    backgroundColor: C.goldTint,
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 4,
  },
  crLbl: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gold },
  crVal: { fontSize: 7, color: '#9a3412' },

  // ── Party cards ───────────────────────────────────────────────────────────
  partiesRow: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginBottom: 16,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
  },
  partyCardLeft: { marginRight: 12 },

  partyHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.n200,
  },
  partyMark: {
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 7,
  },
  partyMarkImg: {
    width: 22, height: 22,
    borderRadius: 11,
    objectFit: 'contain',
    marginRight: 7,
    backgroundColor: C.white,
  },
  partyHdrLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 },

  partyBody:    { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  partyField:   { minHeight: 14 },
  partyName:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 1 },
  partyLegal:   { fontSize: 7, color: C.n500, marginBottom: 4 },
  partyAddr:    { fontSize: 7, color: C.n700, lineHeight: 1.6 },
  partyTrnRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  partyTrnKey:  { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.tealLt, letterSpacing: 0.3, width: 28 },
  partyTrnVal:  { fontSize: 7.5, fontFamily: 'Courier', color: C.navy },
  partyContact: { fontSize: 6.5, color: C.n500 },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableWrap: {
    marginHorizontal: 30,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thead: { flexDirection: 'row', backgroundColor: C.navy },
  th: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 0.6,
    borderRightWidth: 1,
    borderRightColor: C.navyBd,
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

  tdBold:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 2 },
  tdSub:   { fontSize: 7, color: C.n500, lineHeight: 1.5, marginBottom: 4 },
  tdNum:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.n800 },
  tdMuted: { fontSize: 7, color: C.n500 },
  tdTotal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.navy },
  tdIdx:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.n400 },

  vatPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2 },
  vatTxt:  { fontSize: 6, fontFamily: 'Helvetica-Bold' },

  // ── Totals ────────────────────────────────────────────────────────────────
  totOuter: { flexDirection: 'row', marginHorizontal: 30, marginBottom: 0 },
  totLeft:  { flex: 1, paddingRight: 14 },

  notesBox: {
    borderWidth: 1,
    borderColor: C.n200,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 9,
    backgroundColor: C.goldTint,
  },
  notesLbl: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.gold, letterSpacing: 0.7, marginBottom: 4 },
  notesTxt: { fontSize: 7, color: C.n700, lineHeight: 1.6 },

  qrCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
  },
  qrCardHdr: {
    backgroundColor: C.navy,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
  },
  qrCardHdrTxt: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.tealLt,
    letterSpacing: 0.8,
  },
  qrCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrCardImgWrap: {
    width: 76,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCardImg: {
    width: 60,
    height: 60,
  },
  qrCardDetails: {
    flex: 1,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  qrCardLine: {
    fontSize: 6,
    color: C.n500,
    lineHeight: 1.9,
  },
  qrCardStrong: {
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },

  totRight: {
    width: '50%',
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
  },
  totRowsWrap: { flex: 1 },
  totRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.n100 },
  totKey:    { flex: 1, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7, fontSize: 7.5, color: C.n500 },
  totVal:    { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.ink, textAlign: 'right', minWidth: 100 },
  totRedKey: { color: C.red },
  totRedVal: { color: C.red },
  totBluKey: { color: C.blue },
  totBluVal: { color: C.blue },

  totGrand:    { flexDirection: 'row', backgroundColor: C.navy },
  totGrandKey: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.tealLt },
  totGrandVal: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, textAlign: 'right', minWidth: 100 },

  totPaidRow: { flexDirection: 'row', backgroundColor: C.okBg },
  totPaidKey: { flex: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, fontSize: 7.5, color: C.okFg },
  totPaidVal: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.okFg, textAlign: 'right', minWidth: 100 },

  totBalRow: { flexDirection: 'row', backgroundColor: C.erBg },
  totBalKey: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.erFg },
  totBalVal: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.erFg, textAlign: 'right', minWidth: 100 },

  // ── Bottom info bar (due date / type / issuer trn) ────────────────────────
  botInfoBar: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: C.navyTint,
  },
  botInfoCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderRightWidth: 1,
    borderRightColor: C.n200,
  },
  botInfoCellLast: { borderRightWidth: 0 },
  botInfoKey:  { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.6, marginBottom: 2 },
  botInfoVal:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.n800 },
  botInfoMono: { fontSize: 7, fontFamily: 'Courier', color: C.n800 },
  botInfoQrCell: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    paddingBottom: 5,
    backgroundColor: C.navyTint,
  },
  botInfoQrImg: { width: 48, height: 48 },

  // ── QR + payment info bar ─────────────────────────────────────────────────
  infoBar: {
    flexDirection: 'row',
    marginHorizontal: 30,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: C.white,
  },
  qrCell: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: C.navyTint,
    borderRightWidth: 1,
    borderRightColor: C.n200,
  },
  qrBox: {
    width: 36, height: 36,
    borderWidth: 1.5,
    borderColor: C.n300,
    borderRadius: 3,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 18, height: 18 },
  qrDot:  { width: 5, height: 5, backgroundColor: C.navy, margin: 1, borderRadius: 1 },
  qrCap:  { fontSize: 5.5, color: C.n500, textAlign: 'center' },

  payCell:     { flex: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, borderRightWidth: 1, borderRightColor: C.n200 },
  payCellLast: { borderRightWidth: 0 },
  payKey:  { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.n400, letterSpacing: 0.6, marginBottom: 2 },
  payVal:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.n800 },
  payMono: { fontSize: 7, fontFamily: 'Courier', color: C.n800 },

  // ── ASP refs ──────────────────────────────────────────────────────────────
  refBox: {
    marginHorizontal: 30,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: C.n200,
    borderRadius: 6,
    overflow: 'hidden',
  },
  refHdr:    { backgroundColor: C.n50, borderBottomWidth: 1, borderBottomColor: C.n200, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5 },
  refHdrTxt: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.n500, letterSpacing: 0.6 },
  refRow:    { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.n100 },
  refRowLast:{ borderBottomWidth: 0 },
  refKey:    { width: '34%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.n400 },
  refVal:    { flex: 1, fontSize: 7, fontFamily: 'Courier', color: C.n700 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: C.navy,
  },
  footerLeft: { flex: 1, paddingRight: 10 },
  footerTxt:  { fontSize: 6, color: C.n400, lineHeight: 1.7 },
  footerBold: { fontFamily: 'Helvetica-Bold', color: C.n300 },

  footerPills: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    borderWidth: 1,
    borderColor: C.navyBd,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: C.navyLt,
    marginLeft: 4,
  },
  pillTxt: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: C.tealLt },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: C.teal },
})

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

function fmt(v: string | number | null | undefined, dec = 2): string {
  if (v == null || v === '') return '\u2014'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-AE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014'
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

const nonZero = (v: string | number | null | undefined) =>
  v != null && v !== '' && Number(v) !== 0

function CoInfoRow({ icon, v }: { icon: string; v?: string | null }) {
  if (!v) return null
  return (
    <View style={S.coInfoRow}>
      <View style={{ width: 16, alignItems: 'center', marginRight: 4 }}>
        <CoInfoIcon type={icon} />
      </View>
      <Text style={S.coInfoVal}>{v}</Text>
    </View>
  )
}

function CoInfoIcon({ type }: { type: string }) {
  const p = { width: 10, height: 10, viewBox: '0 0 24 24' } as const
  const s = C.white
  if (type === 'phone') {
    return (
      <Svg {...p}>
        <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  if (type === 'email') {
    return (
      <Svg {...p}>
        <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={s} strokeWidth="1.5" />
        <Path d="M22 7l-10 7L2 7" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  if (type === 'address') {
    return (
      <Svg {...p}>
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="12" cy="10" r="3" fill="none" stroke={s} strokeWidth="1.5" />
      </Svg>
    )
  }
  if (type === 'trn') {
    return (
      <Svg {...p}>
        <Rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={s} strokeWidth="1.5" />
        <Path d="M9 8h6" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M9 12h6" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M9 16h4" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    )
  }
  if (type === 'web') {
    return (
      <Svg {...p}>
        <Circle cx="12" cy="12" r="10" fill="none" stroke={s} strokeWidth="1.5" />
        <Path d="M2 12h20" fill="none" stroke={s} strokeWidth="1.5" />
        <Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" fill="none" stroke={s} strokeWidth="1.5" />
      </Svg>
    )
  }
  return null
}

function StripIcon({ type }: { type: string }) {
  const props = { width: 13, height: 13, viewBox: '0 0 24 24' } as const
  const fill = C.navy
  if (type === 'calendar') {
    return (
      <Svg {...props}>
        <Rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke={fill} strokeWidth="1.5" />
        <Line x1="8" y1="2" x2="8" y2="6" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="16" y1="2" x2="16" y2="6" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="3" y1="10" x2="21" y2="10" stroke={fill} strokeWidth="1.5" />
      </Svg>
    )
  }
  if (type === 'dollar') {
    return (
      <Svg {...props}>
        <Path d="M12 2v20" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    )
  }
  if (type === 'tag') {
    return (
      <Svg {...props}>
        <Path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="none" stroke={fill} strokeWidth="1.5" />
        <Circle cx="7" cy="7" r="1.5" fill={fill} />
      </Svg>
    )
  }
  if (type === 'document') {
    return (
      <Svg {...props}>
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 2v6h6" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Line x1="9" y1="13" x2="15" y2="13" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="9" y1="17" x2="13" y2="17" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    )
  }
  return null
}

function SCell({ label, value, last, icon }: { label: string; value: string; last?: boolean; icon?: string }) {
  return (
    <View style={[S.stripCell, ...(last ? [S.stripCellLast] : [])]}>
      <View style={S.stripAccent} />
      <View style={S.stripCellBody}>
        {icon && (
          <View style={S.stripIconCol}>
            <StripIcon type={icon} />
          </View>
        )}
        <View style={S.stripContentCol}>
          <Text style={S.stripKey}>{label.toUpperCase()}</Text>
          <Text style={S.stripVal}>{value}</Text>
        </View>
      </View>
    </View>
  )
}

function PartyIcon({ type }: { type: string }) {
  const p = { width: 13, height: 13, viewBox: '0 0 24 24' } as const
  const fill = C.white
  if (type === 'building') {
    return (
      <Svg {...p}>
        <Rect x="3" y="7" width="18" height="14" rx="2" fill="none" stroke={fill} strokeWidth="1.5" />
        <Path d="M7 21V5l5-3 5 3v16" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 12v4h4v-4" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  if (type === 'user') {
    return (
      <Svg {...p}>
        <Circle cx="12" cy="8" r="5" fill="none" stroke={fill} strokeWidth="1.5" />
        <Path d="M3 21c0-5 4-9 9-9s9 4 9 9" fill="none" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    )
  }
  return null
}

function PartyCard({
  title, name, legal, address, trn, phone, email, isLeft, accentColor, logoUrl,
}: {
  title: string; name: string; legal?: string; address: string
  trn?: string; phone?: string; email?: string; isLeft?: boolean
  accentColor?: string; logoUrl?: string | null
}) {
  const accent  = accentColor ?? C.navy
  const iconType = title === 'Supplier' ? 'building' : 'user'

  return (
    <View style={[S.partyCard, ...(isLeft ? [S.partyCardLeft] : [])]}>
      <View style={[S.partyHdr, { backgroundColor: C.navy, borderBottomColor: C.navyBd }]}>
        {logoUrl ? (
          <Image src={logoUrl} style={S.partyMarkImg} />
        ) : (
          <View style={[S.partyMark, { backgroundColor: accent }]}>
            <PartyIcon type={iconType} />
          </View>
        )}
        <Text style={[S.partyHdrLabel, { color: C.white }]}>{title.toUpperCase()}</Text>
      </View>
      <View style={S.partyBody}>
        <View style={S.partyField}>
          {name ? <Text style={S.partyName}>{name}</Text> : null}
        </View>
        <View style={S.partyField}>
          {!!legal ? <Text style={S.partyLegal}>{legal}</Text> : null}
        </View>
        <View style={S.partyField}>
          {!!address ? <Text style={S.partyAddr}>{address}</Text> : null}
        </View>
        <View style={S.partyField}>
          {!!trn ? (
            <View style={S.partyTrnRow}>
              <Text style={S.partyTrnKey}>TRN</Text>
              <Text style={S.partyTrnVal}>{trn}</Text>
            </View>
          ) : null}
        </View>
        <View style={S.partyField}>
          {!!phone ? <Text style={S.partyContact}>{phone}</Text> : null}
        </View>
        <View style={S.partyField}>
          {!!email ? <Text style={S.partyContact}>{email}</Text> : null}
        </View>
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
        {isStd ? '5%' : isZero ? '0%' : 'Exempt'}
      </Text>
    </View>
  )
}

export interface InvoicePDFProps { invoice: Invoice; company: Company | null }

export function InvoicePDF({ invoice, company }: InvoicePDFProps) {
  const bc     = BADGE[invoice.status] ?? BADGE.draft
  const isCN   = invoice.invoice_type === 'credit_note'
  const isCS   = invoice.invoice_type === 'continuous_supply'
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

  const qrLines = [
    'E-NUMERAK',
    `INV:${invoice.invoice_number}`,
    `SELLER:${company?.name || invoice.company_name || ''}`,
    `STRN:${company?.trn || invoice.company_trn || ''}`,
    `BUYER:${invoice.customer_name || ''}`,
    `BTRN:${invoice.customer_trn || invoice.customer_vat_number || ''}`,
    `TOTAL:${invoice.currency} ${invoice.total_amount}`,
    `DATE:${invoice.issue_date || ''}`,
  ]
  const qrText = qrLines.join('|')
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    QRCodeLib.toDataURL(qrText, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''))
  }, [qrText])

  return (
    <Document title={invoice.invoice_number} author="E-Numerak">
      <Page size="A4" style={S.page}>

        {/* 1 ── Top accent bar (page 1 only — avoids duplicated header on overflow) */}
        <View style={S.topBar} />

        {/* 2 ── Header (page 1 only) */}
        <View style={S.header}>
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
            <CoInfoRow icon="phone"   v={company?.phone} />
            <CoInfoRow icon="email" v={company?.email} />
            {!!company?.street_address && (
              <CoInfoRow icon="address" v={[company.street_address, company.city, company.country || 'UAE'].filter(Boolean).join(', ')} />
            )}
            <CoInfoRow icon="trn" v={company?.trn || invoice.company_trn} />
            {!!company?.website && <CoInfoRow icon="web" v={company.website} />}
          </View>
          <View style={S.hdrRight}>
            <Text style={S.invTypeLabel}>{invTypeLabel}</Text>
            <Text style={S.invTitle}>INVOICE</Text>
            <Text style={S.invNum}>{invoice.invoice_number}</Text>
            <View style={[S.badge, { backgroundColor: bc.bg }]}>
              <Text style={[S.badgeTxt, { color: bc.fg }]}>{bc.label}</Text>
            </View>
            <Text style={S.amtLbl}>TOTAL DUE</Text>
            <Text style={S.amtVal}>{fmt(invoice.total_amount)}</Text>
            <Text style={S.amtCur}>{invoice.currency}</Text>
          </View>
        </View>

        {/* 3─9 ── Main content wrapper */}
        <View style={{ flex: 1, flexDirection: 'column' }}>

        {/* 3 ── Date / reference strip */}
        <View style={S.strip}>
          <SCell icon="calendar" label="Issue Date"  value={fmtDate(invoice.issue_date)} />
          <SCell icon="calendar" label="Due Date"    value={fmtDate(invoice.due_date)} />
          {isCS ? (
            <>
              <SCell icon="calendar" label="Period Start" value={fmtDate(invoice.supply_date)} />
              <SCell icon="calendar" label="Period End"   value={fmtDate(invoice.supply_date_end)} />
            </>
          ) : (
            <SCell icon="calendar" label="Supply Date" value={fmtDate(invoice.supply_date)} />
          )}
          <SCell icon="dollar" label="Currency" value={invoice.currency} last={!invoice.purchase_order_number} />
          {!!invoice.purchase_order_number && (
            <SCell icon="tag" label="PO Number" value={invoice.purchase_order_number} last />
          )}
        </View>

        {/* Credit note banner */}
        {isCN && !!invoice.reference_number && (
          <View style={S.crBanner}>
            <Text style={S.crLbl}>CREDIT NOTE</Text>
            <Text style={S.crVal}>  References original invoice: {invoice.reference_number}</Text>
          </View>
        )}

        {/* 4 ── Party cards */}
        <View style={S.partiesRow}>
          <PartyCard
            isLeft
            title="Supplier"
            accentColor={C.teal}
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
            <View style={[S.th, S.thC, { width: '8%' }]}><Text>VAT</Text></View>
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
                <View style={[S.td, { flex: 1, paddingLeft: 14 }]}>
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
                  <Text style={{ fontSize: 7, color: C.n400 }}>{item.unit || '\u2014'}</Text>
                </View>
                <View style={[S.td, S.tdR, { width: '12%' }]}>
                  <Text style={S.tdNum}>{fmt(item.unit_price)}</Text>
                </View>
                <View style={[S.td, S.tdC, { width: '8%' }]}>
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
                <Text style={S.notesLbl}>NOTES</Text>
                <Text style={S.notesTxt}>{invoice.notes}</Text>
              </View>
            )}
            {qrUrl && (
              <View style={S.qrCard}>
                <View style={S.qrCardHdr}>
                  <Text style={S.qrCardHdrTxt}>VERIFICATION QR CODE</Text>
                </View>
                <View style={S.qrCardBody}>
                  <View style={S.qrCardImgWrap}>
                    <Image src={qrUrl} style={S.qrCardImg} />
                  </View>
                  <View style={S.qrCardDetails}>
                    <Text style={S.qrCardLine}>
                      <Text style={S.qrCardStrong}>INV </Text>
                      {invoice.invoice_number}
                    </Text>
                    <Text style={S.qrCardLine}>
                      <Text style={S.qrCardStrong}>SELLER </Text>
                      {company?.name || invoice.company_name || ''}
                    </Text>
                    <Text style={S.qrCardLine}>
                      <Text style={S.qrCardStrong}>TRN </Text>
                      {company?.trn || invoice.company_trn || ''}
                    </Text>
                    <Text style={S.qrCardLine}>
                      <Text style={S.qrCardStrong}>TOTAL </Text>
                      {invoice.currency} {fmt(invoice.total_amount)}
                    </Text>
                    <Text style={S.qrCardLine}>
                      <Text style={S.qrCardStrong}>DATE </Text>
                      {fmtDate(invoice.issue_date)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={S.totRight}>

            <View style={S.totRowsWrap}>

            <View style={S.totRow}>
              <Text style={S.totKey}>Subtotal</Text>
              <Text style={S.totVal}>{invoice.currency} {fmt(invoice.subtotal)}</Text>
            </View>

            <View style={S.totRow}>
              <Text style={[S.totKey, S.totRedKey]}>Discount</Text>
              <Text style={[S.totVal, S.totRedVal]}>- {invoice.currency} {fmt(invoice.discount_amount ?? 0)}</Text>
            </View>
            <View style={S.totRow}>
              <Text style={S.totKey}>Taxable Amount</Text>
              <Text style={S.totVal}>{invoice.currency} {fmt(invoice.taxable_amount)}</Text>
            </View>

            <View style={S.totRow}>
              <Text style={[S.totKey, S.totBluKey]}>VAT (5%)</Text>
              <Text style={[S.totVal, S.totBluVal]}>{invoice.currency} {fmt(invoice.total_vat)}</Text>
            </View>

            {hasPaid && (
              <View style={S.totPaidRow}>
                <Text style={S.totPaidKey}>Amount Paid</Text>
                <Text style={S.totPaidVal}>&minus; {invoice.currency} {fmt(invoice.amount_paid)}</Text>
              </View>
            )}

            {balanceDue !== null && balanceDue > 0 && (
              <View style={S.totBalRow}>
                <Text style={S.totBalKey}>Balance Due</Text>
                <Text style={S.totBalVal}>{invoice.currency} {fmt(balanceDue)}</Text>
              </View>
            )}

            </View>

            <View style={S.totGrand}>
              <Text style={S.totGrandKey}>Total Due</Text>
              <Text style={S.totGrandVal}>{invoice.currency} {fmt(invoice.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* 8 ── ASP submission refs */}
        {hasAsp && (
          <View style={S.refBox}>
            <View style={S.refHdr}>
              <Text style={S.refHdrTxt}>ELECTRONIC SUBMISSION REFERENCES  \u00B7  5-CORNER MODEL</Text>
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

        <View style={{ flex: 1 }} />

        {/* 9 ── Bottom info bar */}
        <View style={S.botInfoBar}>
          <View style={S.botInfoCell}>
            <Text style={S.botInfoKey}>DUE DATE</Text>
            <Text style={[S.botInfoVal, { color: invoice.due_date ? C.erFg : C.n700 }]}>
              {fmtDate(invoice.due_date)}
            </Text>
          </View>
          <View style={S.botInfoCell}>
            <Text style={S.botInfoKey}>TYPE</Text>
            <Text style={S.botInfoVal}>{invTypeLabel}</Text>
          </View>
          <View style={[S.botInfoCell, S.botInfoCellLast]}>
            <Text style={S.botInfoKey}>ISSUER TRN</Text>
            <Text style={S.botInfoMono}>{company?.trn || invoice.company_trn || '\u2014'}</Text>
          </View>
        </View>

        {/* 10 ── Footer */}
        </View>

        <View fixed style={S.footer}>
          <View style={S.footerLeft}>
            <Text style={S.footerTxt}>
              {'Computer-generated tax invoice  \u00B7  UAE Federal Decree-Law No. 8 of 2017\n'}
              <Text style={S.footerBold}>Issuer TRN: {company?.trn || invoice.company_trn || '\u2014'}</Text>
              {'  \u00B7  Taxable Amount: '}
              <Text style={S.footerBold}>{invoice.currency} {fmt(invoice.taxable_amount)}</Text>
              {'  \u00B7  Generated: '}{fmtDate(invoice.created_at)}
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

        {/* 11 ── Bottom teal accent bar */}
        <View fixed style={S.bottomBar} />

      </Page>
    </Document>
  )
}
