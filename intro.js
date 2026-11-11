'use strict';
(() => {
  const KEY = 'confirmbell_intro_kst_v1';
  const query = new URLSearchParams(location.search);
  const preview = query.get('preview') === '1';
  if(preview && query.get('gallery')==='1') return;
  const overlay = document.getElementById('intro');
  const collage = document.getElementById('introCollage');
  const skip = document.getElementById('introSkip');
  const replay = document.getElementById('introReplay');
  const entry=document.getElementById('entry'),entryButton=document.getElementById('entryButton'),entryStatus=document.getElementById('entryStatus');
  const surfaces = [document.querySelector('main'), document.getElementById('musicCard')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const day = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let seen = '', timer, previousFocus, previousInert = [];
  try { if (!preview) seen = localStorage.getItem(KEY) || ''; } catch (_) {}
  // Deliberately irregular overlapping positions; portrait has its own coverage.
  const poses = [
    [19,14,-9,28,8,-8],[77,75,8,72,93,7],[72,12,6,75,22,5],
    [24,80,-6,25,76,-6],[16,48,7,24,39,7],[82,45,-8,76,57,-8],
    [45,9,3,35,10,3],[50,91,5,58,94,5],[48,39,-5,66,38,-5],
    [46,67,8,35,59,8],[88,89,-4,69,80,-4],[12,89,5,27,96,5],
    [87,28,-12,83,48,-12]
  ];
  poses.forEach(([x,y,r,mx,my,mr],i) => {
    const img = document.createElement('img');
    img.src = i === 12 ? 'assets/intro/tracker-blurred.png' : `assets/intro/deck-${String(i+1).padStart(2,'0')}.png`;
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    img.className = 'intro-photo';
    Object.entries({x:x+'%',y:y+'%',r:r+'deg',mx:mx+'%',my:my+'%',mr:mr+'deg',delay:(i*.23)+'s'}).forEach(([k,v])=>img.style.setProperty('--'+k,v));
    collage.appendChild(img);
  });
  function finish() {
    if (overlay.hidden) return;
    clearTimeout(timer);
    overlay.hidden = true; overlay.classList.remove('running','leaving');
    document.documentElement.classList.remove('intro-open');
    window.confirmBellIntroActive = false;
    surfaces.forEach((el,i) => { el.inert = previousInert[i]; });
    seen = day();
    if (!preview) { try { localStorage.setItem(KEY,seen); } catch (_) {} }
    const focusTarget = previousFocus?.tagName === 'BUTTON' ? previousFocus : document.getElementById('btn');
    focusTarget?.focus({preventScroll:true});
  }
  function start() {
    if (window.confirmBellIntroActive) return;
    previousFocus = document.activeElement===entryButton?document.getElementById('btn'):document.activeElement;
    previousInert = surfaces.map(el=>el.inert);
    surfaces.forEach(el=>{el.inert=true;});
    window.confirmBellIntroActive = true;
    document.documentElement.classList.add('intro-open');
    overlay.hidden = false; overlay.classList.toggle('reduced',reduced);
    skip.focus({preventScroll:true});
    // Invoke playback inside the actual entry/replay click, before any async work.
    window.confirmBellMusic?.start(true);
    overlay.classList.add('running');
    timer = setTimeout(()=>{
      overlay.classList.add('leaving');
      timer = setTimeout(finish,reduced?200:1100);
    },reduced?4500:10100);
  }
  skip.addEventListener('click',finish);
  replay.addEventListener('click',start);
  document.addEventListener('keydown',event=>{
    if(!entry.hidden){
      if(event.key==='Tab'){event.preventDefault();entryButton.focus();}
      return;
    }
    if (!window.confirmBellIntroActive) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
  });
  // Every visit gets one explicit music gesture; the collage remains once per KST day.
  const entryInert=surfaces.map(el=>el.inert);
  surfaces.forEach(el=>{el.inert=true;});
  window.confirmBellIntroActive=true;
  entry.hidden=false;document.documentElement.classList.add('intro-open');
  const loaded=[...collage.children].map(img=>img.decode?.().catch(()=>{}) || Promise.resolve());
  loaded.push(window.confirmBellMusic?.prepared || Promise.resolve());
  let preparationTimer;
  Promise.race([Promise.all(loaded),new Promise(resolve=>{preparationTimer=setTimeout(resolve,6000);})]).then(()=>{
    clearTimeout(preparationTimer);
    if(entry.hidden)return;
    entryButton.disabled=false;
    entryStatus.textContent=window.confirmBellMusic?.available?'':'음악 연결이 늦어지고 있어요. 먼저 입장할 수 있어요.';
    entryButton.focus({preventScroll:true});
  });
  entryButton.addEventListener('click',()=>{
    if(entryButton.disabled||entry.hidden)return;
    entry.hidden=true;clearTimeout(preparationTimer);
    surfaces.forEach((el,i)=>{el.inert=entryInert[i];});
    window.confirmBellIntroActive=false;
    if(query.get('intro')==='1'||seen!==day())start();
    else{
      document.documentElement.classList.remove('intro-open');
      window.confirmBellMusic?.start();
      document.getElementById('btn').focus({preventScroll:true});
    }
  });
})();
