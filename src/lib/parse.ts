import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
import { marked } from 'marked'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { escapeHtml } from './util'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface ParsedDocument {
  html: string
  /** First heading or filename, used to pre-fill the title */
  title: string
  warnings: string[]
}

export const ACCEPTED = '.docx,.pdf,.md,.markdown,.txt'

export function clean(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** Pull the first <h1> out of the body so it is not repeated under the post title. */
function extractTitle(html: string, fallback: string): { html: string; title: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const h1 = doc.body.querySelector('h1')
  if (!h1) return { html, title: fallback }
  const title = (h1.textContent ?? '').trim() || fallback
  h1.remove()
  return { html: doc.body.innerHTML, title }
}

function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
}

async function parseDocx(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const { html, title } = extractTitle(clean(result.value), baseName(file))
  return { html, title, warnings: result.messages.map((m) => m.message) }
}

async function parseMarkdown(file: File): Promise<ParsedDocument> {
  const text = await file.text()
  const { html, title } = extractTitle(clean(await marked.parse(text)), baseName(file))
  return { html, title, warnings: [] }
}

async function parsePlainText(file: File): Promise<ParsedDocument> {
  const text = await file.text()
  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return { html, title: baseName(file), warnings: [] }
}

interface Line {
  text: string
  size: number
  y: number
}

async function parsePdf(file: File): Promise<ParsedDocument> {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const lines: Line[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await (await pdf.getPage(p)).getTextContent()
    let current: Line | null = null
    for (const item of page.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const size = Math.round(item.height * 10) / 10
      if (current && Math.abs(current.y - y) < 2) {
        current.text += ' ' + item.str.trim()
        current.size = Math.max(current.size, size)
      } else {
        if (current) lines.push(current)
        current = { text: item.str.trim(), size, y }
      }
    }
    if (current) lines.push(current)
  }

  // The most common line size is the body text; noticeably bigger lines become headings.
  const counts = new Map<number, number>()
  for (const l of lines) counts.set(l.size, (counts.get(l.size) ?? 0) + 1)
  const body = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const maxSize = Math.max(...lines.map((l) => l.size), 0)

  const out: string[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(`<p>${escapeHtml(para.join(' '))}</p>`)
    para = []
  }

  for (const l of lines) {
    const isHeading = body > 0 && l.size > body * 1.15 && l.text.length < 120
    if (isHeading) {
      flush()
      const tag = l.size >= maxSize && maxSize > body * 1.5 ? 'h1' : l.size > body * 1.4 ? 'h2' : 'h3'
      out.push(`<${tag}>${escapeHtml(l.text)}</${tag}>`)
    } else if (/^[•●▪\-–]\s+/.test(l.text)) {
      flush()
      out.push(`<ul><li>${escapeHtml(l.text.replace(/^[•●▪\-–]\s+/, ''))}</li></ul>`)
    } else {
      para.push(l.text)
      if (/[.!?:]$/.test(l.text) && l.text.length < 60) flush()
    }
  }
  flush()

  const merged = out.join('\n').replace(/<\/ul>\s*<ul>/g, '')
  const { html, title } = extractTitle(clean(merged), baseName(file))
  return {
    html,
    title,
    warnings: ['PDF text has no real structure. Headings were guessed from font size, so please review the result.'],
  }
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'docx':
      return parseDocx(file)
    case 'pdf':
      return parsePdf(file)
    case 'md':
    case 'markdown':
      return parseMarkdown(file)
    case 'txt':
      return parsePlainText(file)
    default:
      throw new Error(`Unsupported file type: .${ext}. Use DOCX, PDF, Markdown or TXT.`)
  }
}
