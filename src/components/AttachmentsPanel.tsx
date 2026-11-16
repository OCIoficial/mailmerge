import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { HelpPopover, HelpRows, HelpSection } from './HelpPopover.tsx'
import { IconBrandGoogleDrive, IconFileZip, IconFlask, IconPlus, IconUpload, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { readArchive } from '../attachments/archive.ts'
import type { AttachmentTree } from '../attachments/tree.ts'
import type { AttachmentPath } from '../merge/template.ts'
import { useAuth } from '../google/AuthContext.tsx'
import { downloadDriveFile, loadDriveTree } from '../google/drive.ts'
import { pickArchive, pickFolder } from '../google/picker.ts'
import { FileTree } from './FileTree.tsx'
import { Notice } from './Notice.tsx'

const ARCHIVE_ACCEPT = '.zip,.tar,.tgz,.gz,application/zip,application/x-tar,application/gzip'

interface Props {
  tree: AttachmentTree | null
  onTreeChange: (tree: AttachmentTree | null) => void
  paths: AttachmentPath[]
  onPathsChange: (paths: AttachmentPath[]) => void
}

export function AttachmentsPanel({ tree, onTreeChange, paths, onPathsChange }: Props) {
  const auth = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(message: string, task: () => Promise<AttachmentTree | null>) {
    setLoading(message)
    setError(null)
    try {
      const next = await task()
      if (next) onTreeChange(next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  const fromDriveFolder = () =>
    load('Reading folder…', async () => {
      const folder = await auth.run(pickFolder)
      if (!folder) return null
      return auth.run((token) =>
        loadDriveTree(token, folder, (progress) =>
          setLoading(
            progress.phase === 'listing'
              ? `Reading folder… ${progress.files} files`
              : `Downloading ${progress.done} of ${progress.total} files…`,
          ),
        ),
      )
    })

  const fromDriveArchive = () =>
    load('Downloading archive…', async () => {
      const file = await auth.run(pickArchive)
      if (!file) return null
      const data = await auth.run((token) => downloadDriveFile(token, file.id))
      setLoading('Reading archive…')
      return readArchive(file.name, data)
    })

  const fromUpload = (file: File | null) =>
    file && load('Reading archive…', async () => readArchive(file.name, new Uint8Array(await file.arrayBuffer())))

  const fromSample = () =>
    load('Loading sample files…', async () => {
      // Import dinámico dentro de DEV: el ejemplo no queda en el build de producción.
      const { sampleFiles } = await import('../sample/sampleFiles.ts')
      return sampleFiles()
    })

  const updatePath = (index: number, patch: Partial<AttachmentPath>) =>
    onPathsChange(paths.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  return (
    <Card withBorder h="100%">
      <Stack gap="sm">
        <Title order={4}>3. Attachments</Title>

        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Files
          </Text>
          {/* Tres opciones equivalentes: mismo ancho. Se decide por el ancho de la tarjeta, no de la
              pantalla, porque en dos columnas la tarjeta es angosta. */}
          <div style={{ containerType: 'inline-size' }}>
            <SimpleGrid type="container" cols={{ base: 1, '500px': 3 }} spacing="xs">
              <Button
                variant="default"
                fullWidth
                leftSection={<IconBrandGoogleDrive size={16} />}
                disabled={!auth.token || !!loading}
                onClick={fromDriveFolder}
              >
                Drive folder
              </Button>
              <Button
                variant="default"
                fullWidth
                leftSection={<IconFileZip size={16} />}
                disabled={!auth.token || !!loading}
                onClick={fromDriveArchive}
              >
                Drive archive
              </Button>
              <FileButton onChange={fromUpload} accept={ARCHIVE_ACCEPT}>
                {(props) => (
                  <Button
                    variant="default"
                    fullWidth
                    leftSection={<IconUpload size={16} />}
                    disabled={!!loading}
                    {...props}
                  >
                    Upload archive
                  </Button>
                )}
              </FileButton>
            </SimpleGrid>
          </div>
          {/* Solo en desarrollo; aparte, para no mezclarlo con las fuentes reales. */}
          {import.meta.env.DEV && (
            <Button
              variant="light"
              fullWidth
              color="grape"
              leftSection={<IconFlask size={16} />}
              disabled={!!loading}
              onClick={fromSample}
            >
              Use sample files
            </Button>
          )}
          {/* Ayuda para elegir la fuente; con archivos cargados, el árbol ya lo muestra. */}
          {!tree && (
            <Text size="xs" c="dimmed">
              A Drive folder, or a ZIP, TAR or TAR.GZ archive. Attachment paths are relative to it.
            </Text>
          )}
        </Stack>

        {loading && (
          <Text size="sm" c="dimmed">
            {loading}
          </Text>
        )}
        {error && (
          <Notice tone="error" title="Could not load the files">
            {/* Una línea por archivo que falló. */}
            {error.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </Notice>
        )}

        {tree && <FileTree key={tree.root.id} tree={tree} onRemove={() => onTreeChange(null)} />}

        <Stack gap={6}>
          <Group gap={4}>
            <Text size="sm" fw={500}>
              Attachment paths
            </Text>
            <HelpPopover label="Attachment path help" iconOnly>
              <HelpSection title="Paths">
                <HelpRows
                  rows={[
                    ['Alumnos/{{ rut }}/informe.pdf', 'One file per row, using template variables'],
                    ['Alumnos/{{ rut }}/*.pdf', '* matches any characters in a name'],
                    ['Alumnos/**/{{ rut }}.pdf', '** matches any number of folders'],
                    ['Alumnos/{{ rut }}', 'A folder is attached as a ZIP'],
                  ]}
                />
                <Text size="xs" c="dimmed" mt={6}>
                  Paths are relative to the loaded folder or archive. Matching is exact, including case and accents.
                </Text>
              </HelpSection>
              <HelpSection title="Required">
                <Text size="xs" c="dimmed">
                  Checked: if nothing matches, the email is marked as needing fixing. Unchecked: the email is sent
                  without that attachment.
                </Text>
              </HelpSection>
            </HelpPopover>
          </Group>
          {paths.map(({ path, required }, index) => (
            <Group key={index} gap={8} wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                ff="monospace"
                placeholder="Alumnos/{{ rut }}/*.pdf"
                aria-label={`Attachment path ${index + 1}`}
                value={path}
                onChange={(event) => updatePath(index, { path: event.currentTarget.value })}
              />
              <Checkbox
                size="xs"
                label="Required"
                title={
                  required
                    ? 'If the file is missing, the email is marked as needing fixing.'
                    : 'If the file is missing, the email is sent without it.'
                }
                checked={required}
                onChange={(event) => updatePath(index, { required: event.currentTarget.checked })}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Remove attachment path ${index + 1}`}
                onClick={() => onPathsChange(paths.filter((_, i) => i !== index))}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Group>
            <Button
              size="compact-sm"
              variant="subtle"
              color="gray"
              leftSection={<IconPlus size={14} />}
              onClick={() => onPathsChange([...paths, { path: '', required: true }])}
            >
              Add path
            </Button>
          </Group>
        </Stack>
      </Stack>
    </Card>
  )
}
