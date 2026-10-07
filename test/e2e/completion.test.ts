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

  it('completes install/symlink commands and symlink flags in every shell', () => {
    const bash = run(['completion', 'bash'], process.cwd()).stdout;
    expect(bash).toContain('local cmds="list ls remove rm cost cs cst usage us usg completion install i symlink sym sl"');
    expect(bash).toContain('symlink|sym|sl)');
    expect(bash).toContain('compgen -W "codex claude-code"');
    const zsh = run(['completion', 'zsh'], process.cwd()).stdout;
    expect(zsh).toContain("'symlink:Symlink skills from a local clone'");
    expect(zsh).toContain('symlink|sym|sl)');
    const fish = run(['completion', 'fish'], process.cwd()).stdout;
    expect(fish).toContain("-a 'list ls remove rm cost cs cst usage us usg completion install i symlink sym sl'");
    expect(fish).toContain("-s a -l agent -xa 'codex claude-code'");
  });
});
