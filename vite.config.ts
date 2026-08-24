import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Nitro turns the Start server into deployable output (Vercel Functions on
  // Vercel, which detects TanStack Start + Nitro with no build config). Without
  // it the build emits a self-hosted Node server that Vercel cannot serve.
  plugins: [tanstackStart(), nitro(), viteReact(), tailwindcss()],
})

export default config
