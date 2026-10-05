import { useFillToasts, useToasts } from '../stores/ui/toasts'

export function Toasts() {
  useFillToasts()
  const { toasts, dismiss } = useToasts()
  return (
    <div className="toasts" aria-live="polite">
      {toasts?.map(t => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss?.(t.id)}>
          <b>{t.title}</b>
          {t.body && <div className="muted">{t.body}</div>}
        </div>
      ))}
    </div>
  )
}
