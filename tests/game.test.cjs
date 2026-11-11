const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function harness({preview=true,saved=null,reduced=false}={}){
  const elements=new Map(),timers=new Map(), frames=[], fetches=[], writes=[];let now=0,seq=0;
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  class El{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={setProperty(k,v){this[k]=v}};this.attrs={};this.events={};this.className='';this.textContent='';this.width=640;this.height=440;this.classList={add:x=>{this.className+=' '+x},remove:x=>{this.className=this.className.split(' ').filter(c=>c!==x).join(' ')},toggle:(x,on)=>{this.classList.remove(x);if(on)this.classList.add(x)}};}
    appendChild(c){c.parent=this;this.children.push(c);return c}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
    setAttribute(k,v){this.attrs[k]=v}
    focus(){doc.activeElement=this}
    getContext(){return ctx}
    addEventListener(k,f){this.events[k]=f}
    click(){this.onclick?.();this.events.click?.({target:this})}
    querySelectorAll(q){const out=[];function walk(el){for(const c of el.children){if(c.className?.split(' ').includes(q.slice(1)))out.push(c);walk(c)}}walk(this);return out}
  }
  const doc=new El();doc.head=new El();doc.documentElement=new El();doc.getElementById=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id)};
  doc.createElement=tag=>new El(tag);doc.createTextNode=text=>Object.assign(new El(),{textContent:text});
  doc.querySelector=q=>doc.getElementById(q==='main'?'main':q.replace('#',''));
  doc.querySelectorAll=q=>q==='.tab'?elements.get('tabs').children:[];
  const context=vm.createContext({console,document:doc,location:{search:preview?'?preview=1':''},URLSearchParams,Date,Math,
    performance:{now:()=>now},matchMedia:()=>({matches:reduced}),window:{},
    localStorage:{getItem:()=>saved&&JSON.stringify(saved),setItem:(k,v)=>writes.push([k,JSON.parse(v)])},
    setTimeout:(f,ms)=>{const id=++seq;timers.set(id,{f,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:()=>0,
    requestAnimationFrame:f=>frames.push(f),fetch:(...args)=>{fetches.push(args);return Promise.resolve({json:()=>Promise.resolve(null)})}
  });
  vm.runInContext(fs.readFileSync('game.js','utf8'),context);
  return {context,elements,timers,frames,fetches,writes,doc,advance:ms=>now+=ms,run:x=>vm.runInContext(x,context),hit:()=>{now+=60;elements.get('btn').click()}};
}
test('10,000 accepted hits preserve totals, trigger each milestone, and bound live effects',()=>{
  const h=harness();
  const milestones=[];
  for(let i=1;i<=10000;i++){
    h.hit();
    if(i%1000===0)milestones.push(i);
  }
  assert.deepEqual(milestones,[1000,2000,3000,4000,5000,6000,7000,8000,9000,10000]);
  assert.equal(h.run('combo'),10000);assert.equal(h.run('store.myTotal'),10000);
  assert.equal(h.run('store.daily[K.day][0]'),10000);
  assert.equal(h.elements.get('rage').textContent,'100%');
  assert.ok(h.run('debris.length')<=140);
  assert.ok(h.elements.get('stageWrap').querySelectorAll('.float-text').length<=8);
  assert.equal(h.fetches.length,0);assert.equal(h.writes.length,0);
});
test('duplicate input is ignored, character switch resets combo and directs new counts correctly',()=>{
  const h=harness();h.hit();h.elements.get('btn').click();assert.equal(h.run('combo'),1);
  h.elements.get('tabs').children[3].click();h.hit();
  assert.equal(h.run('combo'),1);assert.equal(h.run('store.daily[K.day][0]'),1);assert.equal(h.run('store.daily[K.day][3]'),1);
  assert.equal(h.run('bubbleEl.textContent'),'덱으로 볼게요');
  const timeout=[...h.timers.values()].find(t=>t.ms===1800);timeout.f();assert.equal(h.run('combo'),0);
});
test('hammer keeps a rigid handle and triggers impact only at contact, including rapid input and character switches',()=>{
  const h=harness();
  for(let age=0;age<=.52;age+=.01){
    const p=h.run(`hammerPose(${age})`);
    assert.ok(Math.abs(Math.hypot(p.x-p.grip.x,p.y-p.grip.y,p.z-p.grip.z)-51)<1e-9);
  }
  h.hit();h.run('loop(40);loop(80)');
  assert.equal(h.run('anim.shock'),0);assert.equal(h.run('debris.length'),0);
  h.run('loop(125)');assert.ok(h.run('anim.shock')>0);assert.equal(h.run('anim.pendingImpact'),false);
  const particles=h.run('debris.length');h.run('loop(145);loop(165)');assert.equal(h.run('debris.length'),particles);
  h.run('anim.shock=0;debris=[]');h.hit();h.hit();h.run('loop(200)');assert.ok(h.run('anim.shock')>0);
  h.hit();h.elements.get('tabs').children[1].click();h.run('loop(240);loop(280);loop(320)');
  assert.equal(h.run('anim.shock'),0);assert.equal(h.run('debris.length'),0);
});
test('all requested personal lines can be reached and never leak to a different character',()=>{
  const h=harness();
  for(let index=0;index<4;index++){
    h.elements.get('tabs').children[index].click();
    const lines=h.run(`PEOPLE[${index}].lines`),seen=new Set();
    for(let i=0;i<Math.max(lines.length,8)*10;i++){h.hit();seen.add(h.run('bubbleEl.textContent'));}
    for(const line of [...lines,...h.run('COMMON_LINES')]) assert.ok(seen.has(line),line);
  }
});
test('all character renders and animation frames run, including reduced motion',()=>{
  for(const reduced of [false,true]){
    const h=harness({reduced});
    for(let i=0;i<4;i++){
      h.elements.get('tabs').children[i].click();h.hit();
      for(let t=16;t<600;t+=16) h.run(`loop(${t})`);
    }
    if(reduced){assert.equal(h.run('debris.length'),0);assert.equal(h.run('anim.shake'),0);}
  }
});
test('normal mode keeps the existing storage key and accumulated records',()=>{
  const h=harness({preview:false,saved:{daily:{},monthly:{},yearly:{},myTotal:123,maxCombo:800}});
  h.run('Math.random=()=>.5');h.hit();
  const [key,state]=h.writes.at(-1);assert.equal(key,'confirmbell_v3');assert.equal(state.myTotal,124);assert.equal(state.maxCombo,800);
});
test('music autoplay block, first interaction, manual pause and embed failure have honest UI states',()=>{
  const h=harness();let played=0,paused=0,config,current=12;const seeks=[];
  const player={unMute:()=>{},playVideo:()=>played++,pauseVideo:()=>paused++,setVolume:()=>{},getDuration:()=>3600,getCurrentTime:()=>current,seekTo:(s)=>{current=s;seeks.push(s)},getIframe:()=>({setAttribute:()=>{}})};
  h.context.location.origin='http://localhost:8769';
  h.context.YT={Player:function(id,c){config=c;return player}};
  vm.runInContext(fs.readFileSync('music.js','utf8'),h.context);h.context.window.onYouTubeIframeAPIReady();
  config.events.onReady({target:player});assert.equal(played,0);
  h.context.window.confirmBellMusic.start(true);assert.equal(played,1);assert.equal(seeks[0],0);
  config.events.onAutoplayBlocked();assert.match(h.elements.get('musicStatus').textContent,/터치/);
  h.doc.events.pointerdown({type:'pointerdown',target:{closest:()=>null}});assert.equal(played,2);
  config.events.onStateChange({data:1});assert.equal(h.elements.get('musicStatus').textContent,'');h.elements.get('musicToggle').click();assert.equal(paused,1);
  config.events.onStateChange({data:2});h.doc.events.pointerdown({type:'pointerdown',target:{closest:()=>null}});assert.equal(played,2);
  h.elements.get('musicSeek').value='120';h.elements.get('musicSeek').events.input();h.elements.get('musicSeek').events.change();assert.equal(seeks.at(-1),120);
  h.elements.get('musicForward').click();assert.equal(seeks.at(-1),130);
  h.elements.get('musicBack').click();assert.equal(seeks.at(-1),120);
  assert.ok(!h.elements.get('musicCard').className.includes('playing'));
  config.events.onError();assert.match(h.elements.get('musicStatus').textContent,/재생 불가/);
});

test('injuries track each character lifetime independently of combo and stop at ten',()=>{
 const h=harness({preview:false,saved:{daily:{},monthly:{},yearly:{2025:[990,1999,2999,4999],2026:[9,0,0,0]},myTotal:999,maxCombo:0}});
 h.run('Math.random=()=>.5');
 assert.equal(h.run('injuryLevel(0)'),0);h.hit();assert.equal(h.run('injuryLevel(0)'),1);
 for(const i of [1,2,3]){h.elements.get('tabs').children[i].click();h.hit();assert.equal(h.run(`injuryLevel(${i})`),i===3?5:i+1);}
 h.run('roundHits[3]=5999');h.hit();assert.equal(h.run('injuryLevel(3)'),6);
 h.run('roundHits[3]=10000');h.hit();assert.equal(h.run('injuryLevel(3)'),10);
 for(let level=0;level<=5;level++)h.run(`drawInjuries(56,27,${level})`);
 h.context.window.confirmBellIntroActive=true;const total=h.run('store.myTotal');h.hit();assert.equal(h.run('store.myTotal'),total);
});

test('all ten stages render for all characters, including wheelchair and hospital bed',()=>{
 const h=harness();
 for(let person=0;person<4;person++){
  h.run(`cur=${person}`);
  for(let level=0;level<=10;level++){
   h.run(`roundHits[cur]=${level*1000};anim.age=1;drawScene()`);
   assert.equal(h.run('injuryLevel(cur)'),level);
   if(level<10)h.hit();h.run('anim.age=.15;drawScene()');
  }
 }
 h.run('roundHits[cur]=4999;combo=49');h.hit();assert.equal(h.run('anim.power'),3.5);
 assert.equal(h.elements.get('rage').textContent,'50%');
 h.hit();assert.equal(h.elements.get('rage').textContent,'50%');
});

test('10,001st hit ends the round; restart resets play counters while preserving all leaderboard buckets and pending totals',()=>{
 const h=harness({preview:false,saved:{daily:{},monthly:{},yearly:{2026:[100,200,300,400]},roundHits:[9999,6000,3000,1000],myTotal:1000,maxCombo:111}});
 h.hit();assert.equal(h.run('endingActive'),false);assert.equal(h.run('roundHits[0]'),10000);assert.equal(h.elements.get('rage').textContent,'100%');
 h.hit();assert.equal(h.run('endingActive'),true);assert.equal(h.elements.get('ending').hidden,false);
 const before=h.run('JSON.stringify({daily:store.daily,monthly:store.monthly,yearly:store.yearly,pending})');
 const total=h.run('store.myTotal');h.hit();assert.equal(h.run('store.myTotal'),total);
 [...h.timers.values()].find(t=>t.ms===4200).f();assert.ok(h.elements.get('ending').className.includes('blackout'));
 [...h.timers.values()].find(t=>t.ms===6000).f();
 assert.equal(h.run('endingActive'),false);assert.equal(h.elements.get('ending').hidden,true);
 assert.equal(h.run('roundHits.every(n=>n===0)'),true);assert.equal(h.run('store.myTotal'),0);assert.equal(h.run('maxCombo'),0);assert.equal(h.run('combo'),0);
 assert.equal(h.run('JSON.stringify({daily:store.daily,monthly:store.monthly,yearly:store.yearly,pending})'),before);
 assert.equal(h.elements.get('rage').textContent,'0%');assert.equal(h.elements.get('main').inert,undefined);
 h.hit();assert.equal(h.run('roundHits[0]'),1);
 assert.equal(h.elements.get('stageWrap').querySelectorAll('.banner').length,0);
});
