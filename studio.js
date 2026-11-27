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
  const entry=location.hash.slice(1).split('/');
  const editorAreas=['app','lesson','investigation'];
  let session,room=params.get('class')||'',area=[...editorAreas,'tutors'].includes(entry[0])?entry[0]:'activities',busy=false,dirty=false,library,rooms=[];
  let appId=editorAreas.includes(entry[0])?entry[1]||'new':'new',activeApp=null;
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
    if(!response.ok||!data){const error=Error(data?.error||'未能讀取資料，請重新登入後重試。');error.status=response.status;throw error;}
    return data;
  }
  const post=(url,body)=>api(url,{method:'POST',headers:{'Content-Type':'application/json','X-Eduflow-CSRF':session.csrf_token},
    body:JSON.stringify({account_id:session.account_id,...body})});
  const classSuffix=()=>room?'?classId='+encode(room):'';
  const tutorsUrl=()=>base+'tutors'+classSuffix();
  const classLabel=id=>rooms.find(r=>r.id===id)?.name||'班級';
  function tabs(){
    for(const b of $('tabs').querySelectorAll('button')){if(b.dataset.area===area)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    const url=new URL(location.href);if(room)url.searchParams.set('class',room);url.hash=editorAreas.includes(area)&&appId!=='new'?area+'/'+appId:area;history.replaceState(null,'',url);
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
    if(area==='investigation'){await openInvestigation(appId);return;}
    if(area==='lesson'){await openLesson(appId);return;}
    if(area==='app'){
      const item=appId==='new'?null:await api(activityUrl+'?item='+encode(appId));
      if(item&&item.data.kind!=='app')throw Error('請在互動活動清單開啟這項活動。');
      await appEditor(item);return;
    }
    const data=area==='activities'?await api(activityUrl):await api(tutorsUrl());
    const items=area==='activities'?data.items:data.tutors,box=panel();
    if(area==='activities'){
      box.append(heading('我的互動活動',actions(button('按描述製作應用',act(()=>openApp('new')),'primary'),button('建立活動',()=>activityEditor()))));
      if(!items.length)box.append(empty('在這裏重開已儲存的應用，或建立配對練習和方程天平。'));
      const kinds={priceInvestigation:'數學探究課',percentLesson:'講義互動課',app:'互動應用',match:'配對練習',balance:'方程天平'};
      for(const item of items)box.append(row(item.title,kinds[item.kind]+' · 第 '+item.revision+' 版',
        button('編輯與派發',act(async()=>item.kind==='priceInvestigation'?openInvestigation(item.id):item.kind==='percentLesson'?openLesson(item.id):item.kind==='app'?openApp(item.id):activityEditor(await api(activityUrl+'?item='+encode(item.id)))))));
    }else{
      library=items;
      box.append(heading('我的課堂導師',button('建立導師',()=>tutorEditor(), 'primary')));
      if(!items.length)box.append(empty('設定導師的引導方式，加上教材，再試問學生可能遇到的問題。'));
      for(const t of items)box.append(row(t.title,'草稿第 '+t.revision+' 版'+(t.pinnedRevision?' · 本班使用第 '+t.pinnedRevision+' 版':''),
        button('編輯與試問',()=>tutorEditor(t))));
    }
    activeApp=null;dirty=false;work.replaceChildren(box);tabs();
  }
  async function openInvestigation(key){
    const item=key==='new'?null:await api(activityUrl+'?item='+encode(key));
    if(item&&item.data.kind!=='priceInvestigation')throw Error('請從活動清單重開這節探究課。');
    const id=item?.id||uuid(),spec=item?.data||EduInvestigation.create();
    let revision=item?.revision||0,player;
    area='investigation';appId=key;activeApp=null;dirty=false;tabs();
    const box=panel(el('p','中二數學 · 百分法與方程','muted'),el('h2',spec.title),
      el('p','兩家印刷廠爭取校刊訂單。一家有起版費，一家折扣較大。學生要找出甚麼印量值得轉廠，並向編委會提出有數據支持的建議。'));
    const budget=el('select'),choices=[...new Set([1050,1400,1480,2000,spec.budget])].sort((a,b)=>a-b);
    for(const n of choices)budget.add(new Option('HK$'+n.toLocaleString('en-HK'),String(n)));
    budget.value=String(spec.budget);
    const delivery=classDelivery(id,item?.pins||[],()=>revision,()=>false);
    const preview=el('details'),canvas=el('div');preview.className='panel investigation-preview';
    preview.append(el('summary','試做學生任務'),canvas);
    const mount=()=>{player?.destroy();player=EduInvestigationUI.mount(canvas,{data:spec});};
    preview.ontoggle=()=>{if(preview.open&&!player)mount();};
    const feedback=el('p',revision?'第 '+revision+' 版已儲存。':'選好本次預算後即可儲存及派發。','muted');
    const save=button('儲存這節探究課',act(persist),'primary');
    async function persist(){
      const next={...spec,budget:Number(budget.value)};
      try{
        const res=await post(activityUrl,{action:'save',id,revision,data:next});
        revision=res.revision;Object.assign(spec,next);appId=id;tabs();save.hidden=true;
        feedback.textContent='第 '+revision+' 版已儲存。';delivery.redraw();
        if(preview.open)mount();else{player?.destroy();player=null;}
      }catch(e){budget.value=String(spec.budget);throw e;}
    }
    save.hidden=Boolean(revision);budget.onchange=act(persist);
    const answers=el('details'),solution=el('p');
    const solutionText=()=>{const v=EduInvestigation.inspection(spec);
      solution.textContent='甲廠總價 8x + 120，乙廠 9x。印 '+v.cross+' 本時同價。按目前預算，甲廠最多可印 '+v.maxA+' 本，乙廠 '+v.maxB+' 本。閱讀學生反例時，可追問起版費如何影響小額訂單。';};
    answers.append(el('summary','教師備課參考'),solution);answers.ontoggle=solutionText;
    budget.addEventListener('change',()=>{answers.open=false;});
    box.append(label('校刊印刷預算（更改後自動儲存）',budget),feedback,save,answers);
    work.replaceChildren(append('div','split',box,delivery.side),preview);
    activeApp={flush:async()=>{},roomChange:()=>delivery.redraw()};
  }
  async function openLesson(id){
    const item=id==='new'?null:await api(activityUrl+'?item='+encode(id));
    if(item&&item.data.kind!=='percentLesson')throw Error('請在互動活動清單開啟這項活動。');
    const next=await EduPercentLessonEditor.open({item,api,post,url:activityUrl,host:work,run,
      setDirty:value=>{dirty=value;},selectKey:key=>{appId=key;tabs();},deliveryFor:classDelivery,
      importFile:f=>{
        const form=new FormData();form.set('file',f);form.set('account_id',session.account_id);
        return api(base+'tutors/import'+classSuffix(),{method:'POST',headers:{'X-Eduflow-CSRF':session.csrf_token},body:form});
      }});
    area='lesson';appId=id;activeApp=next;dirty=false;tabs();
  }
  async function openApp(id){
    const item=id==='new'?null:await api(activityUrl+'?item='+encode(id));
    await appEditor(item);
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
  function classDelivery(id,initialPins,version,hasEdits){
    const side=panel();let pins=initialPins,pinRequest=uuid(),pinScope='';
    async function refreshPins(){const latest=await api(activityUrl+'?item='+encode(id));pins=latest.pins;drawSide();}
    function drawSide(){
      const rev=version(),scope=room+'/'+rev;
      if(scope!==pinScope){pinRequest=uuid();pinScope=scope;}
      side.replaceChildren(el('h2','班級派發'));
      const active=pins.find(p=>p.active&&p.room===room);
      side.append(el('p',room?classLabel(room)+' · '+(active?'學生使用第 '+active.revision+' 版':'尚未派發'):'先建立班級，便可派發已儲存的活動。','note'));
      if(room&&rev&&active?.revision!==rev){
        const pin=button(active?'派發新版本':'派給本班',act(async()=>{
          if(hasEdits())throw Error('請先儲存修改，再派發此版本。');
          await post(activityUrl,{action:'pin',id,revision:rev,room,requestId:pinRequest});
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
          const submission=el('section',undefined,'submission-preview');
          for(const student of report.students){
            const text=!student.submitted?'未提交':student.max===0?'已提交探索紀錄':student.score+' / '+student.max+' 分';
            const cell=el('td',text);
            const history=Array.isArray(student.hints)?student.hints:[];
            if(history.length)cell.append(' · 已用 '+history.length+' 個提示');
            const inquiry=report.data?.kind==='priceInvestigation';
            if(inquiry&&student.submitted)cell.append(student.review?' · 已回覆建議':' · 建議待覆核');
            const hasCanvas=student.submitted&&student.answers&&['app','percentLesson','priceInvestigation'].includes(report.data?.kind);
            if(hasCanvas||history.length){
              cell.append(button(hasCanvas?'查看紀錄':'查看提示',()=>{
                submission.replaceChildren(el('h3',student.label+(hasCanvas?'的提交紀錄':'的提示紀錄')));
                if(hasCanvas){
                  const holder=el('div');submission.append(holder);
                  if(inquiry){
                    EduInvestigationUI.mount(holder,{data:report.data,answers:student.answers,readonly:true});
                    const comment=field(student.review?.comment||'',600,true),resp=el('p');
                    comment.rows=3;resp.setAttribute('role','status');
                    submission.append(label('給學生的回饋',comment),button('回覆採購建議',act(async()=>{
                      const result=await post(activityUrl,{action:'review',pin:pin.id,student:student.id,comment:comment.value,revision:student.review?.revision||0});
                      student.review=result.review;resp.textContent='已回覆，學生重開這份作答便可查看。';
                      cell.firstChild.textContent=student.score+' / '+student.max+' 分';
                      if(cell.childNodes[1]?.nodeType===Node.TEXT_NODE)cell.childNodes[1].textContent=' · 已回覆建議';
                    })),resp);
                  }else if(report.data.kind==='percentLesson')EduPercentLesson.mount(holder,EduPercentLesson.project(report.data),{answers:student.answers,readonly:true});
                  else EduStudioApp.mount(holder,report.data,student.answers,()=>{},true);
                }
                if(history.length){
                  if(hasCanvas)submission.append(el('h4','操作提示'));
                  submission.append(EduStudioPlayer.hintHistory(history));
                }
                submission.querySelector('h3').tabIndex=-1;
                submission.querySelector('h3').focus();
              },'quiet'));
            }
            body.append(append('tr','',el('td',student.label),cell));
          }
          table.append(body);result.replaceChildren(table,submission);note('已讀取完成情況。');
        }));if(pin===pins[0])side.append(el('h3','各班完成情況','space'));side.append(b,result);
      }
    }
    drawSide();
    return {side,refresh:refreshPins,redraw:drawSide};
  }
  function activityEditor(item=null){
    let draftId=item?.id||uuid(),rev=item?.revision||0,pins=item?.pins||[],d={...activityDefaults(),...item?.data};
    const delivery=classDelivery(draftId,pins,()=>rev,()=>dirty),kind=el('select');
    kind.add(new Option('配對練習','match'));kind.add(new Option('方程天平','balance'));kind.value=d.kind;
    const name=field(d.title,100),instructions=field(d.instructions,600,true);
    const config=el('div'),brief=field('',1200,true),ai=el('details'),side=delivery.side,preview=el('div'),editor=panel();
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
      rev=r.revision;dirty=false;await delivery.refresh();note('活動已儲存為第 '+rev+' 版。');
    }
    kind.onchange=()=>{capture();setConfig();preview.replaceChildren();dirty=true;};
    setConfig();
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
  async function appEditor(item){
    const engine=window.EduStudioApp;
    if(!engine)throw Error('應用編輯器未能載入，請重新整理頁面。');
    const id=item?.id||uuid();
    let key=item?.id||'new',rev=item?.revision||0,publishedDraft=item?.data||null;
    const loadWork=()=>api(activityUrl+'?work='+encode(key));
    const {draft:working}=await loadWork();
    let spec=working.base||publishedDraft,workRevision=working.revision;
    let paused=Boolean((working.base||working.brief)&&working.sourceRevision!==rev);
    let flight=null,timer=0,generating=false;
    const undo=[];
    const editor=panel(),preview=panel(),examples=panel(),frame=el('div',undefined,'app-builder');
    const brief=field(working.brief,1200,true),canvas=el('div'),title=el('h2');
    const info=el('p','','app-work-status'),recovery=actions();
    info.setAttribute('role','status');info.setAttribute('aria-live','polite');
    const holder=el('div',undefined,'app-canvas-body');
    const signature=o=>JSON.stringify(o);
    const changed=()=>signature(spec)!==signature(publishedDraft);
    const delivery=classDelivery(id,item?.pins||[],()=>rev,()=>changed());
    const snapshot=()=>({brief:brief.value,base:changed()?spec:null});
    let stored=signature({brief:working.brief,base:working.base});
    const workState=(message,error=false)=>{info.textContent=message;info.classList.toggle('error',error);};
    const workData=body=>post(activityUrl,{action:'work',id:key,revision:workRevision,sourceRevision:rev,...body});

    function redrawControls(){
      generate.textContent=spec?'套用修改':'產生應用';
      generate.disabled=paused||generating;revert.hidden=!undo.length;revert.disabled=paused||generating;
      restart.hidden=key!=='new'||!spec;restart.disabled=paused||generating;
      save.hidden=!spec;save.disabled=paused||generating||!changed();
      promptLabel.firstChild.textContent=spec?'想怎樣修改這個應用？':'想讓學生操作甚麼？';
      brief.placeholder=spec?'例如：加上面積和周長':'例如：拖動三角形的三個頂點，顯示三個內角和內角和。';
    }
    function render(){
      redrawControls();const left=el('div',undefined,'app-builder-tools');
      left.append(editor);frame.replaceChildren(left);
      if(!spec){frame.append(examples);return;}
      title.textContent=spec.title;holder.replaceChildren(el('p',spec.instructions),canvas);
      engine.mount(canvas,spec,engine.initial(spec),()=>{});
      frame.append(preview);
      left.append(delivery.side);delivery.redraw();
    }
    function refreshRecovery(){
      recovery.replaceChildren();recovery.hidden=!paused;
      if(!paused)return;
      const reload=button('讀取最新草稿',act(async()=>{
        if(!confirm('以活動庫及最新工作草稿取代畫面上的內容？'))return;
        await openApp(key);
      }));
      recovery.append(reload);
    }
    async function flush(){
      clearTimeout(timer);
      if(paused)throw Error('請先處理工作草稿的版本。');
      if(flight)return flight;
      flight=(async()=>{
        while(signature(snapshot())!==stored){
          const current=snapshot();
          try{
            const result=await workData(current);
            workRevision=result.draft.revision;stored=signature(current);
          }catch(error){
            if(error.status===409){paused=true;refreshRecovery();redrawControls();}
            workState(error.message,true);dirty=true;throw error;
          }
        }
        dirty=false;
      })();
      try{await flight;}finally{flight=null;}
    }
    function schedule(){
      dirty=true;clearTimeout(timer);workState('正在保存工作草稿…');
      timer=setTimeout(()=>flush().then(()=>{
        if(work.contains(editor))workState(workSavedLabel());
      }).catch(()=>{}),400);
    }
    function workSavedLabel(){
      return window.EduStudioDemo?'工作草稿已保存在這個瀏覽器。':'工作草稿已保存在教師帳戶。';
    }
    async function generateApp(){
      const submittedText=brief.value,request=submittedText.trim();
      if(!request){brief.focus();throw Error(spec?'請輸入要修改的部分。':'請描述學生要操作的內容，或選擇一個例子。');}
      generating=true;redrawControls();work.inert=false;
      examples.inert=true;delivery.side.inert=true;preview.inert=true;
      try{
        await flush();workState(spec?'正在修改應用…':'正在建立應用…');
        const res=await post(activityUrl,{action:'generate',kind:'app',brief:request,...(spec?{base:spec}:{})});
        const next=engine.validate(res.data),editing=brief===document.activeElement;
        const caret=editing?[brief.selectionStart,brief.selectionEnd]:null;
        undo.push({spec,brief:request});if(undo.length>8)undo.shift();
        spec=next;if(brief.value===submittedText)brief.value='';
        dirty=true;render();
        if(editing){brief.focus({preventScroll:true});brief.setSelectionRange(...caret);}
        await flush();workState(workSavedLabel());
        if(!editing&&matchMedia('(max-width: 49rem)').matches)preview.scrollIntoView({block:'start'});
      }catch(error){workState(error.message,true);throw error;}
      finally{
        generating=false;examples.inert=false;delivery.side.inert=false;preview.inert=false;redrawControls();
      }
    }
    async function saveApp(){
      if(!spec)throw Error('請先產生並試玩應用。');
      await flush();
      const newWorkRevision=workRevision;
      const r=await post(activityUrl,{action:'save',id,revision:rev,data:spec});
      rev=r.revision;publishedDraft=spec;undo.length=0;
      // Transfer a new working document to its permanent library address.
      const previousKey=key;
      if(previousKey==='new'){
        key=id;appId=id;tabs();
        workRevision=0;stored=signature({brief:'',base:null});
      }
      try{
        await flush();
        if(previousKey==='new'){
          try{await post(activityUrl,{action:'work',id:'new',revision:newWorkRevision,sourceRevision:0,brief:'',base:null});}
          catch(error){if(error.status!==409)throw error;}
        }
        workState('第 '+rev+' 版已存入互動活動，可派給本班。');
      }finally{redrawControls();await delivery.refresh();}
    }
    const generate=button('產生應用',act(generateApp),'primary');
    const revert=button('復原上次修改',act(async()=>{
      await flush();const previous=undo.pop();if(!previous)return;
      spec=previous.spec;brief.value=previous.brief;dirty=true;render();await flush();workState(workSavedLabel());
    }),'quiet');
    const restart=button('重新開始',act(async()=>{
      if(!confirm('清空目前的工作草稿，重新製作應用？'))return;
      await flush();undo.push({spec,brief:brief.value});
      spec=null;brief.value='';dirty=true;render();await flush();workState('可輸入新的描述或選擇例子。');
    }),'quiet');
    const save=button('儲存應用',act(saveApp));
    const promptLabel=label('想讓學生操作甚麼？',brief);
    brief.rows=4;brief.oninput=schedule;
    const tips=el('details'),hintText=window.EduStudioDemo
      ?'展示版以本機規則製作幾何、計算和分支故事。可試「加上面積和周長」、「把目標改為 48」、「將名稱改為『我的實驗』」或「加一個捐贈結局」。'
      :'可組合可拖動的圖形、滑桿、計算結果、數值挑戰或分支故事。修改時可指定希望保留的部分。';
    tips.append(el('summary','可用的操作和修改例子'),el('p',hintText,'muted'));
    if(window.EduStudioDemo){
      const formats=[
        ['自訂計算','名稱：車費估算\n滑桿 距離(d) 1 至 30\n結果 車費 = 27 + d * 2'],
        ['自訂故事','名稱：校園尋寶\n場景 start：圖書館門旁有一張謎語卡，你想去哪裏找線索？\n選項 打開圖鑑 → library\n選項 請教園丁 → garden\n場景 library：你從書中的葉形找到了校園的大樹。\n場景 garden：園丁帶你發現了花圃中的寶盒。']
      ];
      for(const [name,template] of formats){
        const fill=button('填入'+name+'格式',()=>{
          if(brief.value.trim()&&!confirm('以格式例子取代輸入框的內容？'))return;
          brief.value=template;schedule();brief.focus();
        },'quiet');
        tips.append(el('pre',template,'formula-example'),fill);
      }
    }
    const h=el('h2','製作互動應用');
    editor.append(h,promptLabel,actions(generate,revert,restart),tips,info,recovery);
    if(window.EduStudioDemo)editor.append(el('p','展示站使用本機規則；學校版使用已配置的 AI 模型。','muted mode-note'));
    const previewHead=append('div','block-head',title,save);
    preview.append(previewHead,holder);
    examples.append(el('h2','選一個例子開始'));
    for(const [name,description] of [
      ['三角形內角','拖動三角形的三個頂點，顯示三個內角和內角和。'],
      ['折扣計算器','製作折扣計算器，調整原價和折扣百分比。'],
      ['長方形面積挑戰','製作長方形面積挑戰，拖動長和闊令面積等於 36。'],
      ['班際義賣分支故事','班際義賣，學生選擇如何處理剩餘食物的分支遊戲。']
    ]){
      const choose=button(name,()=>{brief.value=description;schedule();brief.focus();},'app-example');
      examples.append(choose);
    }
    area='app';appId=key;render();refreshRecovery();tabs();work.replaceChildren(frame);dirty=false;
    activeApp={flush,roomChange:()=>{tabs();delivery.redraw();}};
    if(paused){
      workState('活動庫已有較新版本。可查看目前草稿，再選擇要沿用的內容。',true);
      recovery.replaceChildren(button('沿用這份工作草稿',act(async()=>{
        paused=false;stored='';refreshRecovery();redrawControls();await flush();workState(workSavedLabel());
      })),button('使用活動庫版本',act(async()=>{
        spec=publishedDraft;brief.value='';stored='';paused=false;refreshRecovery();render();await flush();workState('已讀取活動庫版本。');
      })));
    }else if(working.base||working.brief)workState('已讀取上次的工作草稿。');
    else if(item)workState('正在編輯第 '+rev+' 版。');
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
    if(!next||(!activeApp&&!canLeave()))return;
    run(async()=>{
      if(activeApp&&!dirty&&area===next&&appId==='new')return;
      if(activeApp&&dirty)await activeApp.flush();
      const previous=area,previousId=appId;area=next;if(editorAreas.includes(next))appId='new';
      try{await dashboard();}catch(err){area=previous;appId=previousId;throw err;}
    });
  };
  selector.onchange=()=>{
    const next=selector.value,previous=room;
    if(activeApp){room=next;tabs();activeApp.roomChange();return;}
    if(!canLeave()){selector.value=room;return;}
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
