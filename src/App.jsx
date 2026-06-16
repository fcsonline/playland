import { useEffect, useState } from 'react'
import Home from './screens/Home.jsx'
import Splash from './screens/Splash.jsx'
import GameFrame from './components/GameFrame.jsx'
import { GAME_BY_ID } from './games/registry.js'

// Restore the current game from history on load (so a reload inside a game
// keeps you there, and the back button stays in sync).
const gameFromHistory = () => {
  if (typeof window === 'undefined') return null
  const g = window.history.state?.game
  return GAME_BY_ID[g] ? g : null
}

export default function App() {
  const [gameId, setGameId] = useState(gameFromHistory)
  // Show the welcome splash once on a fresh open (not when reloading into a game).
  const [showSplash, setShowSplash] = useState(() => !gameFromHistory())

  // One always-on listener keeps the view matched to the browser/device back &
  // forward buttons: the view is whatever the current history entry says.
  useEffect(() => {
    const onPop = () => {
      const g = window.history.state?.game
      setGameId(GAME_BY_ID[g] ? g : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Opening a game pushes one history entry on top of Home.
  const open = (id) => {
    if (!GAME_BY_ID[id]) return
    window.history.pushState({ game: id }, '')
    setGameId(id)
  }

  // The in-game back arrow: step back to the Home entry (popstate syncs the
  // view). If we somehow aren't on a pushed game entry, just show Home.
  const back = () => {
    if (window.history.state?.game) window.history.back()
    else setGameId(null)
  }

  if (showSplash && !gameId) return <Splash onDone={() => setShowSplash(false)} />
  if (gameId) return <GameFrame gameId={gameId} onBack={back} />
  return <Home onOpen={open} />
}
