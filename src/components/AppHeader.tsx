import {
  Avatar,
  Badge,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core'
import type { ReactNode } from 'react'
import { useAuth } from '../google/AuthContext.tsx'
import classes from './AppHeader.module.css'

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const COLOR_SCHEMES: { value: MantineColorScheme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light theme',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark theme',
    icon: (
      <svg {...iconProps}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    ),
  },
  {
    value: 'auto',
    label: 'Match system theme',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
]

/** Dos líneas que convergen en un sobre: varias filas → un correo cada una. */
function MergeMark() {
  return (
    <svg className={classes.mark} width="30" height="24" viewBox="0 0 30 24" fill="none" aria-hidden>
      <path d="M1 5c5 0 6 7 11 7M1 19c5 0 6-7 11-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="13" y="5" width="16" height="14" rx="2" fill="currentColor" />
      <path d="M14.5 7l6.5 5 6.5-5" stroke="var(--mantine-color-body)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export type View = 'edit' | 'review'

interface Props {
  view: View
  onViewChange: (view: View) => void
  /** Correos con problemas; se muestran junto a Review. */
  problemCount: number
}

export function AppHeader({ view, onViewChange, problemCount }: Props) {
  const auth = useAuth()
  // Mantine guarda la elección en localStorage.
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <div className={classes.wordmark}>
        <MergeMark />
        <span className={classes.title}>Mail Merge</span>
      </div>

      <SegmentedControl
        aria-label="View"
        value={view}
        onChange={(value) => onViewChange(value as View)}
        data={[
          { value: 'edit', label: 'Edit' },
          {
            value: 'review',
            label: (
              <Group gap={6} wrap="nowrap" justify="center">
                Review
                {problemCount > 0 && (
                  <Badge size="xs" color="red" circle title={`${problemCount} emails need fixing`}>
                    {problemCount}
                  </Badge>
                )}
              </Group>
            ),
          },
        ]}
      />

      <Group gap="md" wrap="nowrap">
        <SegmentedControl
          size="xs"
          radius="xl"
          aria-label="Color theme"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as MantineColorScheme)}
          data={COLOR_SCHEMES.map(({ value, label, icon }) => ({
            value,
            label: (
              <Tooltip label={label} openDelay={400}>
                <span style={{ display: 'flex' }} aria-label={label}>
                  {icon}
                </span>
              </Tooltip>
            ),
          }))}
        />

        {auth.token ? (
          <Menu position="bottom-end" width={240} withinPortal>
            <Menu.Target>
              <UnstyledButton className={classes.account} aria-label={`Account: ${auth.email ?? ''}`}>
                <Avatar name={auth.email ?? undefined} color="initials" size={34} />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in as</Menu.Label>
              <Text size="sm" px="sm" pb="xs" truncate>
                {auth.email}
              </Text>
              <Menu.Divider />
              <Menu.Item onClick={auth.signOut}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <UnstyledButton
            className={classes.google}
            onClick={auth.signIn}
            disabled={auth.connecting}
            data-disabled={auth.connecting || undefined}
          >
            <Group gap={10} wrap="nowrap">
              {auth.connecting ? <Loader size={16} /> : <GoogleLogo />}
              <span>Sign in with Google</span>
            </Group>
          </UnstyledButton>
        )}
      </Group>
    </Group>
  )
}
