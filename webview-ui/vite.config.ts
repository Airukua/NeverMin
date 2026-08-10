import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: path.resolve(rootDir, '../dist/webview'),
    emptyOutDir: true,
    assetsDir: 'assets',
    // Keep warning useful for real regressions; vendor split keeps entry under this.
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'xyflow', test: /node_modules[\\/]@xyflow[\\/]/ },
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/
            },
            { name: 'lucide', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'react-icons', test: /node_modules[\\/]react-icons[\\/]/ }
          ]
        }
      }
    }
  }
})
