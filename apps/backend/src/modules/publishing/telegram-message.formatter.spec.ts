import {
  buildMessageBody,
  buildSourceLine,
  buildTelegramMessage,
} from './telegram-message.formatter';

const fullNews = {
  title: 'Fed raises rates by 25 basis points',
  translatedText: 'The Federal Reserve raised interest rates by 25 basis points, signaling caution.',
  summary: 'Fed hike summary fallback.',
  rawText: 'x'.repeat(5000),
  sourceUrl: 'https://example.com/fed',
  sourceName: 'CNBC',
};

describe('telegram-message.formatter', () => {
  describe('full news fixture', () => {
    it('builds title, body and source sections in order', () => {
      const msg = buildTelegramMessage(fullNews);
      const lines = msg.split('\n\n');
      expect(lines).toEqual([
        'Fed raises rates by 25 basis points',
        'The Federal Reserve raised interest rates by 25 basis points, signaling caution.',
        'Source: CNBC — https://example.com/fed',
        '#fed',
      ]);
    });

    it('is within Telegram safe length', () => {
      expect(buildTelegramMessage(fullNews).length).toBeLessThanOrEqual(3900);
    });
  });

  describe('body priority', () => {
    it('uses translatedText when available', () => {
      expect(buildMessageBody(fullNews)).toContain('Federal Reserve');
    });

    it('falls back to summary without translatedText', () => {
      expect(buildMessageBody({ ...fullNews, translatedText: null })).toBe('Fed hike summary fallback.');
    });

    it('truncates huge rawText to a word-boundary preview, never the whole text', () => {
      const body = buildMessageBody({ rawText: `word `.repeat(1000) });
      expect(body.length).toBeLessThanOrEqual(601);
      expect(body.startsWith('word')).toBe(true);
    });
  });

  describe('title handling', () => {
    it('truncates long title at word boundary', () => {
      const msg = buildTelegramMessage({ ...fullNews, title: 'word '.repeat(50) });
      const [titleLine] = msg.split('\n\n');
      expect(titleLine.length).toBeLessThanOrEqual(120);
      expect(titleLine.endsWith('word')).toBe(true);
    });

    it('does not duplicate body that repeats the title', () => {
      const msg = buildTelegramMessage({
        ...fullNews,
        title: 'Bitcoin surges',
        translatedText: 'Bitcoin surges to new highs amid ETF speculation.',
      });
      // Title упоминается один раз; повтор в начале body удалён.
      expect(msg.match(/Bitcoin surges/gi)).toHaveLength(1);
      expect(msg).toContain('to new highs amid ETF speculation');
    });
  });

  describe('source line', () => {
    it('renders name and url', () => {
      expect(buildSourceLine(fullNews)).toBe('Source: CNBC — https://example.com/fed');
    });

    it('renders only url without name', () => {
      expect(buildSourceLine({ ...fullNews, sourceName: null })).toBe('Source: https://example.com/fed');
    });

    it('omits source line without url', () => {
      const msg = buildTelegramMessage({ ...fullNews, sourceUrl: null });
      expect(msg).not.toContain('Source:');
    });
  });

  describe('length guard', () => {
    it('keeps extreme inputs under limit while preserving the link', () => {
      const msg = buildTelegramMessage({
        ...fullNews,
        title: 'T'.repeat(200),
        translatedText: 'b '.repeat(4000),
      });
      expect(msg.length).toBeLessThanOrEqual(3900);
      expect(msg).toContain('https://example.com/fed');
    });

    it('appends compliance footnote at the end, separated by empty line (Sprint 19)', () => {
      const msg = buildTelegramMessage(fullNews, ['Required disclosure text.']);
      // Hashtags come before footnotes, so footnote is at the very end after hashtags
      expect(msg.endsWith('#fed\n\nRequired disclosure text.')).toBe(true);
    });

    it('respects length budget with footnotes attached (Sprint 19)', () => {
      const msg = buildTelegramMessage({
        ...fullNews,
        translatedText: 'b '.repeat(4000),
      }, ['FA '.repeat(40)]);
      expect(msg.length).toBeLessThanOrEqual(3900);
      expect(msg.endsWith('FA'.trim()) || msg.includes('FA')).toBe(true);
      expect(msg).toContain('https://example.com/fed');
    });
  });

  describe('market impact blocks (Sprint 22a)', () => {
    const impactNews = {
      ...fullNews,
      impactThesis: 'Higher rates may pressure rate-sensitive sectors and support the dollar.',
      affectedAssets: 'OIL,SPX',
      affectedSectors: 'energy',
      timeHorizon: 'intraday',
    };

    it('includes impact thesis and assets/horizon line in order', () => {
      const msg = buildTelegramMessage(impactNews);
      const lines = msg.split('\n\n');
      expect(lines).toContain('Higher rates may pressure rate-sensitive sectors and support the dollar.');
      expect(lines).toContain('🎯 · OIL · SPX · energy · intraday');
      // Порядок: thesis до assets line, оба до source.
      const thesisIdx = lines.indexOf('Higher rates may pressure rate-sensitive sectors and support the dollar.');
      const impactIdx = lines.findIndex((l) => l.startsWith('🎯'));
      const sourceIdx = lines.findIndex((l) => l.startsWith('Source:'));
      expect(thesisIdx).toBeLessThan(impactIdx);
      expect(impactIdx).toBeLessThan(sourceIdx);
    });

    it('omits impact blocks when fields are absent (legacy news unchanged)', () => {
      const msg = buildTelegramMessage(fullNews);
      expect(msg).not.toContain('🎯');
      expect(msg).not.toContain('НЕ ПОДТВЕРЖДЕНО');
    });

    it('prepends unconfirmed banner when flagged', () => {
      const msg = buildTelegramMessage({ ...impactNews, unconfirmed: true });
      expect(msg.startsWith('⚠️ НЕ ПОДТВЕРЖДЕНО\n\n')).toBe(true);
    });

    it('does not show unconfirmed banner when flag is false/null', () => {
      expect(buildTelegramMessage({ ...impactNews, unconfirmed: false })).not.toContain('НЕ ПОДТВЕРЖДЕНО');
      expect(buildTelegramMessage({ ...impactNews, unconfirmed: null })).not.toContain('НЕ ПОДТВЕРЖДЕНО');
    });

    it('keeps compliance footnote last even with impact blocks and banner', () => {
      const msg = buildTelegramMessage({ ...impactNews, unconfirmed: true }, ['Required disclosure text.']);
      expect(msg.endsWith('Required disclosure text.')).toBe(true);
      expect(msg.length).toBeLessThanOrEqual(3900);
    });

    it('respects length budget with extreme impact fields', () => {
      const msg = buildTelegramMessage({
        ...impactNews,
        translatedText: 'b '.repeat(4000),
        impactThesis: 't '.repeat(400),
      });
      expect(msg.length).toBeLessThanOrEqual(3900);
      expect(msg).toContain('https://example.com/fed');
    });
  });
});