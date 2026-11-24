(async (fetch)=>{
  'use strict';
  const $=id=>document.getElementById(id),work=$('work'),status=$('status'),selector=$('room'),params=new URLSearchParams(location.search);
  const base='/api/eduflow/ai/studio/',activityUrl=base+'activities';
  const uuid=()=>crypto.randomUUID().replaceAll('-',''),encode=encodeURIComponent;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const append=(tag,cls,...kids)=>{const n=el(tag,undefined,cls);n.append(...kids);return n;};
  const panel=(...kids)=>append('section','panel',...kids),actions=(...kids)=>append('div','actions',...kids);
  const heading=(title,button)=>append('div','block-head',el('h2',title),button);
  const label=(text,input)=>append('label','',document.createTextNode(text),input);
  const field=(value='',max=100,multi=false)=>{const n=el(multi?'textarea':'input');n.maxLength=max;n.value=value;n.autocomplete='off';return n;};
  const button=(text,handler,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=handler;return b;};
  const note=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
  let session,room=params.get('class')||'',area=location.hash==='#tutors'?'tutors':'activities',busy=false,dirty=false,library,rooms=[];
  function busyState(value){busy=value;work.inert=value;$('tabs').inert=value;selector.disabled=value||!rooms.length;}
  async function run(fn){
    if(busy)return;busyState(true);note('');
    try{await fn();}catch(error){note(error.message||'讀取失敗，請重試。',true);}
    finally{busyState(false);}
  }
  const act=fn=>()=>run(fn);
  async function api(url,options={}){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data)throw Error(data?.error||'未能讀取資料，請重新登入後重試。');
    return data;
  }
  const post=(url,body)=>api(url,{method:'POST',headers:{'Content-Type':'application/json','X-Eduflow-CSRF':session.csrf_token},
    body:JSON.stringify({account_id:session.account_id,...body})});
  const classSuffix=()=>room?'?classId='+encode(room):'';
  const tutorsUrl=()=>base+'tutors'+classSuffix();
  const classLabel=id=>rooms.find(r=>r.id===id)?.name||'班級';
  function tabs(){
    for(const b of $('tabs').querySelectorAll('button')){if(b.dataset.area===area)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    const url=new URL(location.href);if(room)url.searchParams.set('class',room);url.hash=area;history.replaceState(null,'',url);
    $('back').href='schools.html';
  }
  function canLeave(){return !dirty||confirm('尚有未儲存的更改。捨棄這次修改？');}
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  function listenDirty(container){
    container.addEventListener('input',()=>{dirty=true;});
    container.addEventListener('change',()=>{dirty=true;});
  }
  const back=()=>button('返回清單',()=>{if(canLeave())run(dashboard);},'quiet');
  function empty(txt){return el('p',txt,'empty');}
  function row(name,hint,...options){return append('div','line',append('div','',el('strong',name),el('p',hint,'muted')),actions(...options));}
  async function dashboard(){
    const data=area==='activities'?await api(activityUrl):await api(tutorsUrl());
    const items=area==='activities'?data.items:data.tutors,box=panel();
    if(area==='activities'){
      box.append(heading('我的互動活動',button('建立活動',()=>activityEditor(), 'primary')));
      if(!items.length)box.append(empty('建立第一個配對練習或方程天平，試玩後即可派給班級。'));
      for(const item of items)box.append(row(item.title,(item.kind==='match'?'配對練習':'方程天平')+' · 第 '+item.revision+' 版',
        button('編輯與派發',act(async()=>activityEditor(await api(activityUrl+'?item='+encode(item.id)))))));
    }else{
      library=items;
      box.append(heading('我的課堂導師',button('建立導師',()=>tutorEditor(), 'primary')));
      if(!items.length)box.append(empty('設定導師的引導方式，加上教材，再試問學生可能遇到的問題。'));
      for(const t of items)box.append(row(t.title,'草稿第 '+t.revision+' 版'+(t.pinnedRevision?' · 本班使用第 '+t.pinnedRevision+' 版':''),
        button('編輯與試問',()=>tutorEditor(t))));
    }
    dirty=false;work.replaceChildren(box);tabs();
  }
  const activityDefaults=()=>({kind:'match',title:'',instructions:'',pairs:[{left:'',right:''},{left:'',right:''}],a:2,b:3,min:-5,max:5,target:9});
  function activityError(d){
    if(!d.title.trim()||!d.instructions.trim())return '請先填寫活動名稱和學生指引。';
    if(d.kind==='match'){
      if(d.pairs.length<2||d.pairs.length>8||d.pairs.some(p=>!p.left.trim()||!p.right.trim()))return '請填妥 2 至 8 組配對。';
      if(['left','right'].some(k=>new Set(d.pairs.map(p=>p[k].trim())).size!==d.pairs.length))return '左右兩欄各自需要不同的選項。';
    }else{
      if(![d.a,d.b,d.min,d.max,d.target].every(Number.isInteger)||!d.a||Math.abs(d.a)>20||Math.abs(d.b)>100||d.min< -100||d.max>100||d.min>=d.max||Math.abs(d.target)>2100)return '請檢查整數範圍和係數；x 的系數不能為零。';
      const x=(d.target-d.b)/d.a;if(!Number.isInteger(x)||x<d.min||x>d.max)return '請讓學生能在所選範圍內找到整數解。';
    }
    return '';
  }
  function activityEditor(item=null){
    let draftId=item?.id||uuid(),rev=item?.revision||0,pins=item?.pins||[],d={...activityDefaults(),...item?.data};
    let pinRequest=uuid();const kind=el('select');
    kind.add(new Option('配對練習','match'));kind.add(new Option('方程天平','balance'));kind.value=d.kind;
    const name=field(d.title,100),instructions=field(d.instructions,600,true);
    const config=el('div'),brief=field('',1200,true),ai=el('details'),side=panel(),preview=el('div'),editor=panel();
    const save=button('儲存活動',act(saveDraft),'primary'),tryout=button('試玩目前草稿',()=>{try{showPreview(data());note('');}catch(e){note(e.message,true);}});
    function setConfig(){
      config.replaceChildren();
      if(kind.value==='match'){
        const list=el('ol',undefined,'pairs');config.append(el('h3','配對內容'),list);
        const pairRow=(pair)=>{
          const li=el('li',undefined,'pair'),left=field(pair.left,160),right=field(pair.right,160);
          const remove=button('移除',()=>{if(list.children.length<=2){note('最少需要兩組配對。',true);return;}li.remove();renumber();dirty=true;},'quiet');
          li.append(label('左項',left),label('右項',right),remove);list.append(li);
        };
        const renumber=()=>Array.from(list.children).forEach((li,i)=>{const inputs=li.querySelectorAll('input');inputs[0].setAttribute('aria-label','第 '+(i+1)+' 組左項');inputs[1].setAttribute('aria-label','第 '+(i+1)+' 組右項');});
        for(const p of d.pairs)pairRow(p);renumber();
        config.append(button('增加一組',()=>{if(list.children.length>=8){note('最多八組。',true);return;}pairRow({left:'',right:''});renumber();dirty=true;}));
      }else{
        config.append(el('h3','調整方程 ax + b = 目標值'),el('p','選定 x 可調整的範圍。學生拖動滑桿，比較等式兩邊的數值。','muted'));
        const box=el('div',undefined,'numbers');
        for(const [k,text,min,max] of [['a','係數 a',-20,20],['b','常數 b',-100,100],['min','x 最小值',-100,100],['max','x 最大值',-100,100],['target','目標值',-2100,2100]]){
          const n=el('input');n.type='number';n.step='1';n.min=min;n.max=max;n.value=d[k];n.dataset.param=k;box.append(label(text,n));
        }config.append(box);
      }
    }
    function capture(){
      if(config.querySelector('.pairs'))d.pairs=Array.from(config.querySelectorAll('li'),li=>{const [a,b]=li.querySelectorAll('input');return {left:a.value,right:b.value};});
      else for(const input of config.querySelectorAll('[data-param]'))d[input.dataset.param]=input.valueAsNumber;
    }
    function data(){
      capture();const out={kind:kind.value,title:name.value.trim(),instructions:instructions.value.trim()};
      if(out.kind==='match')out.pairs=d.pairs;else for(const k of ['a','b','min','max','target'])out[k]=d[k];
      const error=activityError(out);if(error)throw Error(error);return out;
    }
    function showPreview(value){
      const view=EduStudioPlayer.matchPreview(value),holder=el('div');
      preview.replaceChildren(el('h3',view.title),el('p','教師試玩，成績不會計入班級。','muted'),holder);
      EduStudioPlayer.mount(holder,view,null,async answers=>EduStudioPlayer.scorePreview(value,view,answers));
    }
    async function saveDraft(){
      const r=await post(activityUrl,{action:'save',id:draftId,revision:rev,data:data()});
      rev=r.revision;dirty=false;pinRequest=uuid();await refreshPins();note('活動已儲存為第 '+rev+' 版。');
    }
    async function refreshPins(){const latest=await api(activityUrl+'?item='+encode(draftId));pins=latest.pins;drawSide();}
    function drawSide(){
      side.replaceChildren(el('h2','班級派發'));
      const active=pins.find(p=>p.active&&p.room===room);
      side.append(el('p',room?classLabel(room)+' · '+(active?'學生使用第 '+active.revision+' 版':'尚未派發'):'先建立班級，便可派發已儲存的活動。','note'));
      if(room&&rev&&active?.revision!==rev){
        const pin=button(active?'派發新版本':'派給本班',act(async()=>{
          if(dirty)throw Error('請先儲存修改，再派發此版本。');
          await post(activityUrl,{action:'pin',id:draftId,revision:rev,room,requestId:pinRequest});
          pinRequest=uuid();await refreshPins();note('已派給'+classLabel(room)+'，學生可從固定入口開啟。');
        }),'primary');side.append(pin);
      }
      if(active)side.append(button('從本班撤下',act(async()=>{
        await post(activityUrl,{action:'unpin',pin:active.id});pinRequest=uuid();await refreshPins();note('已從本班撤下，已交記錄仍可查閱。');
      }),'quiet'));
      for(const pin of pins){
        const result=el('div'),b=button(classLabel(pin.room)+' · 第 '+pin.revision+' 版'+(pin.active?'':'（已撤下）'),act(async()=>{
          const report=await api(activityUrl+'?pin='+encode(pin.id)),table=el('table');
          const tr=el('tr');for(const col of ['學生','完成情況'])tr.append(el('th',col));
          const head=el('thead');head.append(tr);table.append(head);const body=el('tbody');
          for(const s of report.students){body.append(append('tr','',el('td',s.label),el('td',s.submitted?s.score+' / '+s.max+' 分':'未提交')));}
          table.append(body);result.replaceChildren(table);note('已讀取完成情況。');
        }));if(pin===pins[0])side.append(el('h3','各班完成情況','space'));side.append(b,result);
      }
    }
    kind.onchange=()=>{capture();setConfig();preview.replaceChildren();dirty=true;};
    setConfig();drawSide();
    async function generateDraft(){
      if(!brief.value.trim())throw Error('請描述教學目標和活動內容。');
      note('正在擬定活動…');const res=await post(activityUrl,{action:'generate',kind:kind.value,brief:brief.value.trim()});
      d={...activityDefaults(),...res.data};kind.value=d.kind;name.value=d.title;instructions.value=d.instructions;setConfig();dirty=true;showPreview(res.data);note('草稿已就緒。請試玩並核對內容，再儲存。');
    }
    const generate=button('按描述產生草稿',act(async()=>{
      capture();
      const defaults=activityDefaults(),hasContent=name.value.trim()||instructions.value.trim()||(kind.value==='match'
        ?d.pairs.some(pair=>pair.left.trim()||pair.right.trim())
        :['a','b','min','max','target'].some(key=>d[key]!==defaults[key]));
      if(!hasContent||!dirty){await generateDraft();return;}
      if(ai.querySelector('.replace-draft'))return;
      const message=el('div',undefined,'replace-draft'),change=button('取代未儲存內容',act(async()=>{message.remove();await generateDraft();}));
      message.append(el('p','產生新草稿會取代目前未儲存的活動內容。'),actions(change,button('保留目前內容',()=>message.remove())));
      ai.append(message);change.focus();
    }));
    ai.append(el('summary','從描述建立示例草稿'),el('p','可試「百分比配對」、輸入至少兩行「詞語 → 解釋」，或在方程天平輸入「2x + 3 = 13」。','muted'),label('活動描述',brief),generate);
    editor.append(heading(item?'編輯活動':'建立活動',back()),label('活動種類',kind),ai,label('活動名稱',name),label('學生指引',instructions),config,actions(save,tryout));
    const previewBox=panel(el('h2','學生試玩畫面'),preview);preview.append(empty('填好內容後，按「試玩目前草稿」。'));
    listenDirty(config);[name,instructions].forEach(n=>n.oninput=()=>{dirty=true;});
    const left=el('div');left.append(editor,previewBox);work.replaceChildren(append('div','split',left,side));dirty=false;
  }
  function tutorEditor(item=null){
    let id=item?.id||uuid(),rev=item?.revision||0,pinned=item?.pinnedRevision??null,
      usage=item?.usage||{students:0,turns:0},source=item?.sourceName||'';
    const name=field(item?.title||'',80),rules=field(item?.rules||'',2000,true),material=field(item?.material||'',12000,true);
    name.placeholder='例如：中一方程解題導師';rules.placeholder='例如：先請學生列式。每次只提示一步，並請學生說明原因。';
    material.rows=7;const file=el('input');file.type='file';file.accept='.docx,.txt';
    const fileName=el('p',source?'教材來源　'+source:'','muted');
    const editor=panel(),aside=panel(),preview=panel(),question=field('',600,true),reply=el('p','','pre');
    let questionId=uuid();question.oninput=()=>{questionId=uuid();};
    const save=button('儲存導師',act(async()=>{
      if(!name.value.trim()||!rules.value.trim())throw Error('請填寫導師名稱及引導規則。');
      const res=await post(tutorsUrl(),{action:'save',id,revision:rev,title:name.value.trim(),rules:rules.value.trim(),
        material:material.value.trim(),sourceName:source});
      rev=res.tutor.revision;pinned=res.tutor.pinnedRevision??null;usage=res.tutor.usage||usage;dirty=false;questionId=uuid();drawAside();
      note('導師已儲存為第 '+rev+' 版。');
    }),'primary');
    const importFile=button('讀取文件內容',act(async()=>{
      const f=file.files[0];if(!f)throw Error('請先選擇要讀取的檔案。');
      if(!/\.(docx|txt)$/i.test(f.name)||f.size>12*1024*1024)throw Error('請選擇 12 MB 以內的 DOCX 或 TXT 檔。');
      if(material.value.trim()&&!confirm('以文件擷取的文字取代目前的教材內容？'))return;
      const form=new FormData();form.set('file',f);form.set('account_id',session.account_id);
      const r=await api(base+'tutors/import'+classSuffix(),{method:'POST',headers:{'X-Eduflow-CSRF':session.csrf_token},body:form});
      source=r.sourceName||f.name;material.value=r.material;fileName.textContent='教材來源　'+source;dirty=true;
      note(r.truncated?'文件較長，已擷取部分內容。請檢查是否涵蓋教學重點。':'文件文字已載入。請核對後儲存導師。');
    }));
    const sourceTools=el('details');sourceTools.append(el('summary','從文件帶入教材'),label('示例用 DOCX 或 TXT，最多 12 MB',file),importFile);
    editor.append(heading(item?'編輯導師':'建立導師',back()),label('導師名稱',name),label('導師的引導規則',rules),sourceTools,
      label('給導師參考的教材文字',material),fileName,actions(save));[name,rules,material].forEach(n=>n.oninput=()=>{dirty=true;});
    const ask=button('試問導師',act(async()=>{
      if(!rev||dirty)throw Error('請先儲存目前的導師設定。');
      if(!question.value.trim())throw Error('請輸入一個想試問的問題。');
      reply.textContent='';note('導師正在回應…');
      const r=await post(tutorsUrl(),{action:'preview',id,revision:rev,message:question.value.trim(),requestId:questionId});
      reply.textContent=r.reply;note('試問完成。這次試問不會計入學生使用記錄。');
    }));
    preview.append(el('h2','試問導師'),el('p','用一個學生會問的問題，檢查導師怎樣運用教材和引導規則。','muted'),label('試問內容（請用教材內的詞語）',question),ask,reply);
    async function pin(action){
      if(!room||!rev||dirty)throw Error('請先選擇班級並儲存設定。');
      await post(tutorsUrl(),{action,id,revision:rev,pinnedRevision:pinned});
      const list=await api(tutorsUrl()),now=list.tutors.find(t=>t.id===id);if(!now)throw Error('導師資料已改動，請重新載入。');
      pinned=now.pinnedRevision??null;usage=now.usage;drawAside();note(action==='pin'?'導師已加入本班。':'已從本班撤下導師。');
    }
    function drawAside(){
      aside.replaceChildren(el('h2','班級使用'));
      aside.append(el('p',room?classLabel(room)+' · '+(pinned?'學生使用第 '+pinned+' 版':'尚未加入'):'建立班級後可加入這位導師。','note'));
      if(room&&rev&&pinned!==rev)aside.append(button(pinned?'讓本班使用新版本':'加入本班',act(()=>pin('pin')),'primary'));
      if(pinned)aside.append(button('從本班撤下',act(()=>pin('unpin')),'quiet'));
      if(room&&rev)aside.append(el('h3','本班使用情況','space'),el('p',(usage?.students||0)+' 位學生 · '+(usage?.turns||0)+' 次問答'));
    }
    drawAside();const left=el('div');left.append(editor,preview);work.replaceChildren(append('div','split',left,aside));dirty=false;
  }
  $('tabs').onclick=e=>{
    const next=e.target.closest('[data-area]')?.dataset.area;
    if(!next||!canLeave())return;
    run(async()=>{const previous=area;area=next;try{await dashboard();}catch(err){area=previous;throw err;}});
  };
  selector.onchange=()=>{
    const next=selector.value,previous=room;if(!canLeave()){selector.value=room;return;}
    run(async()=>{room=next;try{await dashboard();}catch(err){selector.value=room=previous;throw err;}});
  };
  await run(async()=>{
    session=await api('/api/eduflow/ai/session');
    const d=await api(activityUrl);rooms=d.rooms;
    selector.replaceChildren();rooms.forEach(r=>selector.add(new Option(r.name,r.id)));
    if(room&&!rooms.some(r=>r.id===room))throw Error('找不到此班級，請返回班級清單。');
    if(!room)room=rooms[0]?.id||'';
    if(!rooms.length)selector.add(new Option('尚未建立班級',''));
    selector.value=room;await dashboard();
  });
})(window.EduStudioDemo.request);
