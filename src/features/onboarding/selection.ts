export type SelectionState = Set<string>

export type SelectionAction =
  | { type: 'toggle'; itemId: string }
  | { type: 'pickTier'; siblingIds: string[]; itemId: string }
  | { type: 'set'; ids: string[] }
  | { type: 'reset' }

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'toggle': {
      const next = new Set(state)
      if (next.has(action.itemId)) next.delete(action.itemId)
      else next.add(action.itemId)
      return next
    }
    case 'pickTier': {
      // escolhe um tier e desmarca os irmãos da mesma marca (seleção exclusiva)
      const next = new Set(state)
      for (const id of action.siblingIds) next.delete(id)
      next.add(action.itemId)
      return next
    }
    case 'set':
      return new Set(action.ids)
    case 'reset':
      return new Set()
  }
}
