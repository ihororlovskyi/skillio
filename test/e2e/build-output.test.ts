import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards against a bunup config regression where the cli entry's outDir clean
// wiped the index entry's dist/index.* output, silently shipping a package
// whose "exports" and "bin" paths do not exist. Runs against the built dist/.
describe('build output', () => {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  function collectPaths(node: unknown, out: Set<string>): void {
    if (typeof node === 'string') {
      if (node.startsWith('./dist/')) out.add(node.slice(2));
      return;
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node)) collectPaths(v, out);
    }
  }

  it('emits every file referenced by package.json exports and bin', () => {
    const declared = new Set<string>();
    collectPaths(pkg.exports, declared);
    collectPaths(pkg.bin, declared);
    // bin values are bare "dist/cli.js" (no ./ prefix), add them explicitly
    for (const v of Object.values(pkg.bin ?? {})) {
      if (typeof v === 'string') declared.add(v);
    }

    const missing = [...declared].filter((p) => !existsSync(resolve(root, p)));
    expect(missing).toEqual([]);
  });
});
