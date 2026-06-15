import { createContext, useContext } from 'react'

/**
 * Per-game context provided by <GameFrame>. Lets a game reward the child and
 * record mastery without having to know its own id or wire up plumbing.
 *
 *   const { earn, award } = useGame()
 *   earn(2, { x, y })   // 2 spendable stars + a little star burst at a point
 *   award(3)            // give this game card a 3-star rating + confetti cheer
 */
export const GameContext = createContext(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside a game (under <GameFrame>)')
  return ctx
}
