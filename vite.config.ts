import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Read an optional DBML file to embed at build time
const dbmlFilePath = process.env.VITE_DBML_FILE
const builtinDbml = dbmlFilePath
  ? fs.readFileSync(path.resolve(dbmlFilePath), 'utf-8')
  : ''

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
    __BUILTIN_DBML__: JSON.stringify(builtinDbml),
  },
  optimizeDeps: {
    include: ['@dbml/core'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'flow-vendor': ['@xyflow/react'],
          'dbml-vendor': ['@dbml/core'],
          'dagre-vendor': ['@dagrejs/dagre'],
        },
      },
    },
  },
})
