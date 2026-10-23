type DiscoveryErrorBody = { error?: unknown }

const messages: Record<string, string> = {
  unauthorized: 'Your sign-in expired. Sign in again and retry discovery.',
  provider_not_configured_or_disabled: 'Discovery is disabled in server settings. The approved provider and monthly cap need to be enabled there.',
  source_registry_unavailable: 'Discovery could not load your saved source approval. Check the connection and retry.',
  source_not_approved_by_owner: 'This source is not approved for your account yet. Review and save its approval in Settings.',
  duplicate_request: 'This search was already submitted. Wait a moment before trying again.',
  run_creation_failed: 'Discovery could not start a search run. Check the connection and retry.',
  quota_check_failed: 'The discovery quota could not be checked. Try again shortly.',
  monthly_limit_reached: 'The monthly discovery limit has been reached. Try again after the limit resets.',
  provider_error: 'The public feed could not be reached. Check your connection and retry.',
  save_failed: 'The search completed, but its results could not be saved. Check the cloud connection and retry.',
}

/** Maps known, non-sensitive Edge Function error codes to useful user guidance. */
export async function discoveryFailureMessage(error: unknown): Promise<string> {
  if (error instanceof Error && Object.prototype.hasOwnProperty.call(messages, error.message)) return messages[error.message]
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : undefined

  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as DiscoveryErrorBody
      if (typeof body.error === 'string' && messages[body.error]) return messages[body.error]
    } catch {
      // Fall through to the safe generic message for non-JSON gateway errors.
    }
  }

  return 'Discovery failed. Check the connection and retry. If it continues, check the provider and quota settings.'
}
