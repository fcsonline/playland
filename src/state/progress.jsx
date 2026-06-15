import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Global progress system.
 *
 * Two kinds of "stars":
 *  - wallet: a spendable currency earned by playing (used by shops like the Aquarium).
 *  - mastery[gameId]: a 0..3 rating shown as stars on each home-screen card.
 *
 * Plus `unlocks`: a set of string keys that games flip on as the child plays
 * (new drawings, train types, planets...). Nothing is ever locked away forever —
 * unlocks only ever add content.
 *
 * Everything is persisted to localStorage so play is offline-first and durable.
 */

const STORAGE_KEY = 'kids-playland.save.v1'

const ProgressContext = createContext(null)

const emptySave = () => ({ wallet: 0, lifetime: 0, mastery: {}, unlocks: {}, gameLevel: {} })

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptySave()
    const parsed = JSON.parse(raw)
    return {
      wallet: Number(parsed.wallet) || 0,
      lifetime: Number(parsed.lifetime) || 0,
      mastery: parsed.mastery && typeof parsed.mastery === 'object' ? parsed.mastery : {},
      unlocks: parsed.unlocks && typeof parsed.unlocks === 'object' ? parsed.unlocks : {},
      gameLevel: parsed.gameLevel && typeof parsed.gameLevel === 'object' ? parsed.gameLevel : {},
    }
  } catch {
    return emptySave()
  }
}

export function ProgressProvider({ children }) {
  const [save, setSave] = useState(loadSave)
  const saveRef = useRef(save)
  saveRef.current = save

  // Debounced persistence.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
      } catch {
        /* storage may be unavailable (private mode) — play still works in memory */
      }
    }, 120)
    return () => clearTimeout(id)
  }, [save])

  // Add spendable stars to the wallet (also grows the lifetime counter).
  const earn = useCallback((amount = 1) => {
    const n = Math.max(0, Math.round(amount))
    if (!n) return
    setSave((s) => ({ ...s, wallet: s.wallet + n, lifetime: s.lifetime + n }))
  }, [])

  // Spend wallet stars (for shops). Returns true if the child could afford it.
  const spend = useCallback((amount = 1) => {
    const n = Math.max(0, Math.round(amount))
    if (saveRef.current.wallet < n) return false
    setSave((s) => ({ ...s, wallet: s.wallet - n }))
    return true
  }, [])

  // Record a 0..3 mastery rating for a card. Only ever increases.
  const recordMastery = useCallback((gameId, count) => {
    const c = Math.max(0, Math.min(3, Math.round(count)))
    setSave((s) => {
      if ((s.mastery[gameId] || 0) >= c) return s
      return { ...s, mastery: { ...s.mastery, [gameId]: c } }
    })
  }, [])

  const unlock = useCallback((key) => {
    setSave((s) => (s.unlocks[key] ? s : { ...s, unlocks: { ...s.unlocks, [key]: true } }))
  }, [])

  // Remember the highest difficulty level a child has reached in a game, so it
  // starts there next time (difficulty follows their history — they never pick).
  const setGameLevel = useCallback((gameId, level) => {
    const n = Math.max(0, Math.round(level))
    setSave((s) => {
      if ((s.gameLevel[gameId] || 0) >= n) return s
      return { ...s, gameLevel: { ...s.gameLevel, [gameId]: n } }
    })
  }, [])

  const getGameLevel = useCallback((gameId) => saveRef.current.gameLevel[gameId] || 0, [])

  const isUnlocked = useCallback((key) => !!saveRef.current.unlocks[key], [])

  const resetAll = useCallback(() => setSave(emptySave()), [])

  const value = useMemo(
    () => ({
      wallet: save.wallet,
      lifetime: save.lifetime,
      mastery: save.mastery,
      unlocks: save.unlocks,
      gameLevel: save.gameLevel,
      earn,
      spend,
      recordMastery,
      unlock,
      isUnlocked,
      setGameLevel,
      getGameLevel,
      resetAll,
    }),
    [save, earn, spend, recordMastery, unlock, isUnlocked, setGameLevel, getGameLevel, resetAll],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>')
  return ctx
}
