import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../apple-music-import-v064.js', import.meta.url), 'utf8');

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function makeResolver({ piped = [], invidious = [], details = {} }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div id="status"></div><div id="songSearchStatus"></div><div id="songSearchResults"></div>
    <form id="songSearchForm"><input id="songSearchInput"></form>
  </body></html>`, {
    url: 'https://bambuchastudent.github.io/winampmusic/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.console = console;
  window.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/search') {
      return response({
        items: piped.map((candidate) => ({
          type: 'stream',
          url: `https://www.youtube.com/watch?v=${candidate.id}`,
          title: candidate.title,
          uploaderName: candidate.artist,
          duration: candidate.duration,
          thumbnail: '',
        })),
      });
    }
    if (url.pathname === '/api/v1/search') {
      return response(invidious.map((candidate) => ({
        type: 'video',
        videoId: candidate.id,
        title: candidate.title,
        author: candidate.artist,
        lengthSeconds: candidate.duration,
        liveNow: Boolean(candidate.liveNow),
      })));
    }
    const match = url.pathname.match(/^\/api\/v1\/videos\/([A-Za-z0-9_-]{11})$/);
    if (match) {
      const detail = details[match[1]];
      return detail ? response({ videoId: match[1], ...detail }) : response({ error: 'not found' }, 404);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  window.eval(source);
  return {
    dom,
    find: window.winampMusicAppleImport.findYouTubeMatch,
  };
}

async function expectNoMatch(config, metadata) {
  const { dom, find } = makeResolver(config);
  try {
    await assert.rejects(
      () => find(metadata, new dom.window.AbortController().signal),
      /No reliable YouTube match found/,
    );
  } finally {
    dom.window.close();
  }
}

const madigan = { title: 'The News', artist: 'Madigan', durationMs: 279000 };

// Regression: a Piped text hit must not prevent Invidious from contributing the
// actual music candidate, and the news video must never win.
{
  const { dom, find } = makeResolver({
    piped: [{
      id: 'rWWNZigf7PA',
      title: 'Madigan The News',
      artist: 'Madigan News',
      duration: 1260,
    }],
    invidious: [{
      id: 's1b8Q5avQZs',
      title: 'Madigan - The News',
      artist: 'Madigan - Topic',
      duration: 279,
    }],
    details: {
      rWWNZigf7PA: {
        title: 'Madigan The News',
        author: 'Madigan News',
        genre: 'News & Politics',
        description: 'News coverage and interviews',
        keywords: ['news'],
        lengthSeconds: 1260,
        liveNow: false,
        musicTracks: [],
      },
      s1b8Q5avQZs: {
        title: 'Madigan - The News',
        author: 'Madigan - Topic',
        genre: 'Music',
        description: 'Provided to YouTube by the rights holder',
        keywords: ['music', 'Madigan', 'The News'],
        lengthSeconds: 279,
        liveNow: false,
        musicTracks: [{ song: 'The News', artist: 'Madigan' }],
      },
    },
  });
  const match = await find(madigan, new dom.window.AbortController().signal);
  assert.equal(match.id, 's1b8Q5avQZs', 'Madigan — The News must resolve to the music recording');
  assert.notEqual(match.id, 'rWWNZigf7PA', 'the news video must be rejected');
  dom.window.close();
}

// Strong lexical overlap is not enough when the candidate is explicitly non-music.
await expectNoMatch({
  piped: [{ id: 'NEWSMATCH01', title: 'Madigan - The News', artist: 'Madigan', duration: 279 }],
  invidious: [{ id: 'NEWSMATCH01', title: 'Madigan - The News', artist: 'Madigan', duration: 279 }],
  details: {
    NEWSMATCH01: {
      title: 'Madigan - The News',
      author: 'Madigan',
      genre: 'News & Politics',
      description: 'Daily news bulletin',
      keywords: ['news'],
      lengthSeconds: 279,
      liveNow: false,
      musicTracks: [],
    },
  },
}, madigan);

// A clear music candidate still fails when its duration is incompatible with the source recording.
await expectNoMatch({
  invidious: [{ id: 'MUSICLONG01', title: 'Madigan - The News', artist: 'Madigan - Topic', duration: 900 }],
  details: {
    MUSICLONG01: {
      title: 'Madigan - The News',
      author: 'Madigan - Topic',
      genre: 'Music',
      description: 'Provided to YouTube by Example Records',
      keywords: ['music'],
      lengthSeconds: 900,
      liveNow: false,
      musicTracks: [{ song: 'The News', artist: 'Madigan' }],
    },
  },
}, madigan);

// Among trustworthy, duration-compatible music results, stronger official music evidence wins.
{
  const { dom, find } = makeResolver({
    invidious: [
      { id: 'WEAKMUSIC01', title: 'Madigan - The News', artist: 'Madigan', duration: 279 },
      { id: 'TOPICMUSIC1', title: 'Madigan - The News (Official Audio)', artist: 'Madigan - Topic', duration: 279 },
    ],
    details: {
      WEAKMUSIC01: {
        title: 'Madigan - The News',
        author: 'Madigan',
        genre: 'Music',
        description: '',
        keywords: ['music'],
        lengthSeconds: 279,
        liveNow: false,
        musicTracks: [],
      },
      TOPICMUSIC1: {
        title: 'Madigan - The News (Official Audio)',
        author: 'Madigan - Topic',
        genre: 'Music',
        description: 'Provided to YouTube by Example Records',
        keywords: ['music'],
        lengthSeconds: 279,
        liveNow: false,
        musicTracks: [{ song: 'The News', artist: 'Madigan' }],
      },
    },
  });
  const match = await find(madigan, new dom.window.AbortController().signal);
  assert.equal(match.id, 'TOPICMUSIC1');
  dom.window.close();
}

// Exact title/artist/duration but no trustworthy music evidence must remain unresolved.
await expectNoMatch({
  piped: [{ id: 'AMBIGUOUS01', title: 'Madigan - The News', artist: 'Madigan', duration: 279 }],
  invidious: [{ id: 'AMBIGUOUS01', title: 'Madigan - The News', artist: 'Madigan', duration: 279 }],
  details: {
    AMBIGUOUS01: {
      title: 'Madigan - The News',
      author: 'Madigan',
      genre: '',
      description: '',
      keywords: [],
      lengthSeconds: 279,
      liveNow: false,
      musicTracks: [],
    },
  },
}, madigan);

console.log('music-only YouTube resolver 1.6.3: OK');
