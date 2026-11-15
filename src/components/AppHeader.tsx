import { Button, Group, Text, Title } from '@mantine/core'
import { useAuth } from '../google/AuthContext.tsx'

export function AppHeader() {
  const auth = useAuth()
  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Title order={3}>Mail Merge</Title>
      <Group gap="sm" wrap="nowrap">
        {auth.token ? (
          <>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              {auth.email}
            </Text>
            <Button variant="default" onClick={auth.signOut}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={auth.signIn} loading={auth.connecting}>
            Connect with Google
          </Button>
        )}
      </Group>
    </Group>
  )
}
