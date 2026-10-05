import { Component, type ReactNode } from 'react'

type Props = { name: string, className: string, children: ReactNode }

/**
 * A panel's error boundary. A store hook that throws disables that store, and the components reading
 * it throw its error: the panel that reads it shows the error, and the rest of the terminal keeps
 * running. Retry renders the panel again, which starts a fresh instance once the failed one is torn
 * down (it is as soon as nothing reads it).
 */
export class PanelBoundary extends Component<Props, { error?: unknown }> {
  state: { error?: unknown } = {}

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error === undefined) return this.props.children
    return (
      <section className={`panel panel-failed ${this.props.className}`} role="alert">
        <div className="panel-head"><span className="panel-title">{this.props.name}</span></div>
        <p>{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={() => this.setState({ error: undefined })}>Retry</button>
      </section>
    )
  }
}
