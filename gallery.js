'use strict';
(() => {
  const query=new URLSearchParams(location.search);
  if(!PREVIEW || query.get('gallery')!=='1') return;
  document.querySelector('main').hidden=true;
  document.getElementById('musicCard').hidden=true;
  const page=document.createElement('section');page.className='stage-gallery';
  page.innerHTML='<header><span>CONFIRM BELL · CHARACTER PROGRESSION</span><h1>1,000타부터 10,000타까지</h1><p>10,000타에 병상 · 다음 한 대에 엔딩 후 새 판 시작</p><nav aria-label="미리 볼 캐릭터"></nav></header><div class="stage-grid"></div><p class="gallery-note">실제 게임 렌더링 · 미리보기는 기록에 반영되지 않습니다.</p><a href="./">← 컨펌벨로 돌아가기</a>';
  document.body.appendChild(page);
  const nav=page.querySelector('nav'),grid=page.querySelector('.stage-grid');
  function render(index){
    const old={cur,anim:{...anim},debris:[...debris],hits:roundHits.slice(),combo,sfxOn,motionOn};
    cur=index;combo=0;sfxOn=false;motionOn=true;debris=[];
    grid.replaceChildren();
    for(let level=0;level<=11;level++){
      const hit=level===11;
      roundHits[cur]=(hit?3:level)*1000;
      anim={...old.anim,age:1,bonk:0,frown:0,sweat:0,power:1,shake:0,freeze:0,shock:0,desk:0};
      debris=[];
      if(hit){anim.age=.15;anim.power=3.5;impact(3.5);anim.shake=0;}
      drawScene();
      const tile=document.createElement('article');tile.className='stage-tile';
      const heading=document.createElement('h2');heading.textContent=hit?'타격 순간':(level*1000).toLocaleString()+'타';
      const subtitle=document.createElement('p');subtitle.textContent=hit?'뒤에서 후려치는 풀스윙':STAGE_NAMES[level];
      const picture=document.createElement('canvas');picture.width=640;picture.height=440;
      picture.setAttribute('role','img');picture.setAttribute('aria-label',PEOPLE[index].name+' · '+heading.textContent+' · '+subtitle.textContent);
      picture.getContext('2d').drawImage(cv,0,0);
      tile.append(heading,subtitle,picture);grid.appendChild(tile);
    }
    cur=old.cur;anim=old.anim;debris=old.debris;combo=old.combo;sfxOn=old.sfxOn;motionOn=old.motionOn;
    old.hits.forEach((n,i)=>{roundHits[i]=n;});
    [...nav.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  }
  PEOPLE.forEach((person,index)=>{
    const button=document.createElement('button');button.type='button';button.textContent=person.name+'님';
    button.addEventListener('click',()=>render(index));nav.appendChild(button);
  });
  render(0);
})();
