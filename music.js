'use strict';
(() => {
  const VIDEO_ID = 'BeAE3ZRcMgs';
  const toggle = document.getElementById('musicToggle');
  const status = document.getElementById('musicStatus');
  let player, ready = false, wanted = true, playing = false, failed = false, touched = false;
  function render() {
    toggle.textContent = playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', playing ? '배경 음악 일시정지' : '배경 음악 재생');
  }
  function requestPlay() {
    if (!ready || !wanted || failed) return;
    player.playVideo();
  }
  function firstInteraction(event) {
    if (event.type === 'keydown' && !['Space','Enter'].includes(event.code)) return;
    if (event.target.closest?.('.music-card')) return;
    if (!touched) { touched = true; requestPlay(); }
  }
  document.addEventListener('pointerdown', firstInteraction);
  document.addEventListener('keydown', firstInteraction);
  toggle.addEventListener('click', () => {
    touched = true;
    if (failed) { status.textContent = '위 제목을 눌러 YouTube에서 재생해 주세요'; return; }
    if (playing) { wanted = false; player.pauseVideo(); }
    else { wanted = true; status.textContent = ready ? '재생 시작 중…' : '음악 연결 중…'; requestPlay(); }
  });
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtubePlayer', {
      width: '236', height: '200', videoId: VIDEO_ID,
      playerVars: { autoplay: 1, controls: 1, playsinline: 1, loop: 1, playlist: VIDEO_ID, origin: location.origin },
      events: {
        onReady(event) {
          ready = true;
          event.target.getIframe().setAttribute('title', '이 덱을 떠나주세요 1hr ver. — YouTube 음악 플레이어');
          event.target.setVolume(25);
          status.textContent = wanted ? '재생 시작 중…' : '일시정지';
          requestPlay();
        },
        onStateChange(event) {
          playing = event.data === 1;
          if (playing) { wanted = true; status.textContent = '재생 중 · BGM 25%'; }
          else if (event.data === 2) { status.textContent = '일시정지'; }
          else if (event.data === 3) { status.textContent = '음악 불러오는 중…'; }
          render();
        },
        onAutoplayBlocked() { status.textContent = '▶ 또는 첫 타격으로 음악 시작'; render(); },
        onError() { failed = true; playing = false; status.textContent = '임베드 재생 불가 · 제목을 눌러 YouTube에서 듣기'; render(); }
      }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => { failed = true; status.textContent = '음악 연결 실패 · 제목을 눌러 YouTube에서 듣기'; };
  document.head.appendChild(script);
})();
