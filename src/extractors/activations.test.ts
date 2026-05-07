import { describe, expect, it } from 'vitest';
import { extractClaudeActivations, extractCodexActivations } from './activations';

describe('extractClaudeActivations', () => {
  it('finds Skill tool_use in message content', () => {
    const entry = {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'brainstorming' } }],
      },
    };
    expect(extractClaudeActivations(entry)).toEqual(['brainstorming']);
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
        parsed_cmd: [{ path: '/home/user/.agents/skills/brainstorming/SKILL.md' }],
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['brainstorming']);
  });

  it('finds injected skill from response_item XML', () => {
    const entry = {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '<skill>\n<name>writing-plans</name>\n</skill>' }],
      },
    };
    expect(extractCodexActivations(entry)).toEqual(['writing-plans']);
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
