export interface EmailTemplate {
  to: string
  cc: string
  bcc: string
  replyTo: string
  subject: string
  /** HTML generado por el editor de texto enriquecido. */
  body: string
}

export type TemplateField = keyof EmailTemplate

export const FIELD_LABELS: Record<TemplateField, string> = {
  to: 'To',
  cc: 'Cc',
  bcc: 'Bcc',
  replyTo: 'Reply-To',
  subject: 'Subject',
  body: 'Body',
}

export const EMPTY_TEMPLATE: EmailTemplate = {
  to: '',
  cc: '',
  bcc: '',
  replyTo: '',
  subject: '',
  body: '<p></p>',
}
