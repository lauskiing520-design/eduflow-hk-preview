(() => {
  'use strict';
  const key='eduflow:class-marking:v1';
  const students=['A01','B02','C03','D04','E05','F06'];
  const questions=['解方程 2x + 5 = −3。','把 3 × 3 寫成冪式。'];
  const work0=['2x = −8；兩邊除以 2','2x = −8；x = −4','2x = −8；x = −4','x + 2.5 = −1.5；x = −4','把 +5 移到右邊','2x = −8；x = 4'];
  const final0=['x = +4','x = −4','x = −4','x = −4','x = −4','x = 4'];
  const issues=[
    {i:0,q:0,title:'負號',url:'handwriting-sample.webp',symbol:{id:'minus',kind:'minus',text:'+',start:4,box:[396/1448,410/1086,463/1448,435/1086]}},
    {i:1,q:1,title:'指數',url:'class-marking-sheet-b.png',symbol:{id:'power',kind:'exponent',text:'7',start:2,box:[548/1340,447/860,590/1340,499/860]}}
  ];
  function fresh(){
    return {v:1,revision:0,ink:[false,false],answers:students.map((_,i)=>[final0[i],i===1?'3^7':'3^2']),
      // D04 and E05 received scores before the department clarified the method mark.
      grades:students.map((_,i)=>[i===3||i===4?[0,1]:null,null]),
      published:[null,null,null,1,1,null],comments:students.map(()=>['','']),amendment:null};
  }
  let memory=fresh(),storeAvailable=true;
  function read(){
    if(!storeAvailable)return memory;
    try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fresh();}
    catch{storeAvailable=false;return memory;}
  }
  let state=read(),activeInk=null,groupQuestion=0,groupKey='',basis='answer',requestedIssue=null,stage='';
  const $=id=>document.getElementById(id), host=$('cm-work'), status=$('cm-status');
  function tell(str){status.textContent=str+(!storeAvailable?' 此裝置未能保存試用記錄。':'');}
  function update(edit){
    const latest=read();
    if(latest.revision!==state.revision){tell('這份作業已在另一分頁更新。請重新載入，再核對最新內容。');return false;}
    const next=structuredClone(state);edit(next);next.revision++;
    try{if(storeAvailable)localStorage.setItem(key,JSON.stringify(next));}catch{storeAvailable=false;}
    memory=state=next;return true;
  }
  function el(name,text,cls){const n=document.createElement(name);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function btn(text,fn,cls){const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;}
  function field(text,input){const n=el('label',text,'field');n.append(input);return n;}
  function cols(){const pair=el('div',null,'cm-pair'),side=el('aside'),panel=el('section',null,'cm-panel');pair.append(side,panel);host.replaceChildren(pair);return {side,panel};}
  function response(i,q){
    const n=el('div',null,'response');n.append(el('pre',q===0?work0[i]:'3 × 3'),el('p','答案　'+state.answers[i][q]));return n;
  }
  function jump(hash){if(location.hash==='#'+hash)render();else location.hash=hash;}
  function count(name){return students.reduce((n,_,i)=>n+Number(name(i)),0);}
  const pending=(i)=>issues.some((issue,j)=>issue.i===i&&!state.ink[j]);
  function menuButton(label,chosen,go){const b=btn(label,go);b.setAttribute('aria-pressed',String(chosen));return b;}
  function markSelect(label,current,max){
    const sel=el('select');for(let n=0;n<=max;n++)sel.add(new Option(n+' 分',String(n)));
    sel.value=String(current);const l=field(label,sel);return [l,sel];
  }
  function ink(){
    const {side,panel}=cols(),left=state.ink.filter(x=>!x).length;
    side.append(el('h2','待核對筆跡'),el('p','餘下 '+left+' 處，共 2 處','muted'));
    const list=el('div',null,'cm-list');side.append(list);
    const k=requestedIssue??state.ink.findIndex(x=>!x);requestedIssue=null;
    issues.forEach((item,j)=>list.append(menuButton(students[item.i]+' · 第 '+(item.q+1)+' 題 '+item.title+(state.ink[j]?' ✓':''),k===j,()=>{
      if(activeInk?.hasPendingEdit()){tell('請先套用或放棄目前的修改。');return;}requestedIssue=j;render();
    })));
    if(k<0){
      panel.append(el('h2','兩處筆跡已核對'),el('p','修正後的文字已帶入這份作業。'));
      issues.forEach(({i,q})=>panel.append(el('p',students[i]+'　'+state.answers[i][q],'note')));
      panel.append(btn('開始按題批改',()=>jump('groups'),'primary'));return;
    }
    const {i,q,title,url,symbol}=issues[k],reading=el('input');reading.readOnly=true;reading.value=state.answers[i][q];
    panel.append(el('p',students[i]+' · 第 '+(q+1)+' 題','muted'),el('h2',questions[q]),field('目前識別答案',reading));
    if(state.grades[i][q]!==null){
      const original=el('a','查看整頁原稿');original.href=url;original.target='_blank';original.rel='noopener';
      panel.append(el('p','這份作答已進入正式評分。'),original,btn('查看本題評分',()=>{groupQuestion=q;groupKey=normalized(state.answers[i][q]);jump('groups');},'cm-quiet'));return;
    }
    const view=el('div');panel.append(view);
    activeInk=EduInkSuspects.mount(view,{pageCount:1,pageUrl:()=>url,fields:{answer:reading},
      question:{id:'q'+q,page:1,pages:[1],symbols:[{...symbol,field:'answer',page:1,reviewed:state.ink[k]}]},
      onReview({value}){
        if(!update(d=>{d.answers[i][q]=value;d.ink[k]=true;}))throw Error('請重新載入再核對。');
        groupKey='';requestedIssue=null;render();tell(students[i]+' 的'+title+'已核對。');
      }});
    // Open in place, keeping the assignment title in view on first load.
    view.querySelector('[data-ink-symbol]').click();
  }
  function normalized(value){return value.normalize('NFKC').replaceAll('−','-').replace(/\s+/g,'').toLowerCase();}
  function points(q){return q===0?['等式變形','最後答案']:['底數','指數'];}
  function note(panel,q){
    if(state.amendment&&q===0)panel.append(el('p','「等式變形」修訂　'+state.amendment.text,'note'));
  }
  function groups(){
    const {side,panel}=cols(),q=groupQuestion,select=el('select');
    questions.forEach((_,n)=>select.add(new Option('第 '+(n+1)+' 題',String(n))));
    select.value=String(q);select.onchange=()=>{groupQuestion=Number(select.value);groupKey='';render();};
    const mode=el('select');mode.add(new Option('最後答案','answer'));mode.add(new Option('解題步驟','working'));
    mode.value=basis;mode.onchange=()=>{basis=mode.value;groupKey='';render();};
    side.append(el('h2','同題分組批改'),field('選擇題目',select),field('按甚麼分組',mode));
    const sample=i=>basis==='answer'?state.answers[i][q]:(q===0?work0[i]:'3 × 3');
    const buckets=new Map();students.forEach((_,i)=>{
      if(pending(i))return;const k=normalized(sample(i));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);
    });
    if(!buckets.has(groupKey))groupKey=buckets.keys().next().value;
    const list=el('div',null,'cm-list');side.append(list);
    for(const [k,ids] of buckets)list.append(menuButton(sample(ids[0])+' · '+ids.length+' 人',k===groupKey,()=>{groupKey=k;render();}));
    const waiting=count(pending);if(waiting)side.append(btn('返回核對 '+waiting+' 份手寫卷',()=>jump('ink'),'cm-quiet'));
    panel.append(el('h2',questions[q]),el('p','按'+(basis==='answer'?'最後答案':'解題步驟')+'分組，空格和負號字形視作相同。請對照每人的步驟，只勾選適用同一評分的作答。','muted'));
    note(panel,q);
    const ids=buckets.get(groupKey)||[],boxes=[];
    for(const i of ids){
      const row=el('div',null,'row'),label=el('label',null,'check'),cb=el('input');cb.type='checkbox';cb.value=String(i);cb.dataset.student=students[i];
      // Previously released submissions go through an individual recheck before republication.
      cb.disabled=q===0&&state.published[i]!==null;
      const last=state.grades[i][q];label.append(cb,el('span',students[i]+(last?' · '+last.reduce((a,b)=>a+b,0)+' / 2 分':' · 待評')+(cb.disabled?' · 已發布':'')));
      row.append(label,response(i,q));if(state.comments[i][q])row.append(el('p','評語　'+state.comments[i][q]));panel.append(row);
      boxes.push(cb);
    }
    const score=el('div',null,'score'),controls=points(q).map(p=>markSelect(p,0,1));
    for(const [label,sel] of controls){sel.add(new Option('請選擇','',true,true),0);sel.value='';score.append(label);}
    const comment=el('textarea');comment.maxLength=400;comment.rows=2;
    const save=btn('套用到所選作答',()=>{
      const selected=boxes.filter(b=>b.checked&&!b.disabled).map(b=>Number(b.value));if(!selected.length)return;
      if(controls.some(([,s])=>s.value==='')){tell('請明確選擇兩個評分點的分數。');return;}
      const marks=controls.map(([,s])=>Number(s.value));
      if(!update(d=>{for(const i of selected){
        if(q===0&&d.amendment&&d.grades[i][0]?.[0]!==marks[0])delete d.amendment.reviewed[i];
        d.grades[i][q]=marks.slice();if(comment.value.trim())d.comments[i][q]=comment.value.trim();
      }}))return;
      groups();tell('已保存 '+selected.length+' 份作答的評分，其他學生維持原分。');
    },'primary');
    save.disabled=true;for(const b of boxes)b.onchange=()=>{save.disabled=!boxes.some(b=>b.checked&&!b.disabled);};
    panel.append(el('h3','所選作答的評分'),score,field('共用評語（選填）',comment),save);
    if(q===0)panel.append(btn('修訂本題評分準則',()=>jump('amend'),'cm-quiet'));
  }
  function amendments(){
    const {side,panel}=cols(),am=state.amendment;
    side.append(el('h2','修訂評分準則'),el('p','第 1 題 · 等式變形（1 分）','muted'),el('h3','原有準則'),el('p','列出 2x = −8，給方法分 1 分。'));
    panel.append(el('h2',questions[0]));
    if(!am){
      panel.append(el('p','D04 先將等式兩邊除以 2，再求出 x。這個解法也成立，可以補充方法分的準則，再逐份回看已評作答。'));
      const text=el('textarea');text.maxLength=500;text.value='接受先將等式兩邊除以 2，再解出 x 的等價方法。';
      const save=btn('保存準則，找出已評作答',()=>{
        const value=text.value.trim();if(!value){tell('請填寫補充準則。');text.focus();return;}
        if(!update(d=>{d.amendment={text:value,reviewed:{}};}))return;
        amendments();tell('已加入準則，請逐份核對是否適用。');
      },'primary');panel.append(field('補充準則',text),save);return;
    }
    note(panel,0);
    const graded=students.map((_,i)=>i).filter(i=>state.grades[i][0]!==null);
    const outstanding=graded.filter(i=>!Object.hasOwn(am.reviewed,i));
    side.append(el('p','待核對 '+outstanding.length+' / '+graded.length+' 份','note'));
    panel.append(el('p','列出本題已有評分的作答，包含已給滿分的學生。請核對步驟後決定保留或調整方法分。','muted'));
    for(const i of graded){
      const row=el('article',null,'row'),marks=state.grades[i][0],done=Object.hasOwn(am.reviewed,i);
      row.append(el('h3',students[i]+(done?' · 已核對':' · 待核對')),response(i,0));
      const [label,sel]=markSelect('方法分',marks[0],1);const action=btn(done?'重新核對':'確認這份作答',()=>{
        if(!update(d=>{d.grades[i][0][0]=Number(sel.value);d.amendment.reviewed[i]=true;}))return;
        amendments();tell(students[i]+' 的方法分已確認。');
      });row.append(label,action);panel.append(row);
    }
    const changed=graded.filter(i=>Object.hasOwn(am.reviewed,i)&&state.published[i]!==null&&state.published[i]!==state.grades[i][0].reduce((a,b)=>a+b,0));
    panel.append(el('h3','已發布成績的修訂'));
    const receipts=el('details'),summary=el('summary','查看學生目前可見的本題分數');receipts.append(summary);
    students.forEach((label,i)=>{if(state.published[i]!==null)receipts.append(el('p',label+'　'+state.published[i]+' / 2 分'));});
    panel.append(receipts);
    if(!changed.length){panel.append(el('p','目前沒有需要重新發布的分數。','muted'));return;}
    const picks=[];for(const i of changed){const l=el('label',null,'check'),cb=el('input');cb.type='checkbox';cb.value=String(i);
      l.append(cb,el('span',students[i]+'　學生目前看到 '+state.published[i]+' / 2 分，修訂後 '+state.grades[i][0].reduce((a,b)=>a+b,0)+' / 2 分'));panel.append(l);picks.push(cb);}
    const send=btn('發布所選改分',()=>{
      const ids=picks.filter(cb=>cb.checked).map(cb=>Number(cb.value));if(!ids.length)return;
      if(update(d=>{for(const i of ids)d.published[i]=d.grades[i][0].reduce((a,b)=>a+b,0);})){amendments();tell('已向 '+ids.map(i=>students[i]).join('、')+' 發布修訂分數。');}
    },'primary');send.disabled=true;for(const cb of picks)cb.onchange=()=>{send.disabled=!picks.some(b=>b.checked);};panel.append(send);
  }
  function render(){
    activeInk=null;stage=location.hash.slice(1);if(!['ink','groups','amend'].includes(stage))stage='ink';
    document.querySelectorAll('.cm-tabs a').forEach(a=>{if(a.hash==='#'+stage)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    ({ink,groups,amend:amendments})[stage]();
  }
  document.querySelector('.cm-tabs').addEventListener('click',e=>{
    if(e.target.closest('a')&&activeInk?.hasPendingEdit()){e.preventDefault();tell('請先套用或放棄目前的修改。');}
  });
  $('cm-reset').onclick=()=>{if(confirm('清除此瀏覽器內這份班級作業的試改記錄？')&&update(d=>{const rev=d.revision;Object.assign(d,fresh(),{revision:rev});})){groupKey='';groupQuestion=0;basis='answer';requestedIssue=null;jump('ink');tell('已重新開始這份作業。');}};
  window.addEventListener('hashchange',()=>{render();tell('');});
  window.addEventListener('storage',event=>{if(event.key===key)tell('這份作業已在另一分頁更新。請重新載入以繼續。');});
  render();
})();
