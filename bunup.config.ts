import { defineConfig } from 'bunup'

// clean is disabled per-entry because both entries share outDir 'dist': bunup
// cleans outDir at the start of each entry build, so the cli entry would wipe
// the index entry's output (dist/index.*). The build script removes dist once
// before running bunup instead.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    outDir: 'dist',
  },
])
