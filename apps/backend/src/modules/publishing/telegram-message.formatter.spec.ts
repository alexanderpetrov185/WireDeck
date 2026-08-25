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
  });
});