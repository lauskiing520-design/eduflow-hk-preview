/* Scientific inquiry workbench for teachers and the host of the native classroom. */
(function (root) {
  'use strict';
  const el=(tag, text, css)=>{
    const node=document.createElement(tag);
    if(text!=null)node.textContent=text;
    if(css)node.className=css;
    return node;
  };
  const button=(name, handler, css)=>{
    const node=el('button',name,css);node.type='button';node.onclick=handler;
    return node;
  };
  const label=(text,node)=>{const l=el('label',text);l.append(node);return l;};
  const status=(css)=>{const n=el('p',null,css);n.setAttribute('role','status');return n;};
  const number=(n)=>Number(n).toLocaleString('zh-HK',{maximumFractionDigits:2});
  const origin=(data)=>data.origin==='example'?'教學擬設數據':'教師提供的讀數';
  const reading=(row)=>number(row.length)+' cm：'+row.times.map(number).join('、')+' 秒';

  function evidence(data) {
    const box=el('section',null,'si-evidence');
    box.append(el('h3','量度摘要'));
    const table=el('table'),head=table.createTHead().insertRow(),body=table.createTBody();
    const summary=root.EduScienceInquiry.summarize(data);
    const fastest=Math.min(...summary.map(g=>g.min)),slowest=Math.max(...summary.map(g=>g.max));
    for(const text of ['翼長（cm）','三次下落時間（s）','平均（s）'])head.append(el('th',text));
    for(const group of summary){
      const row=body.insertRow(),name=el('th',number(group.length));name.scope='row';row.append(name);
      const values=el('td',group.times.map(number).join(' ／ ')),strip=el('span',null,'si-strip');
      strip.setAttribute('aria-hidden','true');
      group.times.forEach((value,index)=>{
        const dot=el('i');dot.style.left=(slowest===fastest?50:(value-fastest)/(slowest-fastest)*100)+'%';
        dot.style.top=(3+index*4)+'px';strip.append(dot);
      });
      values.append(strip);row.append(values,el('td',number(group.mean)));
    }
    box.append(table,el('p','各行共用 '+number(fastest)+' 至 '+number(slowest)+' 秒的橫軸。平均值顯示至小數點後兩位。','si-meta'));return box;
  }
  function mount(host,{data,answers,readonly=false,onChange=()=>{},practice=false}={}) {
    const E=root.EduScienceInquiry, spec=E.project(data), questions=E.questions(spec);
    const initial=E.initial(),saved=answers||{};
    let student={...initial,...structuredClone(saved),choices:{...initial.choices,...saved.choices},view:{...initial.view,...saved.view}};
    let classroom;
    const section=el('section',null,'si-player');
    const playerHost=el('div',null,'si-native'),count=status('si-progress');
    function updateCount(){
      const done=questions.filter(q=>student.choices[q.id]).length;
      count.textContent='課堂測驗已作答 '+done+' / '+questions.length+' 題';
    }
    function start(){
      classroom?.destroy();
      classroom=root.EduScienceClassroom.mount(playerHost,{
        data:spec,answers:student,readonly,practice,
        onChange:patch=>{
          if(readonly)return;
          student={...student,...patch};updateCount();onChange(structuredClone(student));
        }
      });
    }
    const source=el('p',origin(spec)+' · 翼長以厘米計，下落時間以秒計。','si-meta');
    if(readonly){
      const result=E.grade(spec,student,true);
      const review=el('section',null,'si-record');
      review.append(el('h3','課堂作答紀錄'),source,el('p','證據判讀 '+result.score+' / '+result.maximum+' 分','si-progress'));
      const list=el('ol');
      for(const q of questions){
        const answer=student.choices[q.id],choice=q.options.find(o=>o.value===answer);
        const item=el('li'),mark=el('span',q.answer.includes(answer)?'正確':'需訂正','si-mark');
        mark.dataset.correct=String(q.answer.includes(answer));
        item.append(el('strong',q.question),el('p','作答　'+(choice?.label||'未作答')),mark);
        const why=el('details');why.append(el('summary','查看依據'),el('p',q.analysis));item.append(why);list.append(item);
      }
      const replay=el('details',null,'si-replay');
      replay.append(el('summary','重看這次的原生課堂'),playerHost);
      replay.ontoggle=()=>{if(replay.open&&!classroom)start();};
      review.append(list,el('h4','給實驗小組的建議'),el('p',student.reason||'未附文字建議。','si-written'));
      if(student.evidence?.length){
        const citations=el('ul',null,'si-citations');
        for(const ref of student.evidence){const row=spec.rows.find(r=>r.length===ref);if(row)citations.append(el('li',reading(row)));}
        review.append(el('h4','學生引用的原始讀數'),citations);
      }
      review.append(replay);
      section.append(review);
    }else{
      const instructions=el('div',null,'si-brief');
      const focus=el('details'),guided=el('summary','老師的探究問題');
      focus.append(guided,el('p',E.guidance(spec)));
      instructions.append(focus,el('span',origin(spec)+' · 5 題','si-meta'));
      const explain=el('textarea');explain.rows=3;explain.maxLength=600;explain.value=student.reason||'';
      explain.placeholder='例如，指出一項要保持相同的條件，並引用一組讀數說明為甚麼值得重測。';
      explain.oninput=()=>{student.reason=explain.value;onChange(structuredClone(student));};
      const note=el('section',null,'si-reflection');
      const cite=el('fieldset',null,'si-cite'),refs=el('div'),legend=el('legend','引用原始讀數（最多兩組）');
      const cited=el('ul',null,'si-citations');
      function showCitations(){
        refs.replaceChildren();cited.replaceChildren();
        for(const row of spec.rows){
          const selected=student.evidence.includes(row.length);
          const pick=button(number(row.length)+' cm',()=>{
            student.evidence=selected?student.evidence.filter(n=>n!==row.length):[...student.evidence,row.length];
            showCitations();refs.querySelector('[data-length="'+row.length+'"]').focus();onChange(structuredClone(student));
          });
          pick.dataset.length=String(row.length);pick.disabled=!selected&&student.evidence.length>=2;
          pick.setAttribute('aria-pressed',String(selected));refs.append(pick);
          if(selected)cited.append(el('li',reading(row)));
        }
      }
      student.evidence??=[];showCitations();cite.append(legend,refs,cited);
      note.append(label('給實驗小組的建議（選填）',explain),cite);
      updateCount();section.append(instructions,playerHost,count,note);
    }
    host.replaceChildren(section);
    if(!readonly)start();
    return {read:()=>structuredClone(student),destroy:()=>{classroom?.destroy();classroom=null;}};
  }

  async function open({item,api,post,url,host,run,setDirty,selectKey,deliveryFor}){
    const E=root.EduScienceInquiry,id=item?.id||crypto.randomUUID().replaceAll('-',''),sample=E.create();
    if(item&&item.data.kind!=='scienceInquiryLab')throw Error('請從活動清單重開對應的探究課。');
    let key=item?.id||'science-new',edition=item?.revision||0,published=item?.data||null;
    const stored=(await api(url+'?work='+encodeURIComponent(key))).draft;
    const recovered=Boolean(stored.revision&&(stored.brief||stored.base));
    let raw=recovered?stored.brief:(published?E.format(published):'');
    let data=recovered?stored.base:published;
    let lessonTitle=data?.title||published?.title||'';
    let version=stored.revision,conflict=recovered&&stored.sourceRevision!==edition,flight=null,timer,previewPlayer;
    const signature=()=>JSON.stringify([raw,data]);
    let last=signature();
    const dirtyEdition=()=>!data||JSON.stringify(data)!==JSON.stringify(published);
    const shell=el('div',null,'si-maker'),columns=el('div',null,'si-maker-layout');
    const panel=el('section',null,'si-sheet'),aside=el('aside',null,'si-sidebar');
    const top=el('header',null,'si-sheet-head');
    top.append(el('p','中一科學 · 公平測試','si-meta'),el('h2','紙直升機實驗記錄'),
      el('p','從同一高度釋放紙直升機。每種翼長量度三次下落時間，用全班的讀數建立證據題。'));
    const draftStatus=status('si-status'),actionStatus=status('si-result'),body=el('div');
    const delivery=deliveryFor(id,item?.pins||[],()=>edition,dirtyEdition);
    const source=el('textarea',null,'si-raw');source.rows=6;source.maxLength=6000;source.spellcheck=false;source.placeholder=E.format(sample);
    const sourceLabel=label('從試算表貼上讀數',source),format=el('p','每行依次為翼長（cm）、第一次、第二次及第三次下落時間（s）。可連表頭貼上。','si-meta');
    const header=E.format(sample).split(/\r?\n/)[0];
    const grid=el('div',null,'si-grid'),table=el('table'),head=table.createTHead().insertRow(),tbody=table.createTBody();
    for(const name of ['翼長（cm）','第一次（s）','第二次（s）','第三次（s）',''])head.append(el('th',name));
    let gridRows=[],mode='grid';
    function rawRows(){
      if(!raw.trim())return [];
      const rows=raw.split(/\r?\n/);
      if(rows[0]===header&&rows.slice(1).every(r=>r.split('\t').length===4))return rows.slice(1).map(r=>r.split('\t'));
      const spec=E.parse(raw);return spec.rows.map(r=>[r.length,...r.times].map(String));
    }
    function updateRaw(){
      raw=gridRows.some(row=>row.some(Boolean))?[header,...gridRows.map(r=>r.join('\t'))].join('\n'):'';
      source.value=raw;invalidate();
    }
    function drawGrid(){
      tbody.replaceChildren();
      gridRows.forEach((r,i)=>{
        const tr=tbody.insertRow();
        r.forEach((value,j)=>{
          const control=el('input');control.type='text';control.inputMode='decimal';control.maxLength=15;control.value=value;
          control.setAttribute('aria-label','第 '+(i+1)+' 組'+(j?'第 '+j+' 次下落時間（秒）':'翼長（厘米）'));
          control.oninput=()=>{r[j]=control.value;updateRaw();};
          tr.insertCell().append(control);
        });
        const remove=button('移除',()=>{gridRows.splice(i,1);drawGrid();updateRaw();},'si-remove');
        remove.setAttribute('aria-label','移除第 '+(i+1)+' 組');remove.disabled=gridRows.length<=3;tr.insertCell().append(remove);
      });
      add.disabled=gridRows.length>=maxGroups;
    }
    const maxGroups=12,add=button('增加一組翼長',()=>{if(gridRows.length<maxGroups){gridRows.push(['','','','']);drawGrid();tbody.lastElementChild.querySelector('input').focus();}});
    grid.append(table,add);
    const tabs=el('div',null,'si-modes'),rawFields=el('div');
    rawFields.append(sourceLabel,format);
    const tabGrid=button('逐格輸入',()=>switchMode('grid')),tabRaw=button('貼上試算表',()=>switchMode('raw'));
    tabs.setAttribute('role','group');tabs.setAttribute('aria-label','輸入讀數方式');tabs.append(tabGrid,tabRaw);
    function switchMode(next){
      if(next==='grid'){
        try{gridRows=rawRows();while(gridRows.length<3)gridRows.push(['','','','']);drawGrid();}
        catch(e){tell(e.message+' 可在文字欄直接修正。',true);next='raw';}
      }else source.value=raw;
      mode=next;grid.hidden=mode!=='grid';rawFields.hidden=mode!=='raw';
      tabGrid.setAttribute('aria-pressed',String(mode==='grid'));tabRaw.setAttribute('aria-pressed',String(mode==='raw'));
    }
    function tell(msg,bad=false){actionStatus.textContent=msg;actionStatus.classList.toggle('si-error',bad);}
    function updateButtons(){
      generate.disabled=conflict||!raw.trim();
      save.disabled=conflict||!dirtyEdition()||!data;
      reload.hidden=!conflict;retain.hidden=!conflict;
    }
    async function flush(){
      clearTimeout(timer);
      if(conflict)throw Error('另一部裝置剛改動了這份記錄。請選擇要使用的版本。');
      if(flight)return flight;
      flight=(async()=>{
        while(last!==signature()){
          const next=signature(),result=await post(url,{action:'work',id:key,revision:version,sourceRevision:edition,brief:raw,base:data});
          last=next;version=result.draft.revision;
        }
        setDirty(false);
      })();
      try{await flight;}
      catch(e){if(e.status===409){conflict=true;updateButtons();}setDirty(true);draftStatus.textContent=e.message;throw e;}
      finally{flight=null;}
    }
    function schedule(){
      setDirty(true);clearTimeout(timer);draftStatus.textContent='正在儲存記錄…';
      timer=setTimeout(()=>flush().then(()=>{draftStatus.textContent=root.EduStudioDemo?'草稿已儲存在此瀏覽器。':'草稿已儲存到教師帳戶。';}).catch(()=>{}),480);
    }
    function invalidate(){
      data=null;tell('');display();schedule();
    }
    source.oninput=()=>{raw=source.value;invalidate();};
    const example=button('載入教學示例',()=>{
      const sampleText=E.format(sample);
      if(raw.trim()&&sampleText!==raw&&!confirm('以教學示例取代目前的讀數？'))return;
      raw=sampleText;source.value=raw;switchMode(mode);invalidate();tell('已載入教學擬設數據。你可以修改讀數再建課。');
    });
    const generate=button('根據讀數建課',()=>run(async()=>{
      try{
        await flush();E.parse(raw);
        tell('正在核對讀數及整理課堂提問…');
        const r=await post(url,{action:'generate',kind:'scienceInquiryLab',brief:raw});
        data=E.validate(lessonTitle?{...r.data,title:lessonTitle}:r.data);display();await flush();
        tell(r.generator==='ai'?'讀數已核對，學校配置的 AI 已選擇教學追問。':'已按這份讀數重算平均時間和課堂題。');
      }catch(e){tell(e.message,true);throw e;}
    }),'primary');
    const save=button('儲存這節科學課',()=>run(async()=>{
      if(!data||conflict)throw Error('請先核對本次讀數。');
      await flush();const oldKey=key,oldVersion=version;
      const r=await post(url,{action:'save',id,revision:edition,data});
      edition=r.revision;published=data;
      if(key==='science-new'){key=id;version=0;selectKey(id);}
      last=null;await flush();
      if(oldKey==='science-new'){
        try{await post(url,{action:'work',id:oldKey,revision:oldVersion,sourceRevision:0,brief:'',base:null});}
        catch(e){if(e.status!==409)throw e;}
      }
      display();await delivery.refresh();tell('第 '+edition+' 版已儲存，可派給本班。');
    }),'primary');
    const reload=button('讀取最新版本',()=>{if(confirm('以最新儲存的讀數取代畫面上的版本？')){setDirty(false);location.reload();}});
    const retain=button('保留畫面上的讀數',()=>run(async()=>{
      const latest=key==='science-new'?null:await api(url+'?item='+encodeURIComponent(key));
      const working=(await api(url+'?work='+encodeURIComponent(key))).draft;
      edition=latest?.revision||0;published=latest?.data||null;version=working.revision;last=null;conflict=false;
      await flush();display();tell('已保留畫面上的讀數。核對後可儲存新版本。');
    }));
    const toolbar=el('div',null,'si-actions');toolbar.append(generate,example);
    panel.append(top,tabs,grid,rawFields,toolbar,draftStatus,actionStatus,reload,retain);
    const prepared=el('section',null,'si-prepared'),preview=el('details',null,'si-preview'),canvas=el('div');
    preview.append(el('summary','試上這節課'),canvas);
    preview.ontoggle=()=>{
      if(preview.open&&data&&!previewPlayer)previewPlayer=mount(canvas,{data,practice:true});
      if(!preview.open){previewPlayer?.destroy();previewPlayer=null;canvas.replaceChildren();}
    };
    function display(){
      updateButtons();prepared.replaceChildren();aside.replaceChildren();
      previewPlayer?.destroy();previewPlayer=null;canvas.replaceChildren();preview.open=false;
      preview.hidden=prepared.hidden=!data;
      if(data){
        const info=el('div',null,'si-prepared-head');
        const name=el('input');name.type='text';name.maxLength=120;name.value=data.title;
        const title=el('h2',data.title);
        name.oninput=()=>{
          try{
            data=E.validate({...data,title:name.value});lessonTitle=data.title;title.textContent=data.title;
            updateButtons();delivery.redraw();schedule();preview.open=false;
          }catch(e){save.disabled=true;tell(e.message,true);}
        };
        name.onchange=()=>{name.value=data.title;updateButtons();};
        const naming=el('details',null,'si-keys');naming.append(el('summary','更改課堂名稱'),label('課堂名稱',name));
        info.append(el('p',origin(data),'si-meta'),title,naming);
        prepared.append(info,evidence(data));
        const guide=el('div',null,'si-guide'),focus=el('select'),target=el('select'),guidance=el('p',E.guidance(data));
        for(const [value,title] of [['repeat','重複量度'],['spread','比較讀數差異'],['control','公平測試']])focus.add(new Option(title,value));
        for(const row of data.rows)target.add(new Option(number(row.length)+' cm',String(row.length)));
        focus.value=data.focus;target.value=String(data.focusLength);
        focus.onchange=target.onchange=()=>{
          data=E.validate({...data,focus:focus.value,focusLength:Number(target.value)});guidance.textContent=E.guidance(data);
          preview.open=false;updateButtons();delivery.redraw();schedule();
        };
        guide.append(label('課堂追問重點',focus),label('由哪組翼長入手',target),guidance);
        const keys=el('details',null,'si-keys');keys.append(el('summary','核對五道證據題及答案'));
        const ol=el('ol');
        for(const q of E.questions(data)){
          const li=el('li'),answer=q.options.find(o=>q.answer.includes(o.value));
          li.append(el('strong',q.question),el('p',answer?.label),el('p',q.analysis,'si-meta'));ol.append(li);
        }
        keys.append(ol);prepared.append(guide,keys,save);aside.append(delivery.side);delivery.redraw();
      }else{
        const next=el('section',null,'si-checklist');
        next.append(el('h3','收集讀數時'),el('p','每行對應一種翼長，從同一高度放手，記下三次下落時間。'),
          el('p','紙張、機身、配重和放手方式應保持相同。課堂會讓學生判斷哪些結論有數據支持。'));
        aside.append(next);
        if(edition){aside.append(delivery.side);delivery.redraw();}
      }
    }
    body.append(panel,prepared);columns.append(body,aside);shell.append(columns,preview);host.replaceChildren(shell);
    try{rawRows();switchMode('grid');}catch(_){switchMode('raw');}
    if(recovered)draftStatus.textContent='已讀取上次的工作草稿。';
    if(conflict)draftStatus.textContent='工作草稿與已儲存課堂版本不同。請選擇要使用的版本。';
    display();
    return {flush,roomChange:()=>delivery.redraw()};
  }
  root.EduScienceUI={open,mount};
})(window);
