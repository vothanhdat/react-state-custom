/**
 * Per-tab persistence for the panel (open state, sizes) so a remount of the dev tool, for
 * instance on hot reload or when the host swaps pages, does not close it. Storage can be
 * unavailable (private mode, sandboxed frames): every access is guarded and falls back silently.
 */
const PREFIX = 'react-state-custom:dev-tool:'

export const readSetting = <T>(key: string, fallback: T): T => {
    try {
        const raw = sessionStorage.getItem(PREFIX + key)
        return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
        return fallback
    }
}

export const writeSetting = (key: string, value: unknown) => {
    try {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
        // storage unavailable: the setting just does not persist
    }
}
