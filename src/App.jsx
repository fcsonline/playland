import { useEffect, useState } from 'react'
import Home from './screens/Home.jsx'
import Splash from './screens/Splash.jsx'
import GameFrame from './components/GameFrame.jsx'
import { GAME_BY_ID } from './games/registry.js'

// Restore the current game from history on load (so a reload inside a game
// keeps you there, and the back button stays in sync).
const viewFromHistory = () => {
  if (typeof window === 'undefined') return { game: null }
  const s = window.history.state
  return { game: GAME_BY_ID[s?.game] ? s.game : null }
}

export default function App() {
  const [view, setView] = useState(viewFromHistory)
  // Show the welcome splash once on a fresh open (not when reloading into a game).
  const [showSplash, setShowSplash] = useState(() => !viewFromHistory().game)

  // One always-on listener keeps the view matched to the browser/device back &
  // forward buttons: the view is whatever the current history entry says.
  useEffect(() => {
    const onPop = () => setView(viewFromHistory())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Opening a game pushes one history entry on top of Home.
  const open = (id) => {
    if (!GAME_BY_ID[id]) return
    window.history.pushState({ game: id }, '')
    setView({ game: id })
  }

  // The back arrow: step back to the Home entry (popstate syncs the view).
  // If we somehow aren't on a pushed entry, just show Home.
  const back = () => {
    const s = window.history.state
    if (s?.game) window.history.back()
    else setView({ game: null })
  }

  if (showSplash && !view.game) return <Splash onDone={() => setShowSplash(false)} />
  if (view.game) return <GameFrame gameId={view.game} onBack={back} />
  return <Home onOpen={open} />
}
