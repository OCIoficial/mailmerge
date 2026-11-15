import { useLocalStorage } from '@mantine/hooks'
import { useCallback } from 'react'
import { DEFAULT_NORMALIZATION, type Normalization } from './normalize.ts'

/** Configuración que depende de los datos de una hoja, y por eso se guarda por hoja. */
export interface SheetSettings {
  hasHeader: boolean
  normalization: Normalization
}

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  hasHeader: false,
  normalization: DEFAULT_NORMALIZATION,
}

/** Identifica una hoja: id del spreadsheet + nombre de la hoja. */
export function sheetKey(spreadsheetId: string, sheet: string): string {
  return `${spreadsheetId}::${sheet}`
}

/** Configuración por hoja, guardada en localStorage. Una hoja nueva empieza con los valores por defecto. */
export function useSheetSettings() {
  const [all, setAll] = useLocalStorage<Record<string, SheetSettings>>({
    key: 'mail-merge:sheet-settings',
    defaultValue: {},
    getInitialValueInEffect: false,
  })

  const settingsFor = useCallback(
    (key: string): SheetSettings => ({ ...DEFAULT_SHEET_SETTINGS, ...all[key] }),
    [all],
  )

  const update = useCallback(
    (key: string, patch: Partial<SheetSettings>) =>
      setAll((current) => ({ ...current, [key]: { ...DEFAULT_SHEET_SETTINGS, ...current[key], ...patch } })),
    [setAll],
  )

  return { settingsFor, update }
}

export type SheetSettingsStore = ReturnType<typeof useSheetSettings>
