import { Accordion, Alert, Badge, Group, List, Stack, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { ResolvedAttachment } from '../attachments/resolve.ts'
import { formatSize } from '../attachments/tree.ts'
import { PROBLEM_LABELS, type RenderedEmail } from '../merge/render.ts'
import { FIELD_LABELS } from '../merge/template.ts'

interface Props {
  emails: RenderedEmail[]
  templateErrors: string[]
  problemCount: number
}

const HEADER_FIELDS = ['to', 'cc', 'bcc', 'replyTo', 'subject'] as const

/** El HTML se aísla en un iframe sin scripts (ver docs/spec-acceso-google.md, sección 4). */
function EmailBody({ html }: { html: string }) {
  const [height, setHeight] = useState(120)
  return (
    <iframe
      title="Email body"
      sandbox="allow-same-origin"
      srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:14px;margin:12px;color:#222;background:#fff}</style>${html}`}
      style={{ width: '100%', height, border: '1px solid var(--mantine-color-default-border)', borderRadius: 4 }}
      onLoad={(event) => {
        const document = event.currentTarget.contentDocument
        if (document) setHeight(document.documentElement.scrollHeight + 2)
      }}
    />
  )
}

function Attachments({ attachments }: { attachments: ResolvedAttachment[] }) {
  return (
    <Stack gap={4}>
      {attachments.map((attachment, i) =>
        attachment.kind === 'zip' ? (
          // Un ZIP se puede expandir para ver qué archivos incluye.
          <details key={i}>
            <summary style={{ cursor: 'pointer', fontSize: 'var(--mantine-font-size-sm)' }}>
              {attachment.filename}{' '}
              <Text span size="xs" c="dimmed">
                {formatSize(attachment.size)}, {attachment.files.length} files
              </Text>
            </summary>
            <List size="xs" c="dimmed" ml="md" mt={4} listStyleType="none">
              {attachment.files.map((file) => (
                <List.Item key={file} ff="monospace">
                  {file}
                </List.Item>
              ))}
            </List>
          </details>
        ) : (
          <Text key={i} size="sm">
            {attachment.filename}{' '}
            <Text span size="xs" c="dimmed">
              {formatSize(attachment.size)}
            </Text>
          </Text>
        ),
      )}
    </Stack>
  )
}

export function PreviewList({ emails, templateErrors, problemCount }: Props) {
  // Solo el primero abierto por defecto; el resto colapsado.
  const [open, setOpen] = useState<string[]>(['0'])

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={4}>Preview</Title>
        <Group gap="xs">
          <Badge variant="light">{emails.length} emails</Badge>
          {problemCount > 0 && (
            <Badge color="red" variant="light">
              {problemCount} with problems
            </Badge>
          )}
        </Group>
      </Group>

      {templateErrors.length > 0 && (
        <Alert color="red" title="Template error">
          <List size="sm">
            {templateErrors.map((error) => (
              <List.Item key={error}>{error}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      {emails.length === 0 && templateErrors.length === 0 && (
        <Text c="dimmed" size="sm">
          Choose a spreadsheet to see the emails.
        </Text>
      )}

      <Accordion multiple variant="separated" value={open} onChange={setOpen}>
        {emails.map((email) => {
          const value = String(email.index)
          return (
            <Accordion.Item key={value} value={value}>
              <Accordion.Control>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed" w={40}>
                    #{email.index + 1}
                  </Text>
                  <Text size="sm" truncate style={{ flex: 1 }}>
                    {email.to || '(no recipient)'} — {email.subject || '(no subject)'}
                  </Text>
                  {email.attachments.length > 0 && (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {email.attachments.length} {email.attachments.length === 1 ? 'attachment' : 'attachments'}
                    </Text>
                  )}
                  {email.problems.length > 0 && (
                    <Badge color="red" size="sm">
                      {email.problems.length}
                    </Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {open.includes(value) && (
                  <Stack gap="sm">
                    {email.problems.length > 0 && (
                      <Alert color="red" p="xs">
                        <List size="sm">
                          {email.problems.map((problem) => {
                            const text = `${PROBLEM_LABELS[problem.field]}: ${problem.message}`
                            return <List.Item key={text}>{text}</List.Item>
                          })}
                        </List>
                      </Alert>
                    )}
                    <Table withRowBorders={false} verticalSpacing={2} fz="sm">
                      <Table.Tbody>
                        {HEADER_FIELDS.filter((field) => email[field]).map((field) => (
                          <Table.Tr key={field}>
                            <Table.Td w={110} c="dimmed">
                              {FIELD_LABELS[field]}
                            </Table.Td>
                            <Table.Td>{email[field]}</Table.Td>
                          </Table.Tr>
                        ))}
                        {email.attachments.length > 0 && (
                          <Table.Tr>
                            <Table.Td w={110} c="dimmed" style={{ verticalAlign: 'top' }}>
                              Attachments
                            </Table.Td>
                            <Table.Td>
                              <Attachments attachments={email.attachments} />
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                    <EmailBody html={email.body} />
                  </Stack>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>
    </Stack>
  )
}
