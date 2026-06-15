import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ProgressProvider } from './state/progress.jsx'
import { RewardProvider } from './state/reward.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProgressProvider>
      <RewardProvider>
        <App />
      </RewardProvider>
    </ProgressProvider>
  </React.StrictMode>,
)

// The offline service worker is generated and auto-registered by vite-plugin-pwa
// (see vite.config.js). It precaches every built asset, so the whole game works
// offline after the first visit.
