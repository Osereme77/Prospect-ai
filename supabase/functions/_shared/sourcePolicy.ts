export function effectiveSourceRequestLimit(sourceEnabled: boolean, config: unknown, globalLimit: number, now = Date.now()): number | null {
  if (!sourceEnabled || !Number.isSafeInteger(globalLimit) || globalLimit < 1 || !config || typeof config !== 'object') return null
  const values = config as Record<string, unknown>
  const ownerLimit = values.monthly_limit
  const reviewedAt = values.terms_reviewed_at
  const storageRightsAt = values.storage_rights_confirmed_at
  if (!Number.isSafeInteger(ownerLimit) || (ownerLimit as number) < 1 || (ownerLimit as number) > 10000) return null
  if (typeof reviewedAt !== 'string' || !Number.isFinite(Date.parse(reviewedAt)) || Date.parse(reviewedAt) > now) return null
  if (typeof storageRightsAt !== 'string' || !Number.isFinite(Date.parse(storageRightsAt)) || Date.parse(storageRightsAt) > now) return null
  return Math.min(globalLimit, ownerLimit as number)
}
