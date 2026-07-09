/**
 * generate-pdf.ts — Server-side PDF generation entry point
 *
 * Reads invoice JSON from stdin, generates PDF using @react-pdf/renderer,
 * and writes PDF bytes to stdout.
 *
 * Usage:
 *   echo '{"invoice":...,"company":...,"qrCode":"data:image/..."}' | tsx generate-pdf.ts
 *
 * Exit codes:
 *   0 = success (PDF bytes on stdout)
 *   1 = error (message on stderr)
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from './invoice-pdf'

interface InputData {
  invoice: any
  company: any
  qrCode?: string
}

async function main() {
  // Read all stdin
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  let raw = Buffer.concat(chunks).toString('utf-8')
  // Strip UTF-8 BOM if present (Windows/Python may send it)
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1)
  }

  if (!raw.trim()) {
    process.stderr.write('Error: No input data received on stdin.\n')
    process.exit(1)
  }

  let data: InputData
  try {
    data = JSON.parse(raw)
  } catch (e: any) {
    process.stderr.write(`Error: Invalid JSON input — ${e.message}\n`)
    process.exit(1)
  }

  if (!data.invoice) {
    process.stderr.write('Error: Missing "invoice" field in input.\n')
    process.exit(1)
  }

  try {
    const element = React.createElement(InvoicePDF, {
      invoice: data.invoice,
      company: data.company || null,
      qrCode: data.qrCode || '',
    })

    const buffer = await renderToBuffer(element)

    // Write PDF bytes to stdout
    process.stdout.write(buffer)
  } catch (e: any) {
    process.stderr.write(`Error: PDF generation failed — ${e.message}\n${e.stack}\n`)
    process.exit(1)
  }
}

main()
