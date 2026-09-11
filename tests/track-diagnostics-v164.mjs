import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostics = fs.readFileSync('track-diagnostics-v164.js', 'utf8');
const download = fs.readFileSync('diagnostics-download-v171.js', 'utf8');
const header = fs.readFileSync('header-visualizer-v159.js', 'utf8');
const trustGate = fs.readFileSync('resolver-trust-v167.js', 'utf8');
const resolverTest = fs.readFileSync('tests/youtube-music-resolver-v163.mjs', 'utf8');

assert.match(header, /resolver-trust-v167\.js\?v=173/);
assert.match(header, /track-diagnostics-v164\.js\?v=173/);
assert.match(header, /diagnostics-download-v171\.js\?v=173/);
assert.match(header, /playback-miss-v173\.js\?v=173/);
assert.match(header, /data-ampula-track-diagnostics-164|ampulaTrackDiagnostics164/);
assert.match(trustGate, /Final trust gate rejected/);

assert.match(diagnostics, /Copy diagnostics/);
assert.match(download, /Download diagnostics/);
assert.match(download, /payloadForIndex/);
assert.match(download, /application\/json/);
assert.match(diagnostics, /storedYoutubeId/);
assert.match(diagnostics, /actualYoutubeId/);
assert.match(diagnostics, /storedVsActualMismatch/);
assert.match(diagnostics, /observedCandidates/);
assert.match(diagnostics, /recentResolverNetwork/);
assert.match(diagnostics, /infoDelivery/);

assert.match(diagnostics, /music-only-v1\.6\.4/);
assert.match(diagnostics, /needsTrustedResolution/);
assert.match(diagnostics, /youtubeMatchResolverVersion/);
assert.match(diagnostics, /RESOLVING TRUSTED YOUTUBE MATCH/);
assert.match(diagnostics, /NO TRUSTWORTHY YOUTUBE MATCH/);
assert.match(diagnostics, /winampMusicAppleImport\?\.findYouTubeMatch/);
assert.match(diagnostics, /MAX_DURATION_DELTA_SECONDS = 15/);
assert.match(diagnostics, /MIN_MUSIC_EVIDENCE = 4/);
assert.match(diagnostics, /MIN_MATCH_SCORE = 20/);
assert.match(diagnostics, /genre && genre !== 'music'/);
assert.match(diagnostics, /categoryId && categoryId !== 10/);
assert.match(diagnostics, /duration delta/);

assert.match(resolverTest, /s1b8Q5avQZs/);
assert.match(resolverTest, /rWWNZigf7PA/);
assert.match(resolverTest, /Madigan/);
assert.match(resolverTest, /The News/);

console.log('Track diagnostics + final trust gate contract: OK');