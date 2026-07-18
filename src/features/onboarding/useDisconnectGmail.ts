import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

export async function deleteEvidence(userId: string) {
  const { error } = await supabase.from('source_evidence').delete().eq('user_id', userId)
  if (error) throw error
}

// Apaga todos os metadados de e-mail guardados do usuário. Não desfaz programas
// já adicionados ao radar (user_sources permanece).
export function useDisconnectGmail(userId: string | undefined) {
  return useMutation({
    mutationFn: async () => { if (userId) await deleteEvidence(userId) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['source_evidence'] }),
  })
}
