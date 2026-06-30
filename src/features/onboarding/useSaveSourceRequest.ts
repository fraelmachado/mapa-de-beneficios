// src/features/onboarding/useSaveSourceRequest.ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { SourceCategory } from '../benefits/types'

export function useSaveSourceRequest() {
  return useMutation({
    mutationFn: async (req: { source_category: SourceCategory; text: string }) => {
      const { error } = await supabase.from('source_requests').insert(req)
      if (error) throw error
    },
  })
}
