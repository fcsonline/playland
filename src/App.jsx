import { useEffect, useState } from 'react'
import Home from './screens/Home.jsx'
import Splash from './screens/Splash.jsx'
import Shop from './screens/Shop.jsx'
import GameFrame from './components/GameFrame.jsx'
import { GAME_BY_ID } from './games/registry.js'

// Restore the current view from history on load (so a reload inside a game or
// the shop keeps you there, and the back button stays in sync).
const viewFromHistory = () => {
  if (typeof window === 'undefined') return { game: null, shop: false }
  const s = window.history.state
  return { game: GAME_BY_ID[s?.game] ? s.game : null, shop: !!s?.shop }
}

export default function App() {
  const [view, setView] = useState(viewFromHistory)
  // Show the welcome splash once on a fresh open (not when reloading into a game).
  const [showSplash, setShowSplash] = useState(() => {
    const v = viewFromHistory()
    return !v.game && !v.shop
  })

  // One always-on listener keeps the view matched to the browser/device back &
  // forward buttons: the view is whatever the current history entry says.
  useEffect(() => {
    const onPop = () => setView(viewFromHistory())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Opening a game (or the shop) pushes one history entry on top of Home.
  const open = (id) => {
    if (!GAME_BY_ID[id]) return
    window.history.pushState({ game: id }, '')
    setView({ game: id, shop: false })
  }
  const openShop = () => {
    window.history.pushState({ shop: true }, '')
    setView({ game: null, shop: true })
  }

  // The back arrow: step back to the Home entry (popstate syncs the view).
  // If we somehow aren't on a pushed entry, just show Home.
  const back = () => {
    const s = window.history.state
    if (s?.game || s?.shop) window.history.back()
    else setView({ game: null, shop: false })
  }

  if (showSplash && !view.game && !view.shop) return <Splash onDone={() => setShowSplash(false)} />
  if (view.game) return <GameFrame gameId={view.game} onBack={back} />
  if (view.shop) return <Shop onBack={back} />
  return <Home onOpen={open} onShop={openShop} />
}
