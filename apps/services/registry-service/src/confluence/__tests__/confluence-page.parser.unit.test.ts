import { describe, expect, it } from 'vitest';

import { TeamSchema } from '@orbit/shared';

import { AppError } from '../../common/app-error';
import { ConfluencePageParser } from '../confluence-page.parser';

// ---- storage-format fixture builders --------------------------------------

function xTable(headerCells: string[], rows: string[][]): string {
  const header = `<tr>${headerCells.map((h) => `<th><p><strong>${h}</strong></p></th>`).join('')}</tr>`;
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`)
    .join('');
  return `<table class="wrapped"><colgroup><col/><col/></colgroup><tbody>${header}${body}</tbody></table>`;
}

function configTable(entries: Array<[string, string]>): string {
  return xTable(['Key', 'Value'], entries);
}

const TEAM_HEADERS = [
  'Team Name',
  'Queue Key',
  'Tribe',
  'Domain',
  'Description',
  'Applications',
  'Keywords',
  'Icon',
  'Color',
  'Channel',
  'Team Lead',
  'On-call',
];

/** row helper in canonical column order */
function teamRow(overrides: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    'Team Name': 'Checkout',
    'Queue Key': 'PAY-CHK',
    Tribe: 'Acceptance',
    Domain: 'Payments &amp; Billing',
    Description: 'Hosted&nbsp;checkout and card forms.',
    Applications: 'Checkout Web, Pay SDK',
    Keywords: 'payment failed, 3ds',
    Icon: 'cart',
    Color: '',
    Channel: '#pay-checkout',
    'Team Lead': 'Mara Kis',
    'On-call': 'pay-checkout-oncall',
  };
  const merged = { ...base, ...overrides };
  return TEAM_HEADERS.map((h) => merged[h] ?? '');
}

const PAGE_PRELUDE =
  '<p>Team registry — edited in Confluence.</p><ac:structured-macro ac:name="toc" ac:schema-version="1"/>';

const NOVA_CONFIG = configTable([
  ['Name', 'NovaPay'],
  ['Icon', 'wallet'],
  ['Color', '245'],
  ['Description', 'Payments and financial risk arm of the group.'],
]);

function pageOf(...parts: string[]): string {
  return `${PAGE_PRELUDE}${parts.join('')}`;
}

const CTX = { pageId: '84213977', position: 0 };

describe('ConfluencePageParser', () => {
  const parser = new ConfluencePageParser();

  it('parses the happy path: config + teams table, derived domains/tribes, validated teams', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [
        teamRow(),
        teamRow({
          'Team Name': 'Card Processing',
          'Queue Key': 'PAY-CRD',
          Description: 'Card authorization and capture.',
          Applications: 'AuthGateway',
          Keywords: 'declined card, acquirer',
          Icon: 'card',
          Color: '250',
          Channel: '',
          'Team Lead': '',
          'On-call': '',
        }),
        teamRow({
          'Team Name': 'Fraud Detection',
          'Queue Key': 'RSK-FRD',
          Tribe: 'Financial Crime',
          Domain: 'Risk &amp; Compliance',
          Icon: 'shield',
          Channel: '',
        }),
      ]),
    );

    const parsed = parser.parsePage(html, CTX);

    // company from the config table
    expect(parsed.company).toMatchObject({
      slug: 'novapay',
      name: 'NovaPay',
      icon: 'wallet',
      hue: 245,
      description: 'Payments and financial risk arm of the group.',
      confluencePageId: '84213977',
      position: 0,
    });

    // domains grouped from team rows, order of first appearance
    expect(parsed.domains.map((d) => d.name)).toEqual(['Payments & Billing', 'Risk & Compliance']);
    expect(parsed.domains[0]).toMatchObject({
      slug: 'novapay-payments-billing',
      companySlug: 'novapay',
      position: 0,
    });

    // tribes from (Domain, Tribe) pairs in row order
    expect(parsed.tribes.map((t) => t.name)).toEqual(['Acceptance', 'Financial Crime']);
    expect(parsed.tribes[0]).toMatchObject({
      slug: 'novapay-payments-billing-acceptance',
      domainSlug: 'novapay-payments-billing',
      position: 0,
    });

    // teams validated against the shared schema
    expect(parsed.teams).toHaveLength(3);
    for (const team of parsed.teams) expect(() => TeamSchema.parse(team)).not.toThrow();

    const checkout = parsed.teams[0]!;
    expect(checkout.queueKey).toBe('PAY-CHK');
    expect(checkout.tribeSlug).toBe('novapay-payments-billing-acceptance');
    expect(checkout.description).toBe('Hosted checkout and card forms.'); // &nbsp; handled
    expect(checkout.apps).toEqual(['Checkout Web', 'Pay SDK']);
    expect(checkout.keywords).toEqual(['payment failed', '3ds']);
    expect(checkout.hue).toBeNull(); // empty Color -> null (domain hue downstream)
    expect(checkout.channel).toBe('#pay-checkout');

    const card = parsed.teams[1]!;
    expect(card.hue).toBe(250);
    expect(card.channel).toBeNull();
    expect(card.lead).toBeNull();
    expect(card.oncall).toBeNull();
  });

  it('matches headers case-insensitively by name, not by position', () => {
    const reordered = ['queue key', 'ICON', 'Team Name', 'DOMAIN', 'tribe', 'Color', 'Keywords'];
    const html = pageOf(
      NOVA_CONFIG,
      xTable(reordered, [['PAY-CHK', 'cart', 'Checkout', 'Payments', 'Acceptance', '30', 'a, b']]),
    );

    const parsed = parser.parsePage(html, CTX);
    const team = parsed.teams[0]!;
    expect(team).toMatchObject({
      queueKey: 'PAY-CHK',
      name: 'Checkout',
      icon: 'cart',
      hue: 30,
      keywords: ['a', 'b'],
    });
    expect(parsed.domains[0]!.name).toBe('Payments');
  });

  it('merges the optional Domains table (color + description); others fall back to the palette', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(
        ['Name', 'Color', 'Description'],
        [['Payments &amp; Billing', '215', 'Money in, money out.']],
      ),
      xTable(TEAM_HEADERS, [
        teamRow(),
        teamRow({
          'Team Name': 'Fraud',
          'Queue Key': 'RSK-FRD',
          Tribe: 'Financial Crime',
          Domain: 'Risk',
        }),
      ]),
    );

    const parsed = parser.parsePage(html, CTX);
    expect(parsed.domains[0]).toMatchObject({ hue: 215, description: 'Money in, money out.' });
    // second domain not in the table -> assigned palette hue for position 1
    expect(parsed.domains[1]!.hue).toBe(346);
    expect(parsed.domains[1]!.description).toBe('');
  });

  it('parses the optional Links table and uppercases keys', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [teamRow()]),
      xTable(
        ['Source Key', 'Target Key', 'Reason'],
        [
          ['PAY-CHK', 'DATA-FRM', 'fraud scoring at checkout'],
          ['pay-chk', 'PAY-RTE', ''],
        ],
      ),
    );

    const parsed = parser.parsePage(html, CTX);
    expect(parsed.links).toEqual([
      { source: 'PAY-CHK', target: 'DATA-FRM', reason: 'fraud scoring at checkout' },
      { source: 'PAY-CHK', target: 'PAY-RTE', reason: '' },
    ]);
  });

  it('strips status macros / emoticons / user links to plain text', () => {
    const decoratedName =
      '<ac:structured-macro ac:name="status" ac:schema-version="1">' +
      '<ac:parameter ac:name="title">LIVE</ac:parameter>' +
      '</ac:structured-macro> Checkout <ac:emoticon ac:name="smile" ac:emoji-fallback="X"/>';
    const decoratedLead =
      '<ac:link><ri:user ri:account-id="abc123"/></ac:link>Mara Kis';
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [teamRow({ 'Team Name': decoratedName, 'Team Lead': decoratedLead })]),
    );

    const parsed = parser.parsePage(html, CTX);
    expect(parsed.teams[0]!.name).toBe('Checkout');
    expect(parsed.teams[0]!.lead).toBe('Mara Kis');
  });

  it('fails loudly when the config table is missing', () => {
    const html = pageOf(xTable(TEAM_HEADERS, [teamRow()]));
    expect(() => parser.parsePage(html, CTX)).toThrowError(/config table/i);
  });

  it('fails loudly when the teams table is missing (never silently empty)', () => {
    const html = pageOf(NOVA_CONFIG);
    try {
      parser.parsePage(html, CTX);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(422);
      expect((error as AppError).message).toMatch(/teams table/i);
      expect((error as AppError).message).toContain('NovaPay');
    }
  });

  it('rejects a bad hue row, naming company and row', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [teamRow({ 'Team Name': 'Refunds', 'Queue Key': 'PAY-REF', Color: '999' })]),
    );
    try {
      parser.parsePage(html, CTX);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const message = (error as AppError).message;
      expect(message).toMatch(/invalid hue "999"/);
      expect(message).toContain('NovaPay');
      expect(message).toContain('Refunds');
    }
  });

  it('rejects duplicate queue keys within a page, naming both rows', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [
        teamRow({ 'Team Name': 'Checkout' }),
        teamRow({ 'Team Name': 'Checkout Clone' }),
      ]),
    );
    try {
      parser.parsePage(html, CTX);
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as AppError).message;
      expect(message).toContain('Duplicate queue key "PAY-CHK"');
      expect(message).toContain('Checkout');
      expect(message).toContain('Checkout Clone');
    }
  });

  it('collects row-level errors (missing key, invalid key format) with row context', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [
        teamRow({ 'Team Name': 'No Key', 'Queue Key': '' }),
        teamRow({ 'Team Name': 'Bad Key', 'Queue Key': 'not a key' }),
      ]),
    );
    try {
      parser.parsePage(html, CTX);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const details = (error as AppError).details as string[];
      expect(details.some((d) => d.includes('missing Queue Key') && d.includes('No Key'))).toBe(true);
      expect(details.some((d) => d.includes('invalid Queue Key') && d.includes('Bad Key'))).toBe(true);
    }
  });

  it('falls back to the "box" icon for unknown icon names (never fails a sync over an icon)', () => {
    const html = pageOf(
      NOVA_CONFIG,
      xTable(TEAM_HEADERS, [teamRow({ Icon: 'definitely-not-an-icon' })]),
    );
    expect(parser.parsePage(html, CTX).teams[0]!.icon).toBe('box');
  });

  it('company Color missing falls back to a palette hue; teams table required columns enforced', () => {
    const config = configTable([['Name', 'Meridian']]);
    const html = pageOf(config, xTable(TEAM_HEADERS, [teamRow({ 'Queue Key': 'MER-ONE' })]));
    const parsed = parser.parsePage(html, { pageId: 'p2', position: 1 });
    expect(parsed.company.hue).toBe(346); // palette[1]

    const missingColumns = pageOf(config, xTable(['Team Name', 'Queue Key'], [['A', 'MER-TWO']]));
    expect(() => parser.parsePage(missingColumns, { pageId: 'p2', position: 1 })).toThrowError(
      /missing required column/i,
    );
  });
});
