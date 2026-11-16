import { em } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'

/**
 * Consultas sobre la pantalla y el dispositivo. Se leen de inmediato (no en un efecto), para
 * que el primer render no muestre la versión equivocada y luego cambie.
 */
const useMedia = (query: string) => useMediaQuery(query, false, { getInitialValueInEffect: false })

/**
 * Pantalla angosta, por debajo del breakpoint `sm` de Mantine (48em), el mismo límite que usan
 * `hiddenFrom="sm"` y `visibleFrom="sm"`. Para el layout: barra inferior, lista o vista previa en Review.
 */
export function useIsMobile(): boolean {
  return useMedia(`(max-width: ${em(767.9)})`)
}

/**
 * El puntero principal es el dedo. Para instrucciones que dependen de cómo se interactúa ahora
 * ("mantén presionado" en vez de Ctrl+V); una tablet con teclado pero usada al tacto también cuenta.
 */
export function usePrimaryTouch(): boolean {
  return useMedia('(pointer: coarse)')
}

/**
 * Hay algún puntero preciso (mouse o trackpad). No hay consulta para saber si hay teclado físico;
 * esto es la mejor aproximación. Para funciones que necesitan teclado, como Vim.
 */
export function useHasFinePointer(): boolean {
  return useMedia('(any-pointer: fine)')
}
