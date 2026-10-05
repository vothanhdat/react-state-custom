import { useEffect, useLayoutEffect, useState } from 'react'
import { useFeedStats } from '../stores/ui/header'

// Commits per panel, counted in a layout effect so StrictMode's double render does not count twice.
const commits = new Map<string, number>()

export const useCommitCounter = (panel: string) => {
  useLayoutEffect(() => {
    commits.set(panel, (commits.get(panel) ?? 0) + 1)
  })
}

type Sample = {
  fps: number
  longFrames: number
  worstFrame: number
  commits: [string, number][]
}

const useSamples = () => {
  const [sample, setSample] = useState<Sample>()
  useEffect(() => {
    let frames = 0
    let longFrames = 0
    let worst = 0
    let last = performance.now()
    let raf = requestAnimationFrame(function loop(now) {
      const gap = now - last
      last = now
      frames++
      if (gap > 50) longFrames++
      worst = Math.max(worst, gap)
      raf = requestAnimationFrame(loop)
    })
    let previous = new Map(commits)
    let at = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const seconds = (now - at) / 1000
      at = now
      const rates: [string, number][] = []
      for (const [panel, count] of commits) rates.push([panel, Math.round((count - (previous.get(panel) ?? 0)) / seconds)])
      previous = new Map(commits)
      setSample({
        fps: Math.round(frames / seconds),
        longFrames,
        worstFrame: Math.round(worst),
        commits: rates.sort((a, b) => b[1] - a[1]),
      })
      frames = 0
      longFrames = 0
      worst = 0
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
    }
  }, [])
  return sample
}

export function PerfHud() {
  const sample = useSamples()
  const { messagesPerSecond, simMsPerSecond } = useFeedStats()
  const [open, setOpen] = useState(false)
  if (!sample) return null
  const totalCommits = sample.commits.reduce((sum, [, n]) => sum + n, 0)
  return (
    <div className="perf">
      <button className="perf-summary" onClick={() => setOpen(o => !o)} title="Commits per second by panel">
        <b className={sample.fps < 50 ? 'neg' : ''}>{sample.fps}</b> fps
        <span>{messagesPerSecond}</span> msg/s
        <span>{totalCommits}</span> commits/s
        <span className={sample.longFrames ? 'neg' : ''}>{sample.longFrames}</span> long
      </button>
      {open && (
        <div className="perf-panel">
          <div>worst frame {sample.worstFrame} ms · simulator {simMsPerSecond?.toFixed(0)} ms/s</div>
          <table>
            <tbody>
              {sample.commits.map(([panel, n]) => (
                <tr key={panel}><td>{panel}</td><td>{n}/s</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
