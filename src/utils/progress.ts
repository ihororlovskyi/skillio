const WIDTH = 10;

export interface ProgressOut {
  isTTY: boolean;
  write: (s: string) => void;
}

// null draws an unknown total: a two-cell block that moves with `frame`, no percent
export function renderBar(fraction: number | null, frame = 0): string {
  if (fraction === null) {
    const pos = frame % (WIDTH - 1);
    return `${'░'.repeat(pos)}██${'░'.repeat(WIDTH - 2 - pos)}`;
  }
  const f = Math.min(1, Math.max(0, fraction));
  const full = Math.floor(f * WIDTH);
  return `${'█'.repeat(full)}${'░'.repeat(WIDTH - full)} ${Math.floor(f * 100)}%`;
}

export interface Progress {
  update(fraction: number | null): void;
  done(summary: string): void;
  fail(): void;
}

const stdoutOut: ProgressOut = {
  get isTTY() {
    return Boolean(process.stdout.isTTY);
  },
  write: (s) => {
    process.stdout.write(s);
  },
};

// Frames only in a TTY; scripts and CI get just the final line from console.log
export function createProgress(label: string, out: ProgressOut = stdoutOut): Progress {
  let frame = 0;
  let drawn = false;
  return {
    update(fraction) {
      if (!out.isTTY) return;
      out.write(`\r\x1b[2K${label} ${renderBar(fraction, frame++)}`);
      drawn = true;
    },
    done(summary) {
      if (drawn) out.write('\r\x1b[2K');
      console.log(`${label} ${renderBar(1)} · ${summary}`);
    },
    fail() {
      if (drawn) out.write('\n');
      else console.log(label);
    },
  };
}
