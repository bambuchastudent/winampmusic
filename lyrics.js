const LYRICS_API='https://lrclib.net/api/search';
const lyricsBar=document.getElementById('lyricsBar');
const lyricsStatus=document.getElementById('lyricsStatus');
const lyricsCurrent=document.getElementById('lyricsCurrent');
const lyricsNext=document.getElementById('lyricsNext');
const titleNode=document.getElementById('nowTitle');
const artistNode=document.getElementById('nowArtist');
const seekNode=document.getElementById('seek');
const durationNode=document.getElementById('duration');
let timedLyrics=[];
let activeTrack='';
let activeLine=-2;
let requestController=null;

function cleanTitle(text){
  return String(text||'')
    .replace(/\s*\([^)]*(official|video|audio|lyrics?)[^)]*\)/ig,'')
    .replace(/\s*\[[^\]]*(official|video|audio|lyrics?)[^\]]*\]/ig,'')
    .replace(/\s*\|.*$/g,'')
    .trim();
}
function cleanArtist(text){return String(text||'').replace(/\s*-\s*Topic$/i,'').replace(/\s*VEVO$/i,'').trim();}
function parseTime(text){const p=String(text||'').split(':').map(Number);if(p.length===2)return p[0]*60+p[1];if(p.length===3)return p[0]*3600+p[1]*60+p[2];return 0;}
function parseLrc(text){const out=[];for(const raw of String(text||'').split(/\r?\n/)){const m=raw.match(/^\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]\s*(.*)$/);if(m&&m[3])out.push({time:Number(m[1])*60+Number(m[2]),text:m[3].trim()});}return out.sort((a,b)=>a.time-b.time);}
function score(record,title,artist,duration){const a=String(record.trackName||'').toLowerCase();const b=String(record.artistName||'').toLowerCase();const t=title.toLowerCase();const r=artist.toLowerCase();let s=0;if(a===t)s+=10;else if(a.includes(t)||t.includes(a))s+=4;if(b===r)s+=8;else if(b.includes(r)||r.includes(b))s+=3;if(duration&&record.duration&&Math.abs(Number(record.duration)-duration)<=3)s+=5;return s;}
async function search(params,signal){const url=new URL(LYRICS_API);Object.entries(params).forEach(([k,v])=>v&&url.searchParams.set(k,v));const response=await fetch(url,{signal,headers:{'Lrclib-Client':'WinampMusic/0.2 (github.com/bambuchastudent/winampmusic)'}});if(!response.ok)throw new Error(`lyrics HTTP ${response.status}`);return response.json();}
async function loadLyrics(){
  const rawTitle=titleNode?.textContent?.trim();if(!rawTitle||rawTitle==='No track selected')return;
  const title=cleanTitle(rawTitle);const artist=cleanArtist(artistNode?.textContent);const key=`${title}::${artist}`;if(!title||key===activeTrack)return;
  activeTrack=key;timedLyrics=[];activeLine=-2;requestController?.abort();requestController=new AbortController();
  lyricsBar.hidden=false;lyricsStatus.textContent='ORIGINAL - FINDING LYRICS';lyricsCurrent.textContent=title;lyricsNext.textContent=artist||'Searching synchronized text...';
  try{
    const duration=parseTime(durationNode?.textContent);let records=await search({track_name:title,artist_name:artist},requestController.signal);let candidates=records.filter(x=>x.syncedLyrics);candidates.sort((x,y)=>score(y,title,artist,duration)-score(x,title,artist,duration));let record=candidates[0];
    if(!record){await new Promise(r=>setTimeout(r,350));records=await search({q:`${artist} ${title}`.trim()},requestController.signal);candidates=records.filter(x=>x.syncedLyrics);candidates.sort((x,y)=>score(y,title,artist,duration)-score(x,title,artist,duration));record=candidates[0];}
    if(!record)throw new Error('not found');timedLyrics=parseLrc(record.syncedLyrics);if(!timedLyrics.length)throw new Error('empty');lyricsStatus.textContent=`ORIGINAL - ${record.artistName||artist}`;syncLyrics(true);
  }catch(error){if(error.name==='AbortError')return;lyricsStatus.textContent='ORIGINAL - LYRICS UNAVAILABLE';lyricsCurrent.textContent='No synchronized lyrics found';lyricsNext.textContent=`${artist} - ${title}`;}
}
function syncLyrics(force=false){if(!timedLyrics.length)return;const duration=parseTime(durationNode?.textContent);if(!duration)return;const position=(Number(seekNode?.value)/1000)*duration;let index=-1;for(let i=0;i<timedLyrics.length;i+=1){if(timedLyrics[i].time>position+.08)break;index=i;}if(!force&&index===activeLine)return;activeLine=index;lyricsCurrent.textContent=index>=0?timedLyrics[index].text:'...';lyricsNext.textContent=timedLyrics[index+1]?.text||'';lyricsBar.classList.toggle('lyrics-active',index>=0);}
if(titleNode)new MutationObserver(loadLyrics).observe(titleNode,{childList:true,subtree:true,characterData:true});
setInterval(syncLyrics,250);
window.addEventListener('DOMContentLoaded',()=>setTimeout(loadLyrics,500));
