/**
 * Splits a SQL script into individual statements on top-level semicolons.
 * Safely skips semicolons inside single-quoted strings, double-quoted
 * identifiers, dollar-quoted bodies, line comments and block comments.
 */
export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  type Mode = 'plain' | 'single' | 'double' | 'dollar' | 'line-comment' | 'block-comment';
  let mode: Mode = 'plain';
  let dollarTag = '';

  while (i < script.length) {
    const ch = script[i] as string;
    const next = script[i + 1] ?? '';

    switch (mode) {
      case 'plain': {
        if (ch === "'") {
          mode = 'single';
        } else if (ch === '"') {
          mode = 'double';
        } else if (ch === '-' && next === '-') {
          mode = 'line-comment';
        } else if (ch === '/' && next === '*') {
          mode = 'block-comment';
        } else if (ch === '$') {
          const match = /^\$[A-Za-z_]*\$/.exec(script.slice(i));
          if (match) {
            mode = 'dollar';
            dollarTag = match[0];
            current += dollarTag;
            i += dollarTag.length;
            continue;
          }
        } else if (ch === ';') {
          const trimmed = current.trim();
          if (trimmed) statements.push(trimmed);
          current = '';
          i += 1;
          continue;
        }
        break;
      }
      case 'single': {
        if (ch === "'" && next === "'") {
          current += "''";
          i += 2;
          continue;
        }
        if (ch === "'") mode = 'plain';
        break;
      }
      case 'double': {
        if (ch === '"') mode = 'plain';
        break;
      }
      case 'dollar': {
        if (script.startsWith(dollarTag, i)) {
          current += dollarTag;
          i += dollarTag.length;
          mode = 'plain';
          dollarTag = '';
          continue;
        }
        break;
      }
      case 'line-comment': {
        if (ch === '\n') mode = 'plain';
        break;
      }
      case 'block-comment': {
        if (ch === '*' && next === '/') {
          current += '*/';
          i += 2;
          mode = 'plain';
          continue;
        }
        break;
      }
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}
