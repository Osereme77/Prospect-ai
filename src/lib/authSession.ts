type SessionLookup<T> = {
  data: { session: T | null }
  error?: unknown
}

export type InitialSession<T> =
  | { kind: 'restored'; session: T | null }
  | { kind: 'unavailable' }
  | { kind: 'superseded' }

export async function restoreInitialSession<T>(
  getSession: () => Promise<SessionLookup<T>>,
  hasAuthEvent: () => boolean,
  timeoutMs = 8000,
): Promise<InitialSession<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<SessionLookup<T>>(resolve => {
      timer = setTimeout(() => resolve({ data: { session: null }, error: new Error('session_restore_timeout') }), timeoutMs)
    })
    const { data, error } = await Promise.race([getSession(), timeout])
    if (hasAuthEvent()) return { kind: 'superseded' }
    return error ? { kind: 'unavailable' } : { kind: 'restored', session: data.session }
  } catch {
    return hasAuthEvent() ? { kind: 'superseded' } : { kind: 'unavailable' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
