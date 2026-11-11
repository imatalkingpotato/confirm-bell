'use strict';
(() => {
  const query=new URLSearchParams(location.search);
  if(query.get('preview')==='1' && query.get('gallery')==='1') return;
  const VIDEO_ID = 'BeAE3ZRcMgs';
  const $ = id => document.getElementById(id);
  const toggle = $('musicToggle'), status = $('musicStatus'), seek = $('musicSeek');
  const card = $('musicCard'), wave = $('musicWave');
  let player, ready = false, wanted = false, playing = false, failed = false, dragging = false, restartPending = false;
  let prepared;
  const preparation = new Promise(resolve=>{prepared=resolve;});
  // Intro controls the start; prepare the player while its collage images load.
  window.confirmBellMusic = {
    prepared: preparation,
    start(restart=false) {
      if(failed)return;
      wanted=true;restartPending=restart;
      status.textContent='재생 시작 중…';requestPlay();
    }
  };
  const time = seconds => {
    const n = Math.max(0,Math.floor(Number(seconds)||0));
    return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
  };
  // Decorative waveform follows the real player state, not a fake audio spectrum.
  for (let i=0;i<44;i++) {
    const bar=document.createElement('i');
    bar.style.setProperty('--h',(10+(Math.sin(i*1.7)+1)*9)+'px');
    bar.style.setProperty('--speed',(0.35+(i%7)*.09)+'s');
    bar.style.setProperty('--phase',(-i*.13)+'s');
    wave.appendChild(bar);
  }
  function render() {
    toggle.textContent = playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', playing ? '배경 음악 일시정지' : '배경 음악 재생');
    card.classList.toggle('playing',playing);
  }
  function sync() {
    if (!ready || failed) return;
    const duration=Number(player.getDuration())||0;
    seek.disabled=duration<=0;
    seek.max=String(Math.max(1,Math.floor(duration)));
    $('musicDuration').textContent=duration>0?time(duration):'--:--';
    if (!dragging) {
      const current=Number(player.getCurrentTime())||0;
      seek.value=String(Math.min(duration,current));
      $('musicCurrent').textContent=time(current);
      seek.setAttribute('aria-valuetext',time(current)+' / '+time(duration));
    }
  }
  function requestPlay() {
    if (!ready || !wanted || failed) return;
    if(restartPending){player.seekTo(0,true);restartPending=false;}
    player.unMute();player.playVideo();
  }
  function firstInteraction(event) {
    if (event.type === 'keydown' && !['Space','Enter'].includes(event.code)) return;
    if (event.target.closest?.('.music-card')) return;
    if (!playing) requestPlay();
  }
  function jump(value) {
    if (!ready || failed) return;
    const duration=Number(player.getDuration())||0;
    if (!duration) return;
    const target=Math.max(0,Math.min(duration-0.1,Number(value)||0));
    player.seekTo(target,true);
    $('musicCurrent').textContent=time(target);seek.value=String(target);
    seek.setAttribute('aria-valuetext',time(target)+' / '+time(duration));
  }
  seek.addEventListener('input',()=>{
    dragging=true;
    $('musicCurrent').textContent=time(seek.value);
    seek.setAttribute('aria-valuetext',time(seek.value)+' / '+time(seek.max));
  });
  seek.addEventListener('change',()=>{jump(seek.value);dragging=false;});
  seek.addEventListener('blur',()=>{if(dragging)jump(seek.value);dragging=false;});
  $('musicBack').addEventListener('click',()=>{if(ready)jump(player.getCurrentTime()-10);});
  $('musicForward').addEventListener('click',()=>{if(ready)jump(player.getCurrentTime()+10);});
  document.addEventListener('pointerdown', firstInteraction);
  document.addEventListener('keydown', firstInteraction);
  toggle.addEventListener('click', () => {
    if (failed) { status.textContent = '위 제목을 눌러 YouTube에서 재생해 주세요'; return; }
    if (playing) { wanted = false; player.pauseVideo(); }
    else { wanted = true; status.textContent = ready ? '재생 시작 중…' : '음악 연결 중…'; requestPlay(); }
  });
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtubePlayer', {
      width: '236', height: '200', videoId: VIDEO_ID,
      playerVars: { autoplay: 0, controls: 0, playsinline: 1, loop: 1, playlist: VIDEO_ID, origin: location.origin },
      events: {
        onReady(event) {
          ready = true;
          const frame=event.target.getIframe();
          frame.setAttribute('title','배경 음악 재생');frame.setAttribute('tabindex','-1');
          frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
          event.target.setVolume(25);
          status.textContent = wanted ? '재생 시작 중…' : '';
          sync();prepared();requestPlay();
        },
        onStateChange(event) {
          playing = event.data === 1;
          if (playing) { wanted = true; status.textContent = '';  }
          else if (event.data === 2) { status.textContent = '';  }
          else if (event.data === 3) { status.textContent = '음악 불러오는 중…'; }
          else if (event.data === 0) { status.textContent = '다시 재생 중…'; if(wanted)requestPlay(); }
          render();sync();
        },
        onAutoplayBlocked() { playing=false;status.textContent = '화면을 터치하면 음악이 시작돼요'; render(); },
        onError() { failed = true; playing = false;prepared(); seek.disabled=true; status.textContent = '임베드 재생 불가 · 제목을 눌러 YouTube에서 듣기'; render(); }
      }
    });
  };
  setInterval(sync,300);
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => { failed = true;playing=false;prepared();seek.disabled=true;status.textContent = '음악 연결 실패 · 제목을 눌러 YouTube에서 듣기';render(); };
  document.head.appendChild(script);
})();
