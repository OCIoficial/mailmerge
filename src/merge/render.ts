import { Liquid, type Template } from 'liquidjs'
import type { Row } from './dataset.ts'
import { FIELD_LABELS, type EmailTemplate, type TemplateField } from './template.ts'

/** "juan PÉREZ o'higgins" → "Juan Pérez O'Higgins" */
export function titlecase(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase())
}

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

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

/**
 * El editor guarda HTML, así que `{% if a > 1 %}` llega como `{% if a &gt; 1 %}`.
 * Se decodifican las entidades solo dentro de las etiquetas Liquid.
 */
function decodeLiquidTags(html: string): string {
  return html.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, (tag) =>
    tag.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity]).replaceAll('\u00a0', ' '),
  )
}

const FIELDS = Object.keys(FIELD_LABELS) as TemplateField[]
export const ADDRESS_FIELDS: TemplateField[] = ['to', 'cc', 'bcc', 'replyTo']

export interface CompiledTemplate {
  fields: Partial<Record<TemplateField, Template[]>>
  /** Errores de sintaxis; si hay alguno, ningún correo se puede renderizar. */
  errors: string[]
}

export function compileTemplate(template: EmailTemplate): CompiledTemplate {
  const compiled: CompiledTemplate = { fields: {}, errors: [] }
  for (const field of FIELDS) {
    try {
      compiled.fields[field] =
        field === 'body' ? htmlEngine.parse(decodeLiquidTags(template.body)) : textEngine.parse(template[field])
    } catch (e) {
      compiled.errors.push(`${FIELD_LABELS[field]}: ${(e as Error).message}`)
    }
  }
  return compiled
}

export interface Problem {
  field: TemplateField
  message: string
}

export interface RenderedEmail extends EmailTemplate {
  index: number
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

export function renderEmail(compiled: CompiledTemplate, row: Row, index: number): RenderedEmail {
  const email: RenderedEmail = { index, problems: [], to: '', cc: '', bcc: '', replyTo: '', subject: '', body: '' }

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
  return email
}
