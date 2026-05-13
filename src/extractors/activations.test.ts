import { describe, expect, it } from 'vitest';
import { extractClaudeActivations, extractCodexActivations } from './activations';

describe('extractClaudeActivations', () => {
  it('finds Skill tool_use in message content', () => {
    const entry = {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'skill-foo' } }],
      },
    };
    expect(extractClaudeActivations(entry)).toEqual(['skill-foo']);
  });

  it('finds multiple Skill invocations', () => {
    const entry = {
      content: [
        { type: 'tool_use', name: 'Skill', input: { skill: 'foo' } },
        { type: 'tool_use', name: 'Skill', input: { skill: 'bar' } },
      ],
    };
    expect(extractClaudeActivations(entry)).toEqual(['foo', 'bar']);
  });

  it('ignores non-Skill tool_use nodes', () => {
    const entry = { type: 'tool_use', name: 'Bash', input: { command: 'ls' } };
    expect(extractClaudeActivations(entry)).toEqual([]);
  });

  it('returns empty for unrelated entries', () => {
    expect(extractClaudeActivations({ attributionSkill: 'x' })).toEqual([]);
  });
});

describe('extractCodexActivations', () => {
  it('finds skill from exec_command_end SKILL.md path', () => {
    const entry = {
      type: 'event_msg',
      payload: {
        type: 'exec_command_end',
        parsed_cmd: [{ path: '/home/user/.agents/skills/skill-foo/SKILL.md' }],
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['skill-foo']);
  });

  it('finds injected skill from response_item XML', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '<skill>\n<name>skill-bar</name>\n</skill>' }],
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['skill-bar']);
  });

  it('ignores non-SKILL.md paths', () => {
    const entry = {
      type: 'event_msg',
      payload: { type: 'exec_command_end', parsed_cmd: [{ path: '/home/user/foo.md' }] },
    };
    expect(extractCodexActivations(entry)).toEqual([]);
  });

  it('returns empty for unrelated entries', () => {
    expect(extractCodexActivations({ type: 'other' })).toEqual([]);
  });
});

describe('extractCodexActivations response_item/function_call', () => {
  it('finds skill from cat /path/SKILL.md inside function_call arguments', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({
          cmd: 'cat /Users/x/.agents/skills/skill-foo/SKILL.md',
        }),
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['skill-foo']);
  });

  it('finds skill from sed -n inside function_call arguments', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({
          cmd: "sed -n '1,180p' /home/y/.claude/skills/skill-bar/SKILL.md",
        }),
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['skill-bar']);
  });

  it('dedupes multiple references to the same SKILL.md in one command', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({
          cmd: 'cat /a/skill-foo/SKILL.md /a/skill-foo/SKILL.md',
        }),
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['skill-foo']);
  });

  it('returns empty array when arguments is not valid JSON', () => {
    const entry = {
      type: 'response_item',
      payload: { type: 'function_call', name: 'exec_command', arguments: 'not-json' },
    };
    expect(extractCodexActivations(entry)).toEqual([]);
  });

  it('returns empty array when cmd has no SKILL.md path', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'ls /tmp' }),
      },
    };
    expect(extractCodexActivations(entry)).toEqual([]);
  });

  it('ignores function_call entries with a different name', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'shell',
        arguments: JSON.stringify({ cmd: 'cat /a/skill-foo/SKILL.md' }),
      },
    };
    expect(extractCodexActivations(entry)).toEqual([]);
  });
});
