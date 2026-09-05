import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const tick = () => new Promise(r => setTimeout(r, 0));
function setup({warm = false, apple = false} = {}) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {url:'https://example.test/', runScripts:'outside-only'});
  const w = dom.window;
  w.requestIdleCallback = () => {};
  w.console = {info(){},warn(){}};
  const tracks = ['aaaaaaaaaaa','bbbbbbbbbbb','ccccccccccc'].map((id,i)=>({id,title:`Track ${i}`,artist:'Artist', ...(apple && i===1 ? {appleTrackId:'123',badges:['Apple Music']} : {})}));
  w.localStorage.setItem('winampmusic.library.v1',JSON.stringify(tracks));
  const loads = []; let player; let ready;
  w.YT = {PlayerState:{PLAYING:1,PAUSED:2,ENDED:0,BUFFERING:3}, Player:class {
    constructor(id,o){player=this; this.o=o; this.state=-1; ready=()=>o.events.onReady(); if(warm) queueMicrotask(ready);}
    setVolume(){} getCurrentTime(){return 15;} getDuration(){return 100;}
    getPlayerState(){return this.state;}
    loadVideoById(id){loads.push(id); this.playVideo();}
    playVideo(){this.state=1; this.o.events.onStateChange({data:1});}
    pauseVideo(){this.state=2; this.o.events.onStateChange({data:2});}
  }};
  const audios=[];
  w.Audio=class extends w.EventTarget {
    constructor(){super(); this.paused=true; this.duration=100; audios.push(this);}
    async play(){this.paused=false; this.dispatchEvent(new w.Event('play'));}
    pause(){this.paused=true; this.dispatchEvent(new w.Event('pause'));}
    removeAttribute(){} load(){}
  };
  w.winampMusicAppleImport={__ampStrict150:true,async findYouTubeMatch(){return {id:'bbbbbbbbbbb'};}};
  w.fetch=async()=>({ok:true,json:async()=>({audioStreams:[{url:'https://example.test/audio',mimeType:'audio/mp4'}]})});
  const evalFile=f=>w.eval(fs.readFileSync(f,'utf8'));
  evalFile('fast-player-v141.js');
  const click=id=>w.document.getElementById(id).click();
  return {dom,w,loads,audios,evalFile,click,ready:()=>ready(),player:()=>player};
}
// Requests made while the iframe initializes must not all load the newest id.
{
 const s=setup(); const a=s.w.playIndex(0); await tick(); const b=s.w.playIndex(1); s.ready(); await Promise.all([a,b]);
 assert.deepEqual(s.loads,['bbbbbbbbbbb'],'latest selection loads exactly once'); s.dom.window.close();
}
// Real listener order: Apple document capture, direct capture, FAST target listener.
{
 const s=setup({warm:true,apple:true}); s.evalFile('fast-release-v150.js'); s.evalFile('clean-playback-v150.js'); s.evalFile('apple-musickit-v150.js');
 await s.w.ampMusicAppleKit150.playPreferred(1); assert.equal(s.audios.length,1);
 s.click('playButton'); await tick(); assert.equal(s.audios[0].paused,true,'Apple fallback pauses its existing audio');
 s.click('playButton'); await tick(); assert.equal(s.audios[0].paused,false,'Apple fallback resumes');
 s.click('nextButton'); await tick(); assert.equal(s.loads.at(-1),'ccccccccccc'); assert.equal(s.audios[0].paused,true);
 s.click('prevButton'); await tick(); assert.equal(s.w.document.getElementById('nowTitle').textContent,'Track 1','previous uses shared current index');
 s.dom.window.close();
}
// Stale stream response must not start after switching back to YouTube.
{
 const s=setup({warm:true,apple:true}); s.evalFile('fast-release-v150.js'); s.evalFile('clean-playback-v150.js'); s.evalFile('apple-musickit-v150.js');
 let release; s.w.fetch=()=>new Promise(r=>release=()=>r({ok:true,json:async()=>({audioStreams:[{url:'https://example.test/old'}]})}));
 const pending=s.w.ampMusicAppleKit150.playPreferred(1); await tick();
 s.click('nextButton'); await tick(); release(); await pending; await tick();
 assert.equal(s.loads.at(-1),'ccccccccccc'); assert.ok(s.audios.every(a=>a.paused),'obsolete direct resolution cannot play'); s.dom.window.close();
}
// Apple iframe fallback also delegates pause, instead of resolving again.
{
 const s=setup({warm:true,apple:true});
 s.evalFile('fast-release-v150.js'); s.evalFile('clean-playback-v150.js'); s.evalFile('apple-musickit-v150.js');
 s.w.fetch=async()=>{throw new Error('offline');};
 await s.w.ampMusicAppleKit150.playPreferred(1);
 assert.equal(s.loads.at(-1),'bbbbbbbbbbb');
 s.click('playButton'); await tick(); assert.equal(s.player().state,2,'iframe fallback pauses');
 s.click('playButton'); await tick(); assert.equal(s.player().state,1,'iframe fallback resumes');
 assert.equal(s.loads.length,1,'pause and resume do not reload the iframe'); s.dom.window.close();
}
// A warmed iframe without a loaded recording must still load on first Play.
{
 const s=setup({warm:true});
 const pending=s.w.playIndex(0); await pending; s.w.ampMusicYouTube150.suspend();
 s.loads.length=0; s.click('playButton'); await tick();
 assert.deepEqual(s.loads,['aaaaaaaaaaa']); s.dom.window.close();
}
// A late MusicKit queue operation cannot displace the newest Apple selection.
{
 const s=setup({warm:true,apple:true});
 const tracks=JSON.parse(s.w.localStorage.getItem('winampmusic.library.v1'));
 tracks[2].appleTrackId='456'; tracks[2].badges=['Apple Music'];
 s.w.localStorage.setItem('winampmusic.library.v1',JSON.stringify(tracks));
 s.w.AMP_MUSIC_APPLE_CONFIG={enabled:true,developerToken:'test'};
 let release; const played=[]; let song;
 const music={isAuthorized:true,async setQueue(v){if(v.song==='123') await new Promise(r=>release=r); song=v.song;},async play(){played.push(song);},async stop(){}};
 s.w.MusicKit={configure:async()=>music};
 s.evalFile('clean-playback-v150.js'); s.evalFile('apple-musickit-v150.js');
 const first=s.w.ampMusicAppleKit150.playPreferred(1); await tick();
 const second=s.w.ampMusicAppleKit150.playPreferred(2); await tick(); release(); await Promise.all([first,second]);
 assert.deepEqual(played,['456']); assert.equal(s.w.document.getElementById('nowTitle').textContent,'Track 2'); s.dom.window.close();
}
// System play/pause must understand all provider statuses and remain idempotent.
{
 const s=setup(); const handlers={}; s.w.navigator.mediaSession={setActionHandler(k,v){handlers[k]=v;}};
 s.evalFile('fast-background-v150.js'); let clicks=0;
 s.w.document.getElementById('playButton').addEventListener('click',()=>clicks++,true);
 const status=s.w.document.getElementById('status'); status.textContent='PLAYING · DIRECT';
 handlers.play(); assert.equal(clicks,0); handlers.pause(); assert.equal(clicks,1);
 status.textContent='APPLE MUSIC · PAUSED'; handlers.pause(); assert.equal(clicks,1);
 s.dom.window.close();
}
console.log('Playback controls regressions passed');
