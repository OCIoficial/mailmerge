import {
  Anchor,
  Button,
  Card,
  CloseButton,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  Title,
} from '@mantine/core'
import { Link, RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useLocalStorage } from '@mantine/hooks'
import { useId, useRef, useState } from 'react'
import type { Column } from '../merge/dataset.ts'
import { HelpPopover, HelpRows, HelpSection } from './HelpPopover.tsx'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor.tsx'
import { FIELD_LABELS, type BodyFormat, type EmailTemplate, type TemplateField } from '../merge/template.ts'

type TextField = Exclude<TemplateField, 'body'>

/** Campos poco usados: ocultos hasta que se piden con su enlace junto a To, como en Gmail. */
const OPTIONAL_FIELDS = ['cc', 'bcc', 'replyTo'] as const satisfies TextField[]
type OptionalField = (typeof OPTIONAL_FIELDS)[number]

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
  const toId = useId()
  // Abiertos en esta sesión. Un campo con valor se muestra siempre, aunque no esté aquí:
  // el template se guarda en el navegador y un Bcc oculto que igual se envía sería peor.
  const [opened, setOpened] = useState<ReadonlySet<OptionalField>>(() => new Set())
  const isVisible = (field: OptionalField) => opened.has(field) || template[field] !== ''
  const visibleOptional = OPTIONAL_FIELDS.filter(isVisible)
  const hiddenOptional = OPTIONAL_FIELDS.filter((field) => !isVisible(field))

  function openField(field: OptionalField) {
    setOpened((current) => new Set(current).add(field))
    // El cursor va al campo nuevo, así también recibe las variables que se inserten.
    requestAnimationFrame(() => inputs.current[field]?.focus())
  }

  function closeField(field: OptionalField) {
    setOpened((current) => {
      const next = new Set(current)
      next.delete(field)
      return next
    })
    if (target === field) setTarget('body')
  }

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

  const textInput = (field: TextField, props: Partial<TextInputProps> = {}) => (
    <TextInput
      key={field}
      label={FIELD_LABELS[field]}
      value={template[field]}
      ref={(element) => {
        inputs.current[field] = element
      }}
      onFocus={() => setTarget(field)}
      onChange={(event) => onChange({ [field]: event.currentTarget.value })}
      {...props}
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

        <Stack gap={4}>
          {/* Etiqueta propia: los enlaces no pueden ir dentro del <label> de To. */}
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text component="label" htmlFor={toId} size="sm" fw={500}>
              {FIELD_LABELS.to}
            </Text>
            {hiddenOptional.length > 0 && (
              <Group gap={2} wrap="nowrap">
                {hiddenOptional.map((field) => (
                  <Button
                    key={field}
                    size="compact-sm"
                    variant="subtle"
                    fw={500}
                    aria-label={`Add ${FIELD_LABELS[field]}`}
                    onClick={() => openField(field)}
                  >
                    {FIELD_LABELS[field]}
                  </Button>
                ))}
              </Group>
            )}
          </Group>
          {textInput('to', { id: toId, label: undefined, placeholder: '{{ email }}' })}
        </Stack>
        {visibleOptional.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="xs">
            {visibleOptional.map((field) =>
              textInput(field, {
                // Solo un campo vacío se puede cerrar: cerrar no debe borrar nada.
                rightSection:
                  template[field] === '' ? (
                    <CloseButton
                      size="sm"
                      aria-label={`Remove ${FIELD_LABELS[field]}`}
                      onClick={() => closeField(field)}
                    />
                  ) : undefined,
              }),
            )}
          </SimpleGrid>
        )}
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
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                aria-label="Body format"
                data={FORMATS}
                value={template.format}
                onChange={(value) => onChange({ format: value as BodyFormat })}
                title="Each format keeps its own text; switching doesn't convert it."
              />
              <HelpPopover label="Syntax help">
                <HelpSection title="Variables (Liquid)">
                  <HelpRows
                    rows={[
                      ['{{ name }}', 'The value of column name in each row'],
                      ['{{ name | titlecase }}', 'Capitalizes each word'],
                      ['{{ amount | default: "0" }}', '"0" when the cell is empty'],
                      ['{% if group == "A" %}…{% endif %}', 'Only for some rows'],
                    ]}
                  />
                  <Anchor href="https://liquidjs.com/filters/overview.html" target="_blank" size="xs">
                    All Liquid filters ↗
                  </Anchor>
                </HelpSection>
                {template.format === 'markdown' && (
                  <HelpSection title="Markdown">
                    <HelpRows
                      rows={[
                        ['**bold**', 'Bold'],
                        ['*italic*', 'Italic'],
                        ['[text](https://…)', 'Link'],
                        ['- item', 'List'],
                      ]}
                    />
                    <Anchor href="https://commonmark.org/help/" target="_blank" size="xs">
                      Markdown guide ↗
                    </Anchor>
                  </HelpSection>
                )}
              </HelpPopover>
            </Group>
            {template.format === 'markdown' && (
              <Switch size="xs" label="Vim" checked={vim} onChange={(event) => setVim(event.currentTarget.checked)} />
            )}
          </Group>
        </Stack>
      </Stack>
    </Card>
  )
}
