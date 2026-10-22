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
): Promise<InitialSession<T>> {
  try {
    const { data, error } = await getSession()
    if (hasAuthEvent()) return { kind: 'superseded' }
    return error ? { kind: 'unavailable' } : { kind: 'restored', session: data.session }
  } catch {
    return hasAuthEvent() ? { kind: 'superseded' } : { kind: 'unavailable' }
  }
}
