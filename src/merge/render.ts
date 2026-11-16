import { Liquid, type Template } from 'liquidjs'
import MarkdownIt from 'markdown-it'
import { MAX_ATTACHMENTS_SIZE, toAttachment, type ResolvedAttachment } from '../attachments/resolve.ts'
import { findPath, formatSize, hasGlob, splitPath, type AttachmentTree } from '../attachments/tree.ts'
import type { Row } from './dataset.ts'
import { titlecase } from './normalize.ts'
import { FIELD_LABELS, type EmailTemplate, type TemplateField } from './template.ts'

function createEngine(escapeHtml: boolean) {
  const engine = new Liquid({
    strictVariables: true,
    strictFilters: true,
    outputEscape: escapeHtml ? 'escape' : undefined,
  })
  engine.registerFilter('titlecase', titlecase)
  return engine
}

// Los campos de texto plano no se escapan; en el cuerpo HTML los valores sí.
const textEngine = createEngine(false)
const htmlEngine = createEngine(true)

// Sin HTML crudo; sin typographer, que cambiaría las comillas de las etiquetas Liquid.
const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/**
 * El cuerpo llega como HTML, así que `{% if a > 1 %}` llega como `{% if a &gt; 1 %}`.
 * Se decodifican las entidades solo dentro de las etiquetas Liquid.
 */
function decodeLiquidTags(html: string): string {
  return html.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, (tag) =>
    tag.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity]).replaceAll(' ', ' '),
  )
}

/**
 * HTML del cuerpo antes de aplicar Liquid. El Markdown se convierte primero, una sola vez,
 * para que los valores de la planilla nunca se interpreten como Markdown.
 */
function bodyHtml(template: EmailTemplate): string {
  return template.format === 'markdown' ? markdown.render(template.markdown) : template.body
}

const FIELDS = Object.keys(FIELD_LABELS) as TemplateField[]
export const ADDRESS_FIELDS: TemplateField[] = ['to', 'cc', 'bcc', 'replyTo']

export interface CompiledTemplate {
  fields: Partial<Record<TemplateField, Template[]>>
  /** Una entrada por ruta de adjunto; templates null si la ruta tiene un error de sintaxis. */
  attachments: { templates: Template[] | null; required: boolean }[]
  /** Errores de sintaxis; si hay alguno, ningún correo se puede renderizar. */
  errors: string[]
}

export function compileTemplate(template: EmailTemplate): CompiledTemplate {
  const compiled: CompiledTemplate = { fields: {}, attachments: [], errors: [] }
  for (const field of FIELDS) {
    try {
      compiled.fields[field] =
        field === 'body' ? htmlEngine.parse(decodeLiquidTags(bodyHtml(template))) : textEngine.parse(template[field])
    } catch (e) {
      compiled.errors.push(`${FIELD_LABELS[field]}: ${(e as Error).message}`)
    }
  }
  template.attachments.forEach(({ path, required }, i) => {
    try {
      compiled.attachments.push({ templates: textEngine.parse(path), required })
    } catch (e) {
      compiled.attachments.push({ templates: null, required })
      compiled.errors.push(`Attachment ${i + 1}: ${(e as Error).message}`)
    }
  })
  return compiled
}

export type ProblemField = TemplateField | 'attachments'

export const PROBLEM_LABELS: Record<ProblemField, string> = { ...FIELD_LABELS, attachments: 'Attachments' }

export interface Problem {
  field: ProblemField
  message: string
}

export type RenderedEmail = Record<TemplateField, string> & {
  index: number
  attachments: ResolvedAttachment[]
  /** Rutas opcionales que no se encontraron: el correo sale sin esos adjuntos. */
  skippedAttachments: string[]
  problems: Problem[]
}

const EMAIL_PATTERN = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

/** Separa "a@x.com, Nombre <b@y.com>" en direcciones; acepta coma o punto y coma. */
export function splitAddresses(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function addressOf(entry: string): string {
  return entry.match(/<([^>]*)>\s*$/)?.[1].trim() ?? entry
}

function resolveAttachments(compiled: CompiledTemplate, row: Row, tree: AttachmentTree | null, email: RenderedEmail) {
  compiled.attachments.forEach(({ templates, required }, i) => {
    if (!templates) return
    const problem = (message: string) => email.problems.push({ field: 'attachments', message })
    // Opcional y sin archivo: no es un problema, el correo sale sin ese adjunto.
    const missing = (path: string, message: string) =>
      required ? problem(message) : email.skippedAttachments.push(path || `path ${i + 1}`)
    let path: string
    try {
      path = (textEngine.renderSync(templates, row) as string).trim()
    } catch (e) {
      problem(`path ${i + 1}: ${(e as Error).message}`)
      return
    }
    if (splitPath(path).length === 0) return missing(path, `path ${i + 1} is empty.`)
    if (!tree) return missing(path, `"${path}": no files loaded.`)

    const matches = findPath(tree, path)
    if (matches.length === 0) return missing(path, `"${path}" not found.`)
    // Sin comodines debe haber un solo resultado; Drive permite nombres repetidos.
    if (!hasGlob(path) && matches.length > 1) return problem(`"${path}" matches ${matches.length} items with the same name.`)
    email.attachments.push(...matches.map(toAttachment))
  })

  const total = email.attachments.reduce((sum, attachment) => sum + attachment.size, 0)
  if (total > MAX_ATTACHMENTS_SIZE) {
    email.problems.push({ field: 'attachments', message: `${formatSize(total)} in total; Gmail allows up to 25 MB.` })
  }
}

export function renderEmail(compiled: CompiledTemplate, row: Row, index: number, tree: AttachmentTree | null): RenderedEmail {
  const email: RenderedEmail = {
    index,
    attachments: [],
    skippedAttachments: [],
    problems: [],
    to: '',
    cc: '',
    bcc: '',
    replyTo: '',
    subject: '',
    body: '',
  }

  for (const field of FIELDS) {
    const templates = compiled.fields[field]
    if (!templates) continue
    try {
      const output = (field === 'body' ? htmlEngine : textEngine).renderSync(templates, row) as string
      email[field] = field === 'body' ? output : output.trim()
    } catch (e) {
      email.problems.push({ field, message: (e as Error).message })
    }
  }

  const failed = new Set(email.problems.map((problem) => problem.field))
  if (!email.to && !failed.has('to')) email.problems.push({ field: 'to', message: 'no recipient.' })
  if (!email.subject && !failed.has('subject')) email.problems.push({ field: 'subject', message: 'is empty.' })
  for (const field of ADDRESS_FIELDS) {
    for (const entry of splitAddresses(email[field])) {
      if (!EMAIL_PATTERN.test(addressOf(entry))) {
        email.problems.push({ field, message: `"${entry}" is not a valid email address.` })
      }
    }
  }
  resolveAttachments(compiled, row, tree, email)
  return email
}
