import { Alert, Anchor, Badge, Grid, Group, List, ScrollArea, SegmentedControl, Stack, Text, UnstyledButton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useState, type ReactNode } from 'react'
import type { ResolvedAttachment } from '../attachments/resolve.ts'
import { formatSize } from '../attachments/tree.ts'
import { PROBLEM_LABELS, type RenderedEmail } from '../merge/render.ts'
import { FIELD_LABELS } from '../merge/template.ts'
import classes from './ReviewView.module.css'

interface Props {
  emails: RenderedEmail[]
  templateErrors: string[]
  problemCount: number
  /** Panel de envío, debajo de la lista. */
  sendPanel: ReactNode
}

type Filter = 'all' | 'problems'
type Device = 'desktop' | 'mobile'

const ADDRESS_FIELDS = ['to', 'cc', 'bcc', 'replyTo'] as const

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function PaperclipIcon() {
  return (
    <svg {...iconProps} width={13} height={13} viewBox="0 0 24 24">
      <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
    </svg>
  )
}

function FileIcon({ zip }: { zip: boolean }) {
  return (
    <svg {...iconProps} width={14} height={14} viewBox="0 0 24 24" strokeWidth={1.75} style={{ flex: 'none' }}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      {zip && <path d="M10 9v1M10 12v1M10 15v1" />}
    </svg>
  )
}

/** El HTML se aísla en un iframe sin scripts (ver docs/spec-acceso-google.md, sección 4). */
function EmailBody({ html, device }: { html: string; device: Device }) {
  const [height, setHeight] = useState(120)
  return (
    <div className={classes.paper} data-mobile={device === 'mobile' || undefined}>
      <iframe
        title="Email body"
        sandbox="allow-same-origin"
        srcDoc={`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:16px;color:#222;background:#fff;overflow-wrap:anywhere}</style>${html}`}
        style={{ height }}
        onLoad={(event) => {
          const document = event.currentTarget.contentDocument
          if (document) setHeight(document.documentElement.scrollHeight)
        }}
      />
    </div>
  )
}

function AttachmentChips({ attachments }: { attachments: ResolvedAttachment[] }) {
  return (
    <div className={classes.chips}>
      {attachments.map((attachment, i) => {
        const title = (
          <span className={classes.chipTitle}>
            <FileIcon zip={attachment.kind === 'zip'} />
            <span className={classes.chipName}>{attachment.filename}</span>
            <span className={classes.chipSize}>{formatSize(attachment.size)}</span>
          </span>
        )
        return attachment.kind === 'zip' ? (
          // Un ZIP se expande para ver qué archivos incluye.
          <details key={i} className={classes.chip}>
            <summary title={`${attachment.files.length} files, click to list them`}>{title}</summary>
            <ul className={classes.zipFiles}>
              {attachment.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </details>
        ) : (
          <span key={i} className={classes.chip}>
            {title}
          </span>
        )
      })}
    </div>
  )
}

function EmailRow({ email }: { email: RenderedEmail }) {
  return (
    <div className={classes.row}>
      <span className={classes.number}>#{email.index + 1}</span>
      <div className={classes.lines}>
        <div className={email.to ? classes.recipient : `${classes.recipient} ${classes.missing}`}>
          {email.to || 'No recipient'}
        </div>
        <div className={email.subject ? classes.subjectLine : `${classes.subjectLine} ${classes.missing}`}>
          {email.subject || 'No subject'}
        </div>
      </div>
      <div className={classes.trailing}>
        {email.attachments.length > 0 && (
          <span className={classes.clip} title={`${email.attachments.length} attachments`}>
            <PaperclipIcon />
            {email.attachments.length}
          </span>
        )}
        {email.problems.length > 0 && (
          <Badge color="red" size="sm" circle title={`${email.problems.length} problems`}>
            {email.problems.length}
          </Badge>
        )}
      </div>
    </div>
  )
}

function EmailDetail({ email, device }: { email: RenderedEmail; device: Device }) {
  const fieldsWithProblems = new Set(email.problems.map((problem) => problem.field))
  return (
    <Stack gap="sm">
      {email.problems.length > 0 && (
        <Alert color="red" p="xs" title="Fix before sending">
          <List size="sm">
            {email.problems.map((problem) => {
              const text = `${PROBLEM_LABELS[problem.field]}: ${problem.message}`
              return <List.Item key={text}>{text}</List.Item>
            })}
          </List>
        </Alert>
      )}

      <h3 className={classes.subject}>{email.subject || <span className={classes.missing}>No subject</span>}</h3>

      <dl className={classes.headers}>
        {ADDRESS_FIELDS.filter((field) => email[field] || field === 'to').map((field) => (
          <div key={field} style={{ display: 'contents' }}>
            <dt>{FIELD_LABELS[field]}</dt>
            <dd data-problem={fieldsWithProblems.has(field) || undefined}>{email[field] || '—'}</dd>
          </div>
        ))}
      </dl>

      {email.attachments.length > 0 && <AttachmentChips attachments={email.attachments} />}

      <EmailBody html={email.body} device={device} />
    </Stack>
  )
}

export function ReviewView({ emails, templateErrors, problemCount, sendPanel }: Props) {
  // Por defecto se muestra el primer correo como ejemplo.
  const [selected, setSelected] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [device, setDevice] = useState<Device>('desktop')
  const reducedMotion = useReducedMotion()

  const withProblems = emails.filter((email) => email.problems.length > 0)
  // Si ya no quedan problemas, el filtro vuelve solo a "All".
  const activeFilter: Filter = withProblems.length === 0 ? 'all' : filter
  const visible = activeFilter === 'problems' ? withProblems : emails
  const current = emails.find((email) => email.index === selected) ?? visible[0]

  function select(index: number) {
    setSelected(index)
    requestAnimationFrame(() =>
      document
        .getElementById(`email-${index}`)
        ?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }),
    )
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" gap="xs">
        <SegmentedControl
          size="xs"
          aria-label="Show emails"
          value={activeFilter}
          onChange={(value) => setFilter(value as Filter)}
          data={[
            { value: 'all', label: `All ${emails.length}` },
            { value: 'problems', label: `Needs fixing ${problemCount}`, disabled: problemCount === 0 },
          ]}
        />
        <SegmentedControl
          size="xs"
          aria-label="Body width"
          value={device}
          onChange={(value) => setDevice(value as Device)}
          data={[
            { value: 'desktop', label: 'Desktop' },
            { value: 'mobile', label: 'Mobile' },
          ]}
        />
      </Group>

      {templateErrors.length > 0 && (
        <Alert color="red" title="Fix the template to see the emails">
          <List size="sm">
            {templateErrors.map((error) => (
              <List.Item key={error}>{error}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      {withProblems.length > 0 && (
        <Alert color="red" variant="light" p="xs">
          <Text size="sm">
            {withProblems.length === 1 ? '1 email needs' : `${withProblems.length} emails need`} fixing before
            sending:{' '}
            {withProblems.map((email, i) => (
              <span key={email.index}>
                {i > 0 && ', '}
                <Anchor component="button" type="button" size="sm" c="red" onClick={() => select(email.index)}>
                  #{email.index + 1}
                </Anchor>
              </span>
            ))}
          </Text>
        </Alert>
      )}

      {emails.length === 0 && templateErrors.length === 0 ? (
        <Text c="dimmed" size="sm">
          Choose a spreadsheet in Edit to preview one email per row.
        </Text>
      ) : (
        <Grid gap="md">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto" offsetScrollbars="present">
                <div className={classes.list} role="listbox" aria-label="Emails">
                  {visible.map((email) => (
                    <UnstyledButton
                      key={email.index}
                      id={`email-${email.index}`}
                      className={classes.item}
                      role="option"
                      aria-selected={email.index === current?.index}
                      data-selected={email.index === current?.index || undefined}
                      onClick={() => setSelected(email.index)}
                    >
                      <EmailRow email={email} />
                    </UnstyledButton>
                  ))}
                </div>
              </ScrollArea.Autosize>
              {sendPanel}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            {current && (
              <div className={classes.detail}>
                <EmailDetail key={current.index} email={current} device={device} />
              </div>
            )}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  )
}
