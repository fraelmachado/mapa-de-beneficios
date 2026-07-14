export type DiscoveryEntityType = 'source' | 'source_item' | 'benefit'
export type DiscoveryMatchStatus = 'new' | 'update' | 'duplicate'
export type DiscoveryReviewStatus = 'pending' | 'approved' | 'rejected'

export interface DiscoveryJob {
  id: string
  brief: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
  created_at: string
}

export interface DiscoveryCandidate {
  id: string
  job_id: string
  entity_type: DiscoveryEntityType
  fingerprint: string
  parent_fingerprint: string | null
  payload: Record<string, unknown>
  provenance: Record<string, unknown>
  match_status: DiscoveryMatchStatus
  matched_id: string | null
  review_status: DiscoveryReviewStatus
  rejection_reason: string | null
  promoted_id: string | null
  created_at: string
}
