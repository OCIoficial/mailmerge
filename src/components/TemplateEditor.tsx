import {
  Anchor,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link, RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLocalStorage } from '@mantine/hooks'
import { useRef, useState } from 'react'
import type { Column } from '../merge/dataset.ts'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor.tsx'
import { FIELD_LABELS, type BodyFormat, type EmailTemplate, type TemplateField } from '../merge/template.ts'

type TextField = Exclude<TemplateField, 'body'>

const TEXT_FIELDS: { field: TextField; placeholder: string }[] = [
  { field: 'to', placeholder: '{{ email }}' },
  { field: 'cc', placeholder: 'Optional' },
  { field: 'bcc', placeholder: 'Optional' },
  { field: 'replyTo', placeholder: 'Optional' },
]

const FORMATS: { value: BodyFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'richtext', label: 'Rich text' },
]

interface Props {
  template: EmailTemplate
  columns: Column[]
  onChange: (patch: Partial<EmailTemplate>) => void
}

export function TemplateEditor({ template, columns, onChange }: Props) {
  const inputs = useRef<Partial<Record<TextField, HTMLInputElement | null>>>({})
  const markdownEditor = useRef<MarkdownEditorHandle>(null)
  // Preferencia personal, no del template: se guarda aparte.
  const [vim, setVim] = useLocalStorage({ key: 'mail-merge:vim', defaultValue: false, getInitialValueInEffect: false })
  const [target, setTarget] = useState<TemplateField>('body')

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false })],
    content: template.body,
    onUpdate: ({ editor }) => onChange({ body: editor.getHTML() }),
    onFocus: () => setTarget('body'),
  })

  function insertVariable(key: string) {
    const snippet = `{{ ${key} }}`
    if (target === 'body') {
      if (template.format === 'richtext') editor?.chain().focus().insertContent(snippet).run()
      else markdownEditor.current?.insert(snippet)
      return
    }
    const field = target
    const input = inputs.current[field]
    const value = template[field]
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    onChange({ [field]: value.slice(0, start) + snippet + value.slice(end) })
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  const textInput = (field: TextField, placeholder?: string) => (
    <TextInput
      key={field}
      label={FIELD_LABELS[field]}
      placeholder={placeholder}
      value={template[field]}
      ref={(element) => {
        inputs.current[field] = element
      }}
      onFocus={() => setTarget(field)}
      onChange={(event) => onChange({ [field]: event.currentTarget.value })}
    />
  )

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>2. Template</Title>

        {columns.length > 0 && (
          <Stack gap={4}>
            <Text size="sm">
              Variables (inserted into <b>{FIELD_LABELS[target]}</b>):
            </Text>
            <Group gap={6}>
              {columns.map((column) => (
                <Button
                  key={column.key}
                  size="compact-xs"
                  variant="light"
                  // Evita que el botón robe el foco y se pierda la posición del cursor.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertVariable(column.key)}
                >
                  {column.key}
                </Button>
              ))}
            </Group>
          </Stack>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="xs">
          {TEXT_FIELDS.map(({ field, placeholder }) => textInput(field, placeholder))}
        </SimpleGrid>
        {textInput('subject')}

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {FIELD_LABELS.body}
          </Text>

          {template.format === 'markdown' ? (
            <MarkdownEditor
              ref={markdownEditor}
              aria-label={FIELD_LABELS.body}
              placeholder={'Hi {{ name }},\n\nYour **balance** is {{ amount }}.'}
              value={template.markdown}
              vim={vim}
              onFocus={() => setTarget('body')}
              onChange={(markdown) => onChange({ markdown })}
            />
          ) : (
            <RichTextEditor editor={editor}>
              <RichTextEditor.Toolbar>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Bold />
                  <RichTextEditor.Italic />
                  <RichTextEditor.Underline />
                  <RichTextEditor.Strikethrough />
                  <RichTextEditor.ClearFormatting />
                </RichTextEditor.ControlsGroup>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.H2 />
                  <RichTextEditor.H3 />
                  <RichTextEditor.BulletList />
                  <RichTextEditor.OrderedList />
                  <RichTextEditor.Blockquote />
                </RichTextEditor.ControlsGroup>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Link />
                  <RichTextEditor.Unlink />
                </RichTextEditor.ControlsGroup>
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Undo />
                  <RichTextEditor.Redo />
                </RichTextEditor.ControlsGroup>
              </RichTextEditor.Toolbar>
              <RichTextEditor.Content mih={240} />
            </RichTextEditor>
          )}
          {/* Barra inferior del editor, como en GitLab: formato a la izquierda, Vim a la derecha. */}
          <Group justify="space-between" gap="xs">
            <SegmentedControl
              size="xs"
              aria-label="Body format"
              data={FORMATS}
              value={template.format}
              onChange={(value) => onChange({ format: value as BodyFormat })}
              title="Each format keeps its own text; switching doesn't convert it."
            />
            {template.format === 'markdown' && (
              <Switch
                size="xs"
                label="Vim"
                checked={vim}
                onChange={(event) => setVim(event.currentTarget.checked)}
              />
            )}
          </Group>
        </Stack>

        <Text size="xs" c="dimmed">
          Syntax{' '}
          <Anchor href="https://liquidjs.com/filters/overview.html" target="_blank" size="xs">
            Liquid
          </Anchor>
          : <code>{'{{ name | titlecase }}'}</code>, <code>{'{{ amount | default: "0" }}'}</code>,{' '}
          <code>{'{% if group == "A" %}...{% endif %}'}</code>. Extra filter: <code>titlecase</code>.
          {template.format === 'markdown' && (
            <>
              {' '}
              <Anchor href="https://commonmark.org/help/" target="_blank" size="xs">
                Markdown
              </Anchor>
              : <code>**bold**</code>, <code>*italic*</code>, <code>[link](https://…)</code>, <code>- list</code>.
            </>
          )}
        </Text>
      </Stack>
    </Card>
  )
}
