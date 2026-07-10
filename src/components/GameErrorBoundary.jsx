import { Component } from 'react'

/**
 * Catches a crash inside a single game (including a lazy chunk that failed to
 * load, e.g. offline before it was ever cached) and shows a kid-friendly card
 * instead of white-screening the whole app. Labels arrive pre-localized from
 * GameFrame because error boundaries must be class components (no hooks).
 */
export default class GameErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Game crashed:', error, info)
  }

  render() {
    const { error } = this.state
    const { labels, onRetry, onBack, children } = this.props
    if (!error) return children
    return (
      <div className="game-frame__timeout" role="alertdialog" aria-modal="true">
        <div className="game-frame__timeout-card">
          <span className="game-frame__timeout-emoji" aria-hidden="true">
            🙈
          </span>
          <p className="game-frame__timeout-title">{labels.title}</p>
          <p className="game-frame__timeout-hint">{labels.hint}</p>
          <div className="game-frame__error-actions">
            <button className="btn btn--good" onClick={onRetry}>
              {labels.retry}
            </button>
            <button className="btn" onClick={onBack}>
              {labels.home}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
