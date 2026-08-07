import { describe, expect, it } from 'vitest';

import { splitSqlStatements } from '../sql-splitter';

describe('splitSqlStatements', () => {
  it('splits on top-level semicolons and drops empty fragments', () => {
    expect(splitSqlStatements('CREATE TABLE a (id int);\n\nCREATE TABLE b (id int);;')).toEqual([
      'CREATE TABLE a (id int)',
      'CREATE TABLE b (id int)',
    ]);
  });

  it('keeps semicolons inside single-quoted strings (incl. escaped quotes)', () => {
    const out = splitSqlStatements("INSERT INTO t VALUES ('a;b', 'it''s;fine'); SELECT 1;");
    expect(out).toEqual(["INSERT INTO t VALUES ('a;b', 'it''s;fine')", 'SELECT 1']);
  });

  it('keeps semicolons inside comments and dollar-quoted bodies', () => {
    const script = [
      '-- leading comment; with semicolon',
      'CREATE FUNCTION f() RETURNS void AS $body$ BEGIN PERFORM 1; END $body$ LANGUAGE plpgsql;',
      '/* block; comment */ SELECT 2;',
    ].join('\n');
    const out = splitSqlStatements(script);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('PERFORM 1; END');
    expect(out[1]).toContain('SELECT 2');
  });

  it('emits a trailing statement without a final semicolon', () => {
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('splits the real migration file into multiple executable statements', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(join(__dirname, '..', 'migrations', '0001_init.sql'), 'utf8');
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBeGreaterThan(8);
    expect(statements[0]).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    for (const statement of statements) expect(statement.trim()).not.toBe('');
  });
});
