import { walk } from '../utils/walk';

export function extractClaudeActivations(entry: unknown): string[] {
  const skills: string[] = [];
  walk(entry, (node) => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Record<string, unknown>;
    if (n.type === 'tool_use' && n.name === 'Skill' && typeof n.input === 'object') {
      const skill = (n.input as Record<string, unknown>).skill;
      if (typeof skill === 'string') skills.push(skill);
    }
  });
  return skills;
}

function skillNameFromPath(p: string): string | null {
  const parts = p.replace('/SKILL.md', '').split('/');
  return parts[parts.length - 1] ?? null;
}

export function extractCodexActivations(entry: unknown): string[] {
  if (typeof entry !== 'object' || entry === null) return [];
  const e = entry as Record<string, unknown>;
  const payload = e.payload as Record<string, unknown> | undefined;

  if (e.type === 'response_item' && payload?.type === 'message' && payload?.role === 'user') {
    const skills = new Set<string>();
    const content = (payload?.content as unknown[] | undefined) ?? [];
    for (const item of content) {
      const i = item as Record<string, unknown>;
      if (i.type === 'input_text' && typeof i.text === 'string') {
        for (const m of i.text.matchAll(/<skill>\s*<name>([^<]+)<\/name>/g)) {
          if (m[1] !== undefined) skills.add(m[1]);
        }
      }
    }
    return [...skills];
  }

  if (e.type === 'event_msg' && payload?.type === 'exec_command_end') {
    const cmds = (payload?.parsed_cmd as Array<Record<string, unknown>> | undefined) ?? [];
    const paths = new Set<string>();
    for (const cmd of cmds) {
      if (typeof cmd.path === 'string' && cmd.path.endsWith('/SKILL.md')) {
        paths.add(cmd.path);
      }
    }
    return [...paths].map(skillNameFromPath).filter((s): s is string => s !== null);
  }

  if (
    e.type === 'response_item' &&
    payload?.type === 'function_call' &&
    payload?.name === 'exec_command'
  ) {
    const argsStr = payload?.arguments;
    if (typeof argsStr !== 'string') return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      return [];
    }
    const cmd = (parsed as Record<string, unknown> | null)?.cmd;
    if (typeof cmd !== 'string') return [];
    const paths = new Set<string>();
    for (const m of cmd.matchAll(/(?:^|['"\s])([^'"\s]+\/SKILL\.md)(?=$|['"\s])/g)) {
      if (m[1]) paths.add(m[1]);
    }
    return [...paths].map(skillNameFromPath).filter((s): s is string => s !== null);
  }

  return [];
}
