'use strict';

// ═══════════════════════════════════════════════════════════
//  팀 공유(누적) 리더보드 설정
//  Firebase Realtime Database URL (끝에 /confirmbell)
//  비워두면("") 개인 기록 모드(이 브라우저에만 저장)로 동작.
// ═══════════════════════════════════════════════════════════
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
const SHARED_DB_URL = 'https://confirm-bell-default-rtdb.firebaseio.com/confirmbell';

// ================= 담당자 데이터 =================
const PEOPLE = [
  { avatar:'orange', lines:['이 덱을 떠나주세요','미팅이 백투백이라 오후에 컨펌하겠습니다','카피 주세요','썸네일 더 주세요 - 6:17PM','제가 지금 이동중이라ㅠ 여기로 주세요'], name:'이슬', hair:'#26180f', hairStyle:'long', top:'#7fb4d9' },
  { lines:['죄송합니다 락했습니다','늦어서 죄송해요 바로 볼게요'], name:'민희', hair:'#171310', hairStyle:'wave', top:'#e8a0b4' },
  { lines:['(0.001초 만에) 👀','지금 볼게요'], name:'우리', hair:'#171310', hairStyle:'bob',  top:'#a4d4a0' },
  { avatar:'initial', lines:['덱으로 볼게요','1번이요~'], name:'지영', hair:'#171310', hairStyle:'tied', top:'#d9c47f' },
];
const REACTIONS = ['잠시만요~','아 네네 지금 볼게요','회의 중이에요;;','5분만요!!','아직 안 봤어요…','어 방금 열었어요'];
const RARE = ['덱으로 볼게요!','앗 미팅이 많아 지금 보겠습니다','4시에 볼게요~','오늘까지 컨펌해두겠습니다','지금 바로 확인할게요!'];
const MILESTONES = {
  10:'어셋/카피/썸네일 컨펌 부탁드립니다 🙏',
  20:'컨펌 리마인드 드립니다 (벌써 2회차)',
  30:'덱에 핑 드렸습니다. 보셨죠? 보고 안 누르신 거죠?',
  50:'읽씹은 아니시죠? 아니라고 해주세요',
  70:'슬랙 1, 댓글 2, 덱 1. 지금 저만 세고 있나요?',
  100:'괜찮아요. 기다리는 게 저희 일이니까요. 아마도요.',
  150:'어셋이 오늘도 컨펌을 기다립니다. 어셋도 지쳤대요.',
  200:'혹시 미팅이 하루 24시간이세요?',
  250:'"확인해볼게요"의 "확인"은 어떤 의미셨을까요',
  300:'괜찮습니다. 어차피 오늘도 야근이었어요.',
  350:'말풍선 답장은 참 빠르시던데요. 인스타 스토리도요.',
  400:'컨펌 안 해주셔도 돼요. 대신 업로드도 없는 거예요.',
  450:'지금 보신다고요? 그 말 3시간 전에도 하셨어요.',
  500:'반환점입니다. 컨펌은 아직도 없네요.',
  600:'저희 팀 상태메시지 바꿨어요. "컨펌 대기 중"으로.',
  700:'이쯤이면 컨펌이 아니라 기적을 기다리는 중입니다.',
  800:'이 기록, 내년 위클리 첫 장에 넣겠습니다.',
  900:'괜찮아요. 울지 않아요. 프로니까요.',
  1000:'컨펌 대기 1차 폭발',
  2000:'덱이 흔들리는 중',
  3000:'리마인드의 한계를 돌파했다',
  4000:'사무실 최종 보스',
  5000:'컨펌의 신 · 전설 달성'
};

// ================= 상태 & 저장 =================
// 수치는 일/월/연 "버킷"에 저장 → 00시·월초·연초에 자동으로 새 버킷 시작(리셋),
// 지난 버킷은 지우지 않으므로 그대로 아카이브가 된다.
const LS_KEY = PREVIEW ? 'confirmbell_preview' : 'confirmbell_v3';
const pad = n=>String(n).padStart(2,'0');
function nowKeys(){
  const d=new Date();
  const day=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return { day, mon: day.slice(0,7), year: day.slice(0,4) };
}
let K = nowKeys();
let cur = 0;
let store = { daily:{}, monthly:{}, yearly:{}, myTotal:0, maxCombo:0 }; // 개인 기록(브라우저)
// Opt-in visual fixture: never reads/writes real records or connects to Firebase.
if(PREVIEW){
  const seed=Math.min(6000,Math.max(0,Math.floor(Number(new URLSearchParams(location.search).get('hits'))||0)));
  if(seed){store.daily[K.day]=[seed,seed,seed,seed];store.monthly[K.mon]=[seed,seed,seed,seed];store.yearly[K.year]=[seed,seed,seed,seed];store.myTotal=seed*4;}
}
let combo = 0, maxCombo = 0, comboTimer = null;
let shared = { daily:null, monthly:null, yearly:null }; // 팀 모드 서버 값
let pending = [0,0,0,0]; // 서버 전송 대기분
let anim = { hammer:0, bonk:0, frown:0, sweat:0, age:1, power:1, shake:0, freeze:0, shock:0, desk:0 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionOn = !reducedMotion, sfxOn = true;
let debris = [], hitGate = -Infinity;
const lineCursor = [0,0,0,0];
let celebrating = false;

try {
  const saved = PREVIEW ? null : JSON.parse(localStorage.getItem(LS_KEY));
  if(saved){ store = Object.assign(store, saved); maxCombo = store.maxCombo || 0; }
} catch(e){}
// Personal lifetime totals come from the existing yearly archives, not the combo.
const lifetimeHits = PEOPLE.map((_,i)=>Object.values(store.yearly).reduce((n,year)=>n+(Number(year[i])||0),0));
function injuryLevel(index){ return Math.min(5,Math.floor(lifetimeHits[index]/1000)); }
function save(){
  if(PREVIEW) return;
  store.maxCombo = maxCombo;
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch(e){}
}
function bucket(obj,key){ return obj[key] || (obj[key]=[0,0,0,0]); }

// 자정/월초/연초 롤오버: 날짜 키가 바뀌면 보드가 자동 전환된다
function checkRollover(){
  const k = nowKeys();
  if(k.day !== K.day){
    K = k;
    shared = { daily:null, monthly:null, yearly:null };
    if(sharedOn) poll();
    updateHud();
  }
}
setInterval(checkRollover, 20000);

// ================= 팀 공유 동기화 (Firebase RTDB REST) =================
const sharedOn = !PREVIEW && !!SHARED_DB_URL;
let poll = ()=>{};
if(sharedOn){
  document.getElementById('boardMode').textContent='팀 전체 실시간 합산 · 00시/월초 자동 리셋';
  setInterval(()=>{
    pending.forEach((n,i)=>{
      if(n>0){
        const send=n; pending[i]=0;
        [`daily/${K.day}`,`monthly/${K.mon}`,`yearly/${K.year}`].forEach((p,pi)=>{
          fetch(`${SHARED_DB_URL}/${p}/${i}.json`,{
            method:'PUT', body:JSON.stringify({'.sv':{'increment':send}})
          }).catch(()=>{ if(pi===0) pending[i]+=send; });
        });
      }
    });
  }, 2500);
  poll = ()=>{
    checkRollover();
    const get=p=>fetch(`${SHARED_DB_URL}/${p}.json`).then(r=>r.json()).catch(()=>null);
    Promise.all([get('daily/'+K.day), get('monthly/'+K.mon), get('yearly/'+K.year)]).then(([d,m,y])=>{
      const norm=v=>[0,1,2,3].map(i=>(v&&v[i])||0);
      shared = { daily:norm(d), monthly:norm(m), yearly:norm(y) };
      updateHud();
    });
  };
  poll(); setInterval(poll, 6000);
}

// ================= 캔버스 =================
const cv = document.getElementById('stage'), ctx = cv.getContext('2d');
const S = 5; // 논리 해상도 128x88 (줌인)
function px(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(Math.round(x*S),Math.round(y*S),Math.round(w*S),Math.round(h*S)); }
function shade(hex){
  const n=parseInt(hex.slice(1),16), r=(n>>16)*0.8|0, g=((n>>8)&255)*0.8|0, b=(n&255)*0.8|0;
  return `rgb(${r},${g},${b})`;
}

function pixelDisc(cx,cy,r,color){
  for(let yy=-r;yy<=r;yy++){
    const half=Math.floor(Math.sqrt(r*r-yy*yy));
    px(cx-half,cy+yy,half*2+1,1,color);
  }
}
function drawJ(cx,cy,scale=1){
  const glyph=['00111','00010','00010','00010','10010','10010','01100'];
  glyph.forEach((row,y)=>[...row].forEach((v,x)=>{
    if(v==='1') px(cx+(x-2)*scale,cy+(y-3)*scale,scale,scale,'#fffaf4');
  }));
}
function drawInjuries(hx,hy,level){
  if(level>=1){ // Purple eye bruise, kept clear of the centered J glyph.
    px(hx,hy+7,5,5,'#86509b');px(hx+1,hy+8,3,3,'#58366d');px(hx+2,hy+9,2,1,'#c597ce');
  }
  if(level>=2){ // Shoulder plaster remains visible above the laptop.
    px(hx-3,hy+17,11,4,'#f4c69d');px(hx+1,hy+17,4,4,'#d9a57d');px(hx-2,hy+19,1,1,'#bd8969');px(hx+6,hy+19,1,1,'#bd8969');
  }
  if(level>=3){
    px(hx-3,hy-1,22,5,'#fff3e6');px(hx-3,hy+1,22,1,'#c9c0bc');px(hx+17,hy+2,4,3,'#e8ddd5');px(hx+19,hy+5,2,7,'#fff3e6');
  }
  if(level>=4){
    px(hx+10,hy+12,7,4,'#f2bc91');px(hx+12,hy+12,3,4,'#c58f6b');px(hx+11,hy+13,1,1,'#ffe6c8');
  }
  if(level>=5){
    px(hx+27,hy+24,6,13,'#f7ece2');px(hx+27,hy+27,6,1,'#bdb2aa');px(hx+27,hy+31,6,1,'#bdb2aa');px(hx+27,hy+35,6,1,'#bdb2aa');
  }
}
function drawScene(){
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save();
  if(motionOn && anim.shake>0){
    const strength=anim.shake*anim.power*9;
    ctx.translate(Math.sin(anim.age*93)*strength,Math.cos(anim.age*79)*strength*.7);
  }
  const p = PEOPLE[cur], hx=56, hy=27;
  const frown=anim.frown>0;
  const recoil=Math.sin(Math.min(1,anim.bonk)*Math.PI);
  const dip=motionOn ? recoil*(anim.power>2?7:3) : 0;
  px(0,0,128,64,'#30263f'); px(0,64,128,24,'#201a2c');
  for(let x=0;x<128;x+=16) px(x,65,1,23,'#2b2238');
  px(0,76,128,1,'#2b2238');
  px(98,8,26,20,'#1c1830'); px(100,10,10,7,'#8ea8d8'); px(112,10,10,7,'#a8bce0');
  px(100,19,10,7,'#7c96c8'); px(112,19,10,7,'#93aad4');
  px(6,13,18,24,'#b3222d'); px(9,17,12,3,'#fff'); px(9,23,12,2,'#e8b0b4'); px(9,27,9,2,'#e8b0b4');
  px(10,31,10,4,'#8c1a22');
  // 이슬: the orange silhouette from the supplied reference, built on the same pixel grid.
  if(p.avatar==='orange'){
    pixelDisc(hx+8,hy+7+dip,10,'#e99024');
    for(let y=0;y<22;y++){
      const half=Math.floor(24*Math.sqrt(Math.max(0,1-Math.pow((21-y)/22,2))));
      px(hx+8-half,hy+21+y+dip,half*2+1,1,'#e99024');
    }
  } else {
  // 의자 등받이
  px(hx-9, hy+9, 34, 30, '#463a63');
  px(hx-9, hy+9, 34, 2, '#584a7c');
  // 몸통 (책상까지 이어짐)
  px(hx-4, hy+17+dip, 24, 22, p.top);
  px(hx-2, hy+20+dip, 3, 14, shade(p.top));
  px(hx+15, hy+20+dip, 3, 14, shade(p.top));
  // 팔
  px(hx-6, hy+26+dip, 4, 12, p.top); px(hx+18, hy+26+dip, 4, 12, p.top);
  if(p.avatar === 'initial'){
    pixelDisc(hx+8,hy+8+dip,11,'#8f7167');
    drawJ(hx+8,hy+8+dip,1);
  } else {
  // 머리
  px(hx, hy+dip, 16, 16, '#f5cfa7');
  // 목
  px(hx+5, hy+16+dip, 6, 2, '#eec49a');

  // ----- 헤어 -----
  const hc = p.hair;
  if(p.hairStyle==='long'){
    px(hx-2,hy-2+dip,20,7,hc);
    px(hx-3,hy+3+dip,3,26,hc); px(hx+16,hy+3+dip,3,26,hc);
    px(hx-2,hy+24+dip,2,4,hc); px(hx+16,hy+24+dip,2,4,hc);
  }
  if(p.hairStyle==='wave'){
    px(hx-3,hy-2+dip,22,7,hc);
    for(let i=0;i<9;i++){
      const off = (i%2===0)?0:1;
      px(hx-4+off, hy+4+i*3+dip, 3, 3, hc);
      px(hx+17-off, hy+4+i*3+dip, 3, 3, hc);
    }
    px(hx-5,hy+30+dip,4,3,hc); px(hx+17,hy+30+dip,4,3,hc);
  }
  if(p.hairStyle==='bob'){
    px(hx-2,hy-2+dip,20,6,hc);
    px(hx-3,hy+2+dip,3,13,hc); px(hx+16,hy+2+dip,3,13,hc);
    px(hx-2,hy+13+dip,3,2,hc); px(hx+15,hy+13+dip,3,2,hc);
  }
  if(p.hairStyle==='tied'){
    px(hx-1,hy-2+dip,18,6,hc);
    px(hx-2,hy+2+dip,2,7,hc); px(hx+16,hy+2+dip,2,7,hc);
    px(hx+18,hy+dip,5,5,hc);
    px(hx+20,hy+5+dip,3,9,hc);
    px(hx+21,hy+14+dip,2,3,hc);
  }

  // ----- 얼굴 -----
  if(!frown){
    px(hx+3,hy+8+dip,2,2,'#222'); px(hx+11,hy+8+dip,2,2,'#222');
    px(hx+6,hy+12+dip,4,1,'#c96');
  } else {
    px(hx+2,hy+7+dip,2,1,'#222'); px(hx+4,hy+8+dip,2,1,'#222');
    px(hx+12,hy+7+dip,2,1,'#222'); px(hx+10,hy+8+dip,2,1,'#222');
    px(hx+6,hy+11+dip,4,2,'#a55'); px(hx+5,hy+12+dip,1,1,'#a55'); px(hx+10,hy+12+dip,1,1,'#a55');
    px(hx+1,hy+13+dip,2,2,'#f0a0a0'); px(hx+13,hy+13+dip,2,2,'#f0a0a0');
    px(hx+20,hy-6,1,3,'#ff5a63'); px(hx+23,hy-6,1,3,'#ff5a63');
    px(hx+19,hy-5,1,1,'#ff5a63'); px(hx+24,hy-5,1,1,'#ff5a63');
  }
  }
  if(anim.sweat>0){ px(hx-5, hy+5+Math.floor((1-anim.sweat)*8), 2,3,'#9fd8f0'); }


  }
  drawInjuries(hx,hy+dip,injuryLevel(cur));
  const deskDip=motionOn ? Math.sin(anim.desk*Math.PI)*anim.power*1.3 : 0;
  ctx.save(); ctx.translate(0,deskDip*S);
  px(10,62,108,5,'#8a5a30'); px(10,61,108,1,'#bd8847');
  px(14,67,6,20,'#6e4524'); px(108,67,6,20,'#6e4524');
  if(combo>=50){
    [[89,62],[87,63],[85,64],[86,65]].forEach(([x,y])=>px(x,y,3,1,'#3a201b'));
  }
  // Laptop and desk clutter react to heavy impacts.
  ctx.save(); ctx.translate(64*S,60*S);
  if(motionOn) ctx.rotate(-recoil*.025*anim.power);
  px(-20,0,40,2,'#e2e4ea'); px(-18,-12,36,12,'#c9cbd2'); px(-18,-12,36,1,'#f0f0f5');
  px(17,-12,1,12,'#a7a9b0'); px(-18,-1,36,1,'#a7a9b0');
  ctx.fillStyle='#33384a'; ctx.font=`bold ${3.4*S}px Galmuri11, monospace`; ctx.textAlign='center';
  ctx.fillText(p.name+'님',0,-5.5*S); ctx.restore();
  px(21,58,13,3,'#f4e7d9'); px(24,56,12,2,'#c8c1d8'); px(95,56,6,5,'#eea454');
  ctx.restore();
  // Wide side-entry swing: long handle, rotating head, sweep trails and follow-through.
  const age=anim.age;
  if(age<.48){
    const angle=age<.09 ? .62 : age<.24 ? .62-(age-.09)*6 : -.28+(age-.24)*10;
    const size=anim.power>=3?1.35:1;
    if(motionOn && age<.24){
      for(let i=4;i>=1;i--){
        ctx.save();ctx.globalAlpha=.045*(5-i);ctx.translate(108*S,64*S);ctx.rotate(angle+i*.32);
        px(-62,-8,25,16,'#e83954');px(-49,-2,49,4,'#e3bfa8');ctx.restore();
      }
      ctx.strokeStyle='#ffb3a9';ctx.lineWidth=S*.6;ctx.globalAlpha=.7*(1-age/.24);
      ctx.beginPath();ctx.arc(108*S,64*S,55*S,Math.PI+angle,Math.PI+angle+1.4);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.save();ctx.translate(108*S,64*S);ctx.rotate(angle);
    px(-51,-2,54,5,'#783b2b');px(-51,-2,54,1,'#d89b62');
    for(let n=-19;n<0;n+=4)px(n,-2,2,5,'#292231');
    px(-4,-4,9,9,'#f5cfa7');
    ctx.translate(-52*S,0);ctx.scale(size,size);
    px(-14,-8,28,16,'#c72341');px(-16,-9,5,18,'#5a192c');px(11,-9,5,18,'#5a192c');
    px(-11,-7,22,3,'#f65c69');px(-11,5,22,3,'#791c35');px(-9,-3,3,6,'#f7b16d');px(6,-3,3,6,'#f7b16d');
    ctx.restore();
  }
  if(anim.shock>0){
    const spread=(1-anim.shock)*13;
    ctx.strokeStyle=anim.power>=3?'#ff8a3d':'#ffdc6a'; ctx.lineWidth=S*(anim.shock+.2);
    ctx.beginPath(); ctx.ellipse(64*S,(hy+3)*S,(9+spread)*S,(3+spread*.3)*S,0,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      px(64+Math.cos(a)*(12+spread),hy+3+Math.sin(a)*(8+spread),2,2,i%2?'#fff2c3':'#ff8f42');
    }
  }
  debris.forEach(d=>{ctx.globalAlpha=Math.min(1,d.life*3);px(d.x,d.y,d.w,d.h,d.c);});
  ctx.globalAlpha=1; ctx.restore();
}

// ================= 애니메이션 루프 =================
let last=0;
function loop(t){
  const dt=Math.min(Math.max((t-last)/1000,0),.05); last=t;
  if(anim.freeze>0){ anim.freeze-=dt; }
  else {
    anim.age+=dt;
    anim.bonk=Math.max(0,anim.bonk-dt*3.8);
    anim.hammer=Math.max(0,anim.hammer-dt*7);
    anim.frown=Math.max(0,anim.frown-dt);
    anim.sweat=Math.max(0,anim.sweat-dt*1.2);
    anim.shake=Math.max(0,anim.shake-dt*4);
    anim.shock=Math.max(0,anim.shock-dt*4);
    anim.desk=Math.max(0,anim.desk-dt*3);
    debris.forEach(d=>{d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=100*dt;});
    debris=debris.filter(d=>d.life>0);
  }
  drawScene(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ================= 사운드 =================
let AC,master;
function audio(){
  if(!AC){
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createDynamicsCompressor(); master.threshold.value=-14; master.ratio.value=12; master.connect(AC.destination);
  }
  if(AC.state==='suspended') AC.resume().catch(()=>{});
  return AC;
}
function bonkSound(power){
  if(!sfxOn) return;
  try{
    const a=audio(), t0=a.currentTime;
    const thud=a.createOscillator(), gain=a.createGain();
    thud.type='sine'; thud.frequency.setValueAtTime(power>=3?95:145,t0);
    thud.frequency.exponentialRampToValueAtTime(38,t0+.18);
    gain.gain.setValueAtTime(.36,t0);gain.gain.exponentialRampToValueAtTime(.001,t0+.24);
    thud.connect(gain);gain.connect(master);thud.start(t0);thud.stop(t0+.25);
    const buffer=a.createBuffer(1,Math.floor(a.sampleRate*.1),a.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const noise=a.createBufferSource(), ng=a.createGain(), filter=a.createBiquadFilter();
    noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=power>=3?3200:2000;
    ng.gain.setValueAtTime(.19,t0);ng.gain.exponentialRampToValueAtTime(.001,t0+.1);
    noise.connect(filter);filter.connect(ng);ng.connect(master);noise.start(t0);noise.stop(t0+.11);
    const squeak=a.createOscillator(), sg=a.createGain();squeak.type='square';
    squeak.frequency.setValueAtTime(450,t0);squeak.frequency.exponentialRampToValueAtTime(130,t0+.08);
    sg.gain.setValueAtTime(.07,t0);sg.gain.exponentialRampToValueAtTime(.001,t0+.09);
    squeak.connect(sg);sg.connect(master);squeak.start(t0);squeak.stop(t0+.1);
  }catch(e){}
}
function fanfare(){
  if(!sfxOn) return;
  try{
    const a=audio(), t0=a.currentTime;
    const notes=[523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f,i)=>{
      const o=a.createOscillator(), g=a.createGain(), t=t0+i*0.14;
      o.type='triangle'; o.frequency.value=f;
      g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.32);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+0.35);
    });
    // 마지막 화음
    notes.forEach(f=>{
      const o=a.createOscillator(), g=a.createGain(), t=t0+0.62;
      o.type='triangle'; o.frequency.value=f;
      g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+1.1);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+1.15);
    });
  }catch(e){}
}

// ================= 폭죽 =================
const fxc=document.getElementById('fx'), fx=fxc.getContext('2d');
let fxParts=[], fxUntil=0, fxRunning=false, fxLastBurst=0;
function burst(){
  const x=60+Math.random()*520, y=40+Math.random()*220;
  const hue=Math.floor(Math.random()*360);
  for(let i=0;i<34;i++){
    const ang=Math.random()*Math.PI*2, sp=60+Math.random()*180;
    if(fxParts.length>=200) break;
    fxParts.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.9+Math.random()*0.5,
      c:`hsl(${hue+Math.random()*40},95%,${55+Math.random()*25}%)`});
  }
}
let fxLastT=0;
function fxLoop(t){
  const dt=Math.min((t-fxLastT)/1000,0.05); fxLastT=t;
  fx.clearRect(0,0,640,440);
  if(performance.now()<fxUntil && performance.now()-fxLastBurst>320){ burst(); fxLastBurst=performance.now(); }
  fxParts.forEach(p=>{
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=240*dt;
    if(p.life>0){ fx.fillStyle=p.c; fx.globalAlpha=Math.min(1,p.life*2); fx.fillRect(p.x,p.y,4,4); }
  });
  fx.globalAlpha=1;
  fxParts=fxParts.filter(p=>p.life>0);
  if(fxParts.length||performance.now()<fxUntil) requestAnimationFrame(fxLoop);
  else { fxRunning=false; fx.clearRect(0,0,640,440); }
}
function startFireworks(ms){
  if(!motionOn) return;
  fxUntil=performance.now()+ms; fxLastBurst=0;
  if(!fxRunning){ fxRunning=true; fxLastT=performance.now(); requestAnimationFrame(fxLoop); }
}

// ================= 레어 이벤트: 컨펌 빵빠레 =================
function celebrate(quote){
  celebrating=true;
  clearTimeout(comboTimer);
  fanfare();
  startFireworks(4200);
  const d=document.createElement('div');
  d.className='celebrate';
  d.innerHTML=`<div class="c-title">🎊 컨펌 떴다!!! 🎊</div>
    <div class="c-quote">"${quote}"</div>
    <div class="c-sub">— ${PEOPLE[cur].name}님 · 이 순간을 캡처하세요 📸 (목격자: 나)</div>`;
  wrap.appendChild(d);
  setTimeout(()=>{
    d.remove(); celebrating=false;
    comboTimer=setTimeout(()=>{combo=0; updateHud();},1300);
  }, 4400);
}

// ================= 게임 로직 =================
const wrap=document.getElementById('stageWrap');
function tierFor(n){
  if(n>=5000) return '컨펌의 신';
  if(n>=1000) return '덱 파괴자';
  if(n>=200) return '컨펌 광전사';
  if(n>=50) return '인내심 바닥';
  if(n>=10) return '리마인드 중';
  return '예의 바름';
}
function impact(power){
  anim.bonk=1; anim.frown=.6; anim.shock=1; anim.desk=1;
  anim.shake=motionOn ? 1 : 0; anim.freeze=motionOn ? (power>=3?.045:.018) : 0;
  bonkSound(power);
  if(motionOn){
    for(let i=0;i<(power>=3?48:20);i++){
      debris.push({x:64+(Math.random()-.5)*12,y:34,vx:-30-Math.random()*85*power/2,
        vy:-65+Math.random()*105,life:.45+Math.random()*.65,w:1+Math.random()*3,h:1+Math.random()*2,
        c:['#bd173c','#ee3051','#86152d','#ff7581','#fff0cf'][i%5]});
    }
    if(power>=3) for(let i=0;i<8;i++) debris.push({x:20+Math.random()*88,y:60,vx:(Math.random()-.5)*80,vy:-40-Math.random()*50,life:1,w:4,h:2,c:'#f2e7dc'});
    debris=debris.slice(-140);
  }
}
function hit(){
  if(celebrating || window.confirmBellIntroActive) return;
  const now=performance.now(); if(now-hitGate<45) return; hitGate=now;
  const p=PEOPLE[cur]; checkRollover();
  bucket(store.daily,K.day)[cur]++; bucket(store.monthly,K.mon)[cur]++; bucket(store.yearly,K.year)[cur]++;
  store.myTotal++; lifetimeHits[cur]++; if(sharedOn) pending[cur]++;
  combo++; maxCombo=Math.max(maxCombo,combo);
  const heavy=combo%50===0, critical=combo%10===0;
  const power=heavy?3.5:critical?2:1;
  anim.age=0;anim.power=power;anim.hammer=1;
  if(combo%7===0) anim.sweat=1;
  // One impact per accepted press; no delayed callbacks can leak into another character.
  impact(power);save();
  clearTimeout(comboTimer);
  comboTimer=setTimeout(()=>{combo=0;updateHud();},1800);
  spawnFloat(heavy?'콰아앙!!':critical?'쾅!!':['퍽!','쾅!','빡!'][combo%3],340+Math.random()*55,120+Math.random()*20);
  if(critical){
    const badge=document.getElementById('impactBadge'); badge.textContent=heavy?'DECK BREAKER!':'CRITICAL!';
    badge.classList.remove('active'); void badge.offsetWidth; badge.classList.add('active');
  }
  // Personal lines cycle so every supplied line can actually be encountered.
  if(combo===1 || combo%5===0){
    speak(p.lines[lineCursor[cur]++ % p.lines.length]);
  }
  if(MILESTONES[combo]){
    banner(MILESTONES[combo],combo>=1000?combo:0);
    if(combo>=1000){fanfare(); startFireworks(2400);}
  } else if(!PREVIEW && Math.random()<.001){
    updateHud(); celebrate(RARE[Math.floor(Math.random()*RARE.length)]);return;
  }
  if(lifetimeHits[cur]%1000===0 && lifetimeHits[cur]<=5000 && !MILESTONES[combo]){
    banner(`${p.name}님 누적 ${lifetimeHits[cur].toLocaleString()}타 · 흔적 ${injuryLevel(cur)}/5`);
  }
  updateHud();
}
function spawnFloat(txt,x,y){
  const d=document.createElement('div'); d.className='float-text'; d.textContent=txt;
  d.style.left=(x/640*100)+'%'; d.style.top=(y/440*100)+'%';
  const old=wrap.querySelectorAll('.float-text'); if(old.length>=8) old[0].remove();
  wrap.appendChild(d); setTimeout(()=>d.remove(),850);
}
let bubbleEl=null, bubbleT=null;
function speak(txt,isMe){
  if(bubbleEl) bubbleEl.remove();
  bubbleEl=document.createElement('div');
  bubbleEl.className='bubble';
  bubbleEl.textContent=txt;
  if(isMe){ bubbleEl.style.right='5%'; bubbleEl.style.top='18%'; }
  else { bubbleEl.style.left='5%'; bubbleEl.style.top='22%'; }
  wrap.appendChild(bubbleEl);
  clearTimeout(bubbleT);
  bubbleT=setTimeout(()=>{bubbleEl&&bubbleEl.remove(); bubbleEl=null;}, 2200);
}
let bannerEl=null, bannerTimer=null;
function banner(txt,milestone=0){
  if(bannerEl) bannerEl.remove();clearTimeout(bannerTimer);
  const d=document.createElement('div'); d.className='banner'+(milestone?' milestone':'');
  if(milestone){const count=document.createElement('strong');count.textContent=milestone.toLocaleString()+' COMBO';d.appendChild(count);}
  d.appendChild(document.createTextNode(txt));wrap.appendChild(d);bannerEl=d;
  bannerTimer=setTimeout(()=>{d.remove();if(bannerEl===d) bannerEl=null;},milestone?2800:1750);
}

// ================= HUD & 리더보드 =================
const $=id=>document.getElementById(id);
function boardHtml(counts){
  const order=PEOPLE.map((p,i)=>({p,c:counts[i]})).sort((a,b)=>b.c-a.c);
  const max=Math.max(1,order[0].c);
  const medals=['🥇','🥈','🥉','4위'];
  return order.map((o,i)=>
    `<div class="row"><span class="rank">${medals[i]}</span><span class="name">${o.p.name}님</span>
     <span class="bar-wrap"><span class="bar" style="width:${o.c/max*100}%"></span></span>
     <span class="cnt">${o.c.toLocaleString()}회</span></div>`).join('');
}
function updateHud(){
  $('combo').textContent=combo;
  $('maxCombo').textContent=maxCombo;
  const rage=combo>0 && combo%50===0 ? 100 : combo%50*2;
  $('rage').textContent=rage+'%';$('rageFill').style.width=rage+'%';$('rageMeter').setAttribute('aria-valuenow',String(rage));
  $('hitRank').textContent=tierFor(combo);$('btn').classList.toggle('fury',rage>=80);
  $('targetLabel').textContent=PEOPLE[cur].name+'님 · 누적 '+lifetimeHits[cur].toLocaleString()+'타'+(injuryLevel(cur)?' · 흔적 '+injuryLevel(cur)+'/5':'');
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const cD = sharedOn ? add(shared.daily  ||[0,0,0,0], pending) : bucket(store.daily,K.day).slice();
  const cM = sharedOn ? add(shared.monthly||[0,0,0,0], pending) : bucket(store.monthly,K.mon).slice();
  const cY = sharedOn ? add(shared.yearly ||[0,0,0,0], pending) : bucket(store.yearly,K.year).slice();
  $('sessionTotal').textContent=`나의 누적 ${store.myTotal.toLocaleString()}타 · 오늘 팀 합계 ${cD.reduce((a,b)=>a+b,0).toLocaleString()}타`;
  $('boardToday').innerHTML=boardHtml(cD);
  $('boardMonth').innerHTML=boardHtml(cM);
  $('yearLine').textContent=`🗄 ${K.year}년 팀 누적 ${cY.reduce((a,b)=>a+b,0).toLocaleString()}회 · 해가 바뀌면 이전 기록은 자동 보관됩니다`;
}

// ================= 캐릭터 탭 =================
function avatarCanvas(p){
  const c=document.createElement('canvas'); c.width=20; c.height=20;
  c.style.width='20px'; c.style.height='20px';
  const x=c.getContext('2d');
  if(p.avatar){
    const disc=(cx,cy,r,color)=>{x.fillStyle=color;for(let y=-r;y<=r;y++){const w=Math.floor(Math.sqrt(r*r-y*y));x.fillRect(cx-w,cy+y,w*2+1,1);}};
    if(p.avatar==='orange'){disc(10,6,4,'#e99024');disc(10,20,9,'#e99024');}
    else {disc(10,10,9,'#8f7167');x.fillStyle='#fffaf4';['00111','00010','00010','00010','10010','10010','01100'].forEach((row,y)=>[...row].forEach((v,xx)=>{if(v==='1')x.fillRect(8+xx,7+y,1,1);}));}
    return c;
  }
  x.fillStyle='#f5cfa7'; x.fillRect(4,6,12,12);
  x.fillStyle=p.hair; x.fillRect(3,4,14,5);
  if(p.hairStyle==='long'||p.hairStyle==='wave'){ x.fillRect(2,8,3,12); x.fillRect(15,8,3,12); }
  if(p.hairStyle==='bob'){ x.fillRect(2,8,3,8); x.fillRect(15,8,3,8); }
  if(p.hairStyle==='tied'){ x.fillRect(16,3,4,5); }
  x.fillStyle='#222'; x.fillRect(7,12,2,2); x.fillRect(12,12,2,2);
  return c;
}
const tabs=$('tabs');
PEOPLE.forEach((p,i)=>{
  const b=document.createElement('button'); b.className='tab'+(i===0?' on':'');
  b.appendChild(avatarCanvas(p));
  b.appendChild(document.createTextNode(p.name+'님'));
  b.onclick=()=>{ clearTimeout(comboTimer);cur=i;combo=0;anim.age=1;anim.bonk=0;anim.frown=0;anim.shock=0;anim.shake=0;anim.desk=0;anim.freeze=0;debris=[]; document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',j===i)); updateHud(); speak('…네? 저요?'); };
  tabs.appendChild(b);
});

// ================= 입력 =================
document.addEventListener('keydown',e=>{
  if(window.confirmBellIntroActive) return;
  const tag=e.target.tagName;
  if(['INPUT','TEXTAREA','SELECT'].includes(tag) || e.target.isContentEditable) return;
  if(e.code==='Space' && (!['BUTTON','A'].includes(tag) || e.target.id==='btn')){e.preventDefault();hit();}
  if(e.key>='1'&&e.key<='4' && !e.repeat) document.querySelectorAll('.tab')[+e.key-1].click();
});
cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();hit();});
// Native click preserves keyboard activation and avoids counting touch twice.
$('btn').addEventListener('click',hit);
$('sfxToggle').addEventListener('click',()=>{sfxOn=!sfxOn;$('sfxToggle').textContent=sfxOn?'🔊 타격음 ON':'🔇 타격음 OFF';$('sfxToggle').setAttribute('aria-pressed',String(sfxOn));});
function renderMotion(){ $('motionToggle').textContent=motionOn?'화면 흔들림 ON':'화면 흔들림 OFF';$('motionToggle').setAttribute('aria-pressed',String(motionOn)); }
$('motionToggle').addEventListener('click',()=>{motionOn=!motionOn;renderMotion();});
if(PREVIEW) $('boardMode').textContent='테스트 모드 · 실제 기록에 반영되지 않음';
renderMotion(); updateHud();
