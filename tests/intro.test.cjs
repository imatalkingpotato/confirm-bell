const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function harness({seen='',now='2026-11-11T14:59:59Z',preview=false,throws=false,reduced=false,broken=false}={}){
 const nodes=new Map(),timers=new Map(),writes=[];let seq=0;
 class El{
  constructor(){this.children=[];this.events={};this.hidden=false;this.inert=false;this.style={setProperty(){}};this.classes=new Set();this.classList={add:(...s)=>s.forEach(v=>this.classes.add(v)),remove:(...s)=>s.forEach(v=>this.classes.delete(v)),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
  appendChild(c){this.children.push(c)}
  focus(){doc.activeElement=this}
  addEventListener(k,f){this.events[k]=f}
  decode(){return broken?new Promise(()=>{}):Promise.resolve()}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
 const doc=new El();doc.documentElement=new El();doc.activeElement={tagName:'BODY'};doc.getElementById=get;doc.createElement=()=>new El();doc.querySelector=get;
 get('intro').hidden=true;get('introReplay').tagName='BUTTON';
 class D extends Date{constructor(...args){super(...(args.length?args:[now]))}}
 const ctx=vm.createContext({document:doc,window:{},URLSearchParams,location:{search:preview?'?preview=1':''},Intl,Date:D,Promise,
  matchMedia:()=>({matches:reduced}),localStorage:{getItem(){if(throws)throw Error('denied');return seen},setItem(k,v){if(throws)throw Error('denied');writes.push([k,v])}},
  setTimeout:(f,ms)=>{const id=++seq;timers.set(id,{f,ms});return id},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('intro.js','utf8'),ctx);
 return {nodes,get,doc,ctx,writes,timers,settle:()=>new Promise(resolve=>setImmediate(resolve)),fire(ms){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].f()}};
}
test('daily intro uses Korean midnight; preview never writes or suppresses opening',async()=>{
 const h=harness({seen:'2026-11-11'});assert.equal(h.get('intro').hidden,true);
 const next=harness({seen:'2026-11-11',now:'2026-11-11T15:00:00Z'});assert.equal(next.get('intro').hidden,false);
 next.get('introSkip').events.click();assert.equal(next.writes[0][1],'2026-11-12');
 const preview=harness({preview:true,seen:'2026-11-11'});preview.get('introSkip').events.click();assert.equal(preview.writes.length,0);
});
test('completion and replay restore focus/inert, and skip cancels pending preload',async()=>{
 const h=harness();assert.equal(h.ctx.window.confirmBellIntroActive,true);assert.equal(h.get('main').inert,true);
 await h.settle();h.fire(10100);assert.ok(h.get('intro').classes.has('leaving'));h.fire(1100);
 assert.equal(h.ctx.window.confirmBellIntroActive,false);assert.equal(h.get('main').inert,false);assert.equal(h.doc.activeElement,h.get('btn'));
 h.doc.activeElement=h.get('introReplay');h.get('introReplay').events.click();h.get('introSkip').events.click();await h.settle();
 assert.equal(h.doc.activeElement,h.get('introReplay'));assert.equal(h.get('intro').hidden,true);assert.equal(h.timers.size,0);
});
test('blocked storage and missing images cannot trap users; only redacted tracker is loaded',async()=>{
 const h=harness({throws:true,broken:true});h.fire(1200);await h.settle();assert.ok(h.get('intro').classes.has('running'));
 h.doc.events.keydown({key:'Escape',preventDefault(){}});assert.equal(h.get('intro').hidden,true);
 const sources=h.get('introCollage').children.map(i=>i.src);assert.equal(sources.length,13);assert.equal(sources[12],'assets/intro/tracker-blurred.png');
 const reduced=harness({reduced:true});await reduced.settle();reduced.fire(4500);reduced.fire(200);assert.equal(reduced.get('intro').hidden,true);
});
