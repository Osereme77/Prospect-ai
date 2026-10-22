// Mirrors the ordered SQL migrations under supabase/migrations. Refresh this
// file from the deployed schema when a Supabase project is provisioned.
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
type Relation<Name extends string, Columns extends string[], Target extends string, TargetColumns extends string[]> = {
  foreignKeyName: Name
  columns: Columns
  isOneToOne: boolean
  referencedRelation: Target
  referencedColumns: TargetColumns
}
type Table<Row, Insert, Update = Partial<Insert>, Relationships extends unknown[] = []> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Relationships
}
type Lead = {
  id: string; owner_id: string; kind: 'opportunity' | 'company'; title: string; organization: string
  source_url: string | null; location: string | null; summary: string; status: 'new' | 'reviewed' | 'shortlisted' | 'contacted' | 'applied' | 'replied' | 'interviewing' | 'won' | 'lost' | 'dismissed'
  budget_signal: string | null; follow_up_at: string | null; notes: string; duplicate_of: string | null
  source_label: string; tags: string[]; posted_label: string; score: number; score_reason: string
  search_run_id: string | null; source_id: string | null; discovered_at: string | null; research_gaps: string[]
  contact_availability: 'unknown' | 'public_channel' | 'not_found'
  created_at: string; updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string; headline: string; skills: string[]; services: string[]; markets: string[]; portfolio_links: string[]; experience_summary: string; notification_threshold: number; email_notifications_enabled: boolean; created_at: string; updated_at: string },
        { id: string; display_name?: string; headline?: string; skills?: string[]; services?: string[]; markets?: string[]; portfolio_links?: string[]; experience_summary?: string; notification_threshold?: number; email_notifications_enabled?: boolean; created_at?: string; updated_at?: string }
      >
      user_roles: Table<{ user_id: string; role: 'user' | 'admin' | 'super_admin'; created_at: string }, { user_id: string; role?: 'user' | 'admin' | 'super_admin'; created_at?: string }>
      discovery_sources: Table<
        { id: string; owner_id: string | null; name: string; kind: 'search_api' | 'public_feed' | 'manual'; base_url: string | null; enabled: boolean; config: Json; created_at: string; updated_at: string },
        { id?: string; owner_id?: string | null; name: string; kind: 'search_api' | 'public_feed' | 'manual'; base_url?: string | null; enabled?: boolean; config?: Json; created_at?: string; updated_at?: string },
        { id?: string; owner_id?: string | null; name?: string; kind?: 'search_api' | 'public_feed' | 'manual'; base_url?: string | null; enabled?: boolean; config?: Json; updated_at?: string },
        []
      >
      search_runs: Table<
        { id: string; owner_id: string; source_id: string | null; status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'; query: string; started_at: string | null; finished_at: string | null; result_count: number; error_code: string | null; error_summary: string | null; idempotency_key: string; created_at: string },
        { id?: string; owner_id: string; source_id?: string | null; status?: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'; query: string; started_at?: string | null; finished_at?: string | null; result_count?: number; error_code?: string | null; error_summary?: string | null; idempotency_key: string; created_at?: string },
        { id?: string; owner_id?: string; source_id?: string | null; status?: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'; query?: string; started_at?: string | null; finished_at?: string | null; result_count?: number; error_code?: string | null; error_summary?: string | null; idempotency_key?: string; created_at?: string },
        [Relation<'search_runs_source_id_fkey', ['source_id'], 'discovery_sources', ['id']>]
      >
      discovery_reservations: Table<{ run_id: string; owner_id: string; reserved_at: string }, { run_id: string; owner_id: string; reserved_at?: string }>
      leads: Table<
        Lead,
        { id?: string; owner_id: string; kind: Lead['kind']; title: string; organization: string; source_url?: string | null; location?: string | null; summary?: string; status?: Lead['status']; budget_signal?: string | null; contact_availability?: Lead['contact_availability']; follow_up_at?: string | null; notes?: string; duplicate_of?: string | null; source_label?: string; tags?: string[]; posted_label?: string; score?: number; score_reason?: string; search_run_id?: string | null; source_id?: string | null; discovered_at?: string | null; research_gaps?: string[]; created_at?: string; updated_at?: string },
        { id?: string; owner_id?: string; kind?: Lead['kind']; title?: string; organization?: string; source_url?: string | null; location?: string | null; summary?: string; status?: Lead['status']; budget_signal?: string | null; contact_availability?: Lead['contact_availability']; follow_up_at?: string | null; notes?: string; duplicate_of?: string | null; source_label?: string; tags?: string[]; posted_label?: string; score?: number; score_reason?: string; search_run_id?: string | null; source_id?: string | null; discovered_at?: string | null; research_gaps?: string[]; updated_at?: string },
        [Relation<'leads_duplicate_of_fkey', ['duplicate_of'], 'leads', ['id']>, Relation<'leads_search_run_id_fkey', ['search_run_id'], 'search_runs', ['id']>, Relation<'leads_source_id_fkey', ['source_id'], 'discovery_sources', ['id']>]
      >
      lead_evidence: Table<
        { id: string; lead_id: string; owner_id: string; source_url: string; claim: string; evidence_type: string; observed_at: string; excerpt: string | null; content_hash: string | null; verification_status: 'unverified' | 'verified'; reviewed_at: string | null; created_at: string },
        { id?: string; lead_id: string; owner_id: string; source_url: string; claim: string; evidence_type?: string; observed_at?: string; excerpt?: string | null; content_hash?: string | null; verification_status?: 'unverified' | 'verified'; reviewed_at?: string | null; created_at?: string },
        { id?: string; lead_id?: string; owner_id?: string; source_url?: string; claim?: string; evidence_type?: string; observed_at?: string; excerpt?: string | null; content_hash?: string | null; verification_status?: 'unverified' | 'verified'; reviewed_at?: string | null; created_at?: string },
        [Relation<'lead_evidence_lead_id_fkey', ['lead_id'], 'leads', ['id']>]
      >
      lead_scores: Table<
        { id: string; lead_id: string; owner_id: string; score: number; relevance: number; need_evidence: number; budget_signals: number; freshness: number; source_confidence: number; explanation: Json; scoring_version: string; created_at: string },
        { id?: string; lead_id: string; owner_id: string; score: number; relevance: number; need_evidence: number; budget_signals: number; freshness: number; source_confidence: number; explanation?: Json; scoring_version?: string; created_at?: string },
        { id?: string; lead_id?: string; owner_id?: string; score?: number; relevance?: number; need_evidence?: number; budget_signals?: number; freshness?: number; source_confidence?: number; explanation?: Json; scoring_version?: string; created_at?: string },
        [Relation<'lead_scores_lead_id_fkey', ['lead_id'], 'leads', ['id']>]
      >
      notifications: Table<
        { id: string; owner_id: string; lead_id: string | null; kind: string; title: string; body: string; read_at: string | null; idempotency_key: string; created_at: string },
        { id?: string; owner_id: string; lead_id?: string | null; kind: string; title: string; body: string; read_at?: string | null; idempotency_key: string; created_at?: string },
        { id?: string; owner_id?: string; lead_id?: string | null; kind?: string; title?: string; body?: string; read_at?: string | null; idempotency_key?: string; created_at?: string },
        [Relation<'notifications_lead_id_fkey', ['lead_id'], 'leads', ['id']>]
      >
      outbox: Table<{ id: string; owner_id: string; notification_id: string | null; channel: 'email'; status: 'queued' | 'sending' | 'sent' | 'failed'; attempts: number; next_attempt_at: string; last_error_code: string | null; idempotency_key: string; created_at: string; sent_at: string | null; locked_at: string | null }, { id?: string; owner_id: string; notification_id?: string | null; channel: 'email'; status?: 'queued' | 'sending' | 'sent' | 'failed'; attempts?: number; next_attempt_at?: string; last_error_code?: string | null; idempotency_key: string; created_at?: string; sent_at?: string | null; locked_at?: string | null }>
      audit_logs: Table<{ id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Json; created_at: string }, { id?: string; actor_id?: string | null; action: string; entity_type: string; entity_id?: string | null; metadata?: Json; created_at?: string }>
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      admin_retry_notification_outbox: { Args: { p_id: string }; Returns: boolean }
      admin_set_discovery_source_enabled: { Args: { p_id: string; p_enabled: boolean }; Returns: boolean }
      admin_discovery_usage: { Args: Record<PropertyKey, never>; Returns: { month_start: string; total_requests: number; active_accounts: number }[] }
      admin_queue_health: { Args: Record<PropertyKey, never>; Returns: { queued_count: number; oldest_queued_at: string | null; stale_sending_count: number; failed_count: number }[] }
      reserve_discovery_slot: { Args: { p_owner: string; p_run_id: string; p_owner_monthly_limit: number; p_global_monthly_limit: number }; Returns: boolean }
    }
    Enums: {
      lead_kind: 'opportunity' | 'company'
      lead_status: Lead['status']
      search_run_status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'
    }
    CompositeTypes: Record<string, never>
  }
}
