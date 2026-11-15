import { ActionIcon, Button, Card, FileButton, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { readArchive } from '../attachments/archive.ts'
import type { AttachmentTree } from '../attachments/tree.ts'
import { useAuth } from '../google/AuthContext.tsx'
import { downloadDriveFile, loadDriveTree } from '../google/drive.ts'
import { pickArchive, pickFolder } from '../google/picker.ts'
import { FileTree } from './FileTree.tsx'
import { Notice } from './Notice.tsx'

const ARCHIVE_ACCEPT = '.zip,.tar,.tgz,.gz,application/zip,application/x-tar,application/gzip'

interface Props {
  tree: AttachmentTree | null
  onTreeChange: (tree: AttachmentTree | null) => void
  paths: string[]
  onPathsChange: (paths: string[]) => void
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
      return auth.run((token) => loadDriveTree(token, folder, (files) => setLoading(`Reading folder… ${files} files`)))
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

  const updatePath = (index: number, value: string) => onPathsChange(paths.map((p, i) => (i === index ? value : p)))

  return (
    <Card withBorder h="100%">
      <Stack gap="sm">
        <Title order={4}>3. Attachments</Title>

        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Files
          </Text>
          <Group gap="xs">
            <Button size="xs" variant="default" disabled={!auth.token || !!loading} onClick={fromDriveFolder}>
              Drive folder
            </Button>
            <Button size="xs" variant="default" disabled={!auth.token || !!loading} onClick={fromDriveArchive}>
              Archive from Drive
            </Button>
            <FileButton onChange={fromUpload} accept={ARCHIVE_ACCEPT}>
              {(props) => (
                <Button size="xs" variant="default" disabled={!!loading} {...props}>
                  Upload archive
                </Button>
              )}
            </FileButton>
            {import.meta.env.DEV && (
              <Button size="xs" variant="light" color="grape" disabled={!!loading} onClick={fromSample}>
                Use sample files
              </Button>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            A Drive folder, or a ZIP, TAR or TAR.GZ archive. Attachment paths are relative to it.
          </Text>
        </Stack>

        {loading && (
          <Text size="sm" c="dimmed">
            {loading}
          </Text>
        )}
        {error && (
          <Notice tone="error" title="Could not load the files">
            {error}
          </Notice>
        )}

        {tree && <FileTree key={tree.root.id} tree={tree} onRemove={() => onTreeChange(null)} />}

        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Attachment paths
          </Text>
          {paths.map((path, index) => (
            <Group key={index} gap={6} wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                ff="monospace"
                placeholder="Alumnos/{{ rut }}/*.pdf"
                aria-label={`Attachment path ${index + 1}`}
                value={path}
                onChange={(event) => updatePath(index, event.currentTarget.value)}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remove attachment path ${index + 1}`}
                onClick={() => onPathsChange(paths.filter((_, i) => i !== index))}
              >
                ✕
              </ActionIcon>
            </Group>
          ))}
          <Group>
            <Button size="xs" variant="light" onClick={() => onPathsChange([...paths, ''])}>
              + Add path
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Paths can use template variables. <code>*</code> matches any characters in a name, <code>**</code> any
            number of folders. Matching is exact, including case and accents. A folder is attached as a ZIP.
          </Text>
        </Stack>
      </Stack>
    </Card>
  )
}
