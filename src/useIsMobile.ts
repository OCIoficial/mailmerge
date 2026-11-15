import { em } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'

/**
 * Pantalla de teléfono: por debajo del breakpoint `sm` de Mantine (48em), el mismo
 * límite que usan `hiddenFrom="sm"` y `visibleFrom="sm"`.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${em(767.9)})`, false, { getInitialValueInEffect: false })
}
