import { describe, expect, it } from 'vitest';
import { run } from './helpers';

describe('skl completion', () => {
  it('prints bash completion script', () => {
    const { stdout, exitCode } = run(['completion', 'bash'], process.cwd());
    expect(exitCode).toBe(0);
    expect(stdout).toContain('_skillio_completions()');
    expect(stdout).toContain('complete -F _skillio_completions skl');
    expect(stdout).toContain('skl list --names');
  });

  it('prints zsh completion script', () => {
    const { stdout, exitCode } = run(['completion', 'zsh'], process.cwd());
    expect(exitCode).toBe(0);
    expect(stdout).toContain('compdef _skillio skl skillio');
    expect(stdout).toContain('skl list --names');
  });

  it('prints fish completion script', () => {
    const { stdout, exitCode } = run(['completion', 'fish'], process.cwd());
    expect(exitCode).toBe(0);
    expect(stdout).toContain('__skillio_skill_names');
    expect(stdout).toContain('skl list --names');
  });

  it('errors on unknown shell with exit 1', () => {
    const { stderr, exitCode } = run(['completion', 'ohmyzsh'], process.cwd());
    expect(exitCode).toBe(1);
    expect(stderr).toContain('unknown shell: ohmyzsh');
  });

  it('completes commands and install/rm flags in every shell', () => {
    const bash = run(['completion', 'bash'], process.cwd()).stdout;
    expect(bash).toContain('local cmds="list ls remove rm cost cst usage usg completion install i"');
    expect(bash).toContain('install|i)');
    expect(bash).toContain('-ln --link -s --skill -x --reject -a --agent -y --yes -m --mode');
    expect(bash).toContain('compgen -W "codex claude-code"');
    expect(bash).toContain('compgen -W "silent"');
    expect(bash).not.toMatch(/symlink|stealth|-sm/);
    const zsh = run(['completion', 'zsh'], process.cwd()).stdout;
    expect(zsh).toContain("'install:Install skills or symlink a local clone'");
    expect(zsh).toContain('install|i)');
    expect(zsh).toContain("'-ln[symlink a local clone]'");
    expect(zsh).not.toMatch(/symlink:|stealth|-sm\[|'cs:|'us:/);
    const fish = run(['completion', 'fish'], process.cwd()).stdout;
    expect(fish).toContain("-a 'list ls remove rm cost cst usage usg completion install i'");
    expect(fish).toContain("-o ln -l link -d 'Symlink from a local clone'");
    expect(fish).toContain("-s a -l agent -xa 'codex claude-code'");
    expect(fish).toContain("-s m -l mode -xa 'silent'");
    expect(fish).not.toMatch(/symlink sym sl|stealth/);
  });
});
