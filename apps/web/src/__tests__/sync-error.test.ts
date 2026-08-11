import { describe, expect, it } from 'vitest';
import { CONFLUENCE_SAMPLE_MARKDOWN } from '@/lib/confluence-sample';
import { categorizeSyncError } from '@/lib/sync-error';

describe('CONFLUENCE_SAMPLE_MARKDOWN', () => {
  it('includes mandatory Helix headers and sample rows (paste-ready)', () => {
    expect(CONFLUENCE_SAMPLE_MARKDOWN).toContain('| Key | Value |');
    expect(CONFLUENCE_SAMPLE_MARKDOWN).toContain('| Name | Helix Commerce |');
    expect(CONFLUENCE_SAMPLE_MARKDOWN).toContain('| Team Name | Queue Key | Tribe | Domain |');
    expect(CONFLUENCE_SAMPLE_MARKDOWN).toContain('| Cart & Checkout | HLX-CHK |');
    expect(CONFLUENCE_SAMPLE_MARKDOWN).toContain('| Catalog Search | HLX-SRC |');
    // Never ship secrets in the sample payload.
    expect(CONFLUENCE_SAMPLE_MARKDOWN).not.toMatch(/api[_-]?token|bearer|password/i);
  });
});

describe('categorizeSyncError', () => {
  it('treats 422 / table parse messages as structure', () => {
    expect(
      categorizeSyncError(
        422,
        'Confluence page 1: teams table (with "Team Name" and "Queue Key" columns) not found',
      ),
    ).toBe('structure');
    expect(
      categorizeSyncError(null, 'Teams table for "Helix" is missing required column(s): Queue Key'),
    ).toBe('structure');
    expect(categorizeSyncError(500, 'row 2: missing Team Name')).toBe('structure');
  });

  it('treats auth, PAGE_IDS, and upstream Confluence failures as config', () => {
    expect(
      categorizeSyncError(
        502,
        'Confluence authentication failed (401). Set CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN in .env',
      ),
    ).toBe('config');
    expect(
      categorizeSyncError(
        500,
        'CONFLUENCE_PAGE_IDS is empty — nothing to sync. Set CONFLUENCE_PAGE_IDS in .env',
      ),
    ).toBe('config');
    expect(categorizeSyncError(502, 'Confluence page not found (404). Check CONFLUENCE_PAGE_IDS')).toBe(
      'config',
    );
    expect(categorizeSyncError(403, 'Forbidden')).toBe('config');
  });
});
