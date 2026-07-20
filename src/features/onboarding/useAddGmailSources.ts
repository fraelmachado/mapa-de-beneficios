import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import type { Json } from '../../lib/database.types'
import type { GmailSourcePayload } from './gmail/types'

// Grava seleção + evidência do Gmail atomicamente (RPC add_gmail_sources).
export function useAddGmailSources() {
  return useMutation({
    mutationFn: async (payload: GmailSourcePayload[]) => {
      // ponytail: GmailSourcePayload has no index signature so it isn't
      // structurally assignable to Json; it's plain string fields, safe to cast.
      const { error } = await supabase.rpc('add_gmail_sources', {
        payload: payload as unknown as Json,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
      queryClient.invalidateQueries({ queryKey: ['user_sources'] })
      queryClient.invalidateQueries({ queryKey: ['source_evidence'] })
    },
  })
}
