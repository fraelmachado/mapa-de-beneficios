import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

// Regrava a seleção do usuário: limpa as anteriores e insere as novas.
export function useSaveUserSources() {
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data: u, error: userErr } = await supabase.auth.getUser()
      if (userErr || !u.user) throw userErr ?? new Error('sem usuário')
      const userId = u.user.id
      const del = await supabase.from('user_sources').delete().eq('user_id', userId)
      if (del.error) throw del.error
      if (itemIds.length) {
        const rows = itemIds.map((id) => ({ user_id: userId, source_item_id: id }))
        const { error } = await supabase.from('user_sources').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits_count'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
    },
  })
}
