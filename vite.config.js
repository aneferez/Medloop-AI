import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20000,
          groups: [
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    // Background-task worktrees live inside the project, so their copies of the
    // suite would otherwise be collected alongside this tree's — running
    // everything once per worktree and reporting failures that are not ours.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
})
