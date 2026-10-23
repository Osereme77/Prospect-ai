export interface EmailLead {
  title: string
  organization: string
  score: number
  score_reason: string
  source_url: string | null
}

export interface EmailNotification {
  title: string
  body: string
}

export function resendApiKey(getEnv: (name: string) => string | undefined): string | undefined {
  return getEnv('RESEND_API_KEY') || getEnv('Resend_Api')
}

export function notificationEmail(notification: EmailNotification, lead?: EmailLead | null) {
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  const title = lead?.title ?? notification.title
  const organization = lead?.organization
  const subject = `${title}${organization ? ` · ${organization}` : ''}`.replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
  const source = lead?.source_url && /^https?:\/\//i.test(lead.source_url) ? lead.source_url : undefined
  const details = lead ? [`${lead.organization} · Fit score ${lead.score}/100`, lead.score_reason] : [notification.body]
  const text = [notification.title, ...details, ...(source ? [`Source: ${source}`] : [])].join('\n\n').slice(0, 5000)
  const html = `<h2>${safe(notification.title)}</h2>${lead ? `<p><strong>${safe(lead.title)}</strong> at ${safe(lead.organization)} · Fit score ${lead.score}/100</p><p>${safe(lead.score_reason)}</p>` : `<p>${safe(notification.body)}</p>`}${source ? `<p><a href="${safe(source)}">Open the original public source</a></p>` : ''}`.slice(0, 12000)
  return { subject, text, html }
}

export function retryAt(attempt: number, now = Date.now()): string {
  const delays = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]
  const delay = delays[Math.max(0, Math.min(delays.length - 1, Math.floor(attempt) - 1))]
  return new Date(now + delay).toISOString()
}
