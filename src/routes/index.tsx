import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

export function Home() {
  return (
    <main>
      <h1>TrekkPilot</h1>
      <p>Pick a duration, get a loop route.</p>
    </main>
  )
}
