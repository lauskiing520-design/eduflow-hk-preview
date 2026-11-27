/* Teacher workbench for a source-backed, two-stage percentage lesson. */
window.EduPercentLessonEditor=(()=>{
  'use strict';
  const sample='一件貨品原價 100 元，先減價 20%，再加價 20%。最後售價比原價高、低，還是相同？';
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const label=(name,input)=>{const l=el('label',name);l.append(input);return l;};
  const button=(name,action,cls)=>{const b=el('button',name,cls);b.type='button';b.onclick=action;return b;};
  const panel=(title)=>{const box=el('section',null,'panel');box.append(el('h2',title));return box;};
  const sig=JSON.stringify;
  async function open({item,api,post,url,host,run,setDirty,selectKey,deliveryFor,importFile}){
    const engine=window.EduPercentLesson;
    if(!engine)throw Error('互動課未能載入，請重新整理。');
    const id=item?.id||crypto.randomUUID().replaceAll('-','');
    let key=item?.id||'lesson-new', revision=item?.revision||0, published=item?.data||null;
    const work=(await api(url+'?work='+encodeURIComponent(key))).draft;
    let wr=work.revision, sourceVersion=work.sourceRevision;
    const blank=!wr;
    const source=el('textarea');source.rows=5;source.maxLength=6000;
    source.placeholder='貼上講義中含原價、先減價和再加價百分率的例子。';
    source.value=blank ? published?.source||'' : work.brief;
    let data=blank ? published : work.base;
    if(!data&&source.value&&published?.source===source.value)data=published;
    let conflict=sourceVersion!==revision,timer,flight,player;
    let saved=sig({brief:work.brief,base:work.base});
    const snapshot=()=>({brief:source.value,base:data});
    const unsavedEdition=()=>!data||sig(data)!==sig(published);
    const root=el('div',null,'lesson-maker');
    const compose=panel('把講義變成互動課'),review=panel('核對講義與新題'),preview=panel('學生試玩');
    const wrap=el('div',null,'lesson-maker-columns'),side=el('div',null,'lesson-maker-side');
    const state=el('p',null,'app-work-status');state.setAttribute('role','status');
    const evidence=el('blockquote',null,'lesson-evidence'),values=el('p'),controls=el('div');
    const canvas=el('div'),previewTitle=el('h3'),previewInstructions=el('p'),feedback=el('p',null,'lesson-grade');feedback.setAttribute('role','status');
    const grade=button('試評新題',()=>{try{
      const r=engine.grade(data,player.read(),true);feedback.textContent='試評結果：'+r.score+' / '+r.max+' 分。';
    }catch(err){feedback.textContent=err.message;}});
    const delivery=deliveryFor(id,item?.pins||[],()=>revision,unsavedEdition);
    const reload=button('讀取最新工作草稿',()=>{if(confirm('以已儲存的版本取代畫面上的內容？')){
      setDirty(false);location.reload();
    }});
    const resolve=button('保留這份講義繼續整理',()=>run(async()=>{
      const latest=key==='lesson-new'?null:await api(url+'?item='+encodeURIComponent(key));
      const newest=(await api(url+'?work='+encodeURIComponent(key))).draft;
      revision=latest?.revision||0;published=latest?.data||null;wr=newest.revision;
      sourceVersion=revision;conflict=false;saved=null;
      await flush();display();note('已保留這份講義。請核對及儲存後再派發。');
    }));
    function note(msg,error=false){state.textContent=msg;state.classList.toggle('error',error);}
    async function flush(){
      clearTimeout(timer);if(conflict)throw Error('工作草稿有另一個版本。請先選擇要保留的內容。');
      if(flight)return flight;
      flight=(async()=>{
        while(saved!==sig(snapshot())){
          const body=snapshot();
          try{const r=await post(url,{action:'work',id:key,revision:wr,sourceRevision:revision,...body});
            wr=r.draft.revision;sourceVersion=r.draft.sourceRevision;saved=sig(body);
          }catch(e){if(e.status===409){conflict=true;display();}
            setDirty(true);note(e.message,true);throw e;}
        }
        setDirty(false);
      })();
      try{await flight;}finally{flight=null;}
    }
    function schedule(){
      setDirty(true);clearTimeout(timer);note('正在儲存工作草稿…');
      timer=setTimeout(()=>flush().then(()=>note(window.EduStudioDemo?'工作草稿已儲存在這個瀏覽器。':'工作草稿已儲存在教師帳戶。')).catch(()=>{}),400);
    }
    function changedSource(){data=null;display();schedule();}
    source.oninput=changedSource;
    const choose=button('載入百分法講義',()=>{
      if(source.value.trim()&&source.value!==sample&&!confirm('要用示例取代現在的講義文字嗎？'))return;
      source.value=sample;changedSource();source.focus();
    });
    const file=el('input');file.type='file';file.accept=window.EduStudioDemo?'.docx,.txt':'.pdf,.docx,.txt';
    file.onchange=()=>run(async()=>{
      const selected=file.files[0];file.value='';if(!selected)return;
      if(source.value.trim()&&!confirm('要用檔案中的文字取代現在的講義嗎？'))return;
      let text;
      if(/\.txt$/i.test(selected.name)){
        if(selected.size>48000)throw Error('請選擇不多於 6,000 字的一頁講義。');
        text=(await selected.text()).replace(/^\uFEFF/,'').trim();
      }else{const r=await importFile(selected);if(r.truncated)throw Error('講義太長，請單獨匯入一頁或貼上例題段落。');text=r.material;}
      if(!text?.trim()||text.length>6000)throw Error('請貼入可讀文字，或選擇不多於 6,000 字的一頁講義。');
      source.value=text;changedSource();await flush();note('已讀取並保存講義，請核對文字後產生互動課。');
    });
    const generate=button('產生互動課',()=>run(async()=>{
      await flush();const brief=source.value.trim();if(!brief)throw Error('請先貼入教材，或載入百分法講義示例。');
      note('正在從講義整理價格和兩次變幅…');
      try{const result=await post(url,{action:'generate',kind:'percentLesson',brief});
        data=engine.validate(result.data);source.value=data.source;
        display();setDirty(true);await flush();
        note(result.generator==='ai'?'AI 已起草，請對照原句核對價格與變幅。':'已按講義原句建立草稿，請核對價格與變幅。');
      }catch(error){note(error.message,true);throw error;}
    }),'primary');
    const save=button('儲存這節課',()=>run(async()=>{
      if(!data)throw Error('請先產生互動課。');await flush();
      const oldKey=key,oldWr=wr;
      const result=await post(url,{action:'save',id,revision,data});
      published=data;revision=result.revision;sourceVersion=revision;
      if(key==='lesson-new'){key=id;wr=0;selectKey(id);}
      saved=null;await flush();
      if(oldKey==='lesson-new'){try{await post(url,{action:'work',id:oldKey,revision:oldWr,sourceRevision:0,brief:'',base:null});}
        catch(err){if(err.status!==409)throw err;}}
      display();await delivery.refresh();note('第 '+revision+' 版已儲存，可派給本班。');
    }),'primary');
    const download=button('下載 OpenMAIC 課堂包',()=>run(async()=>{
      if(!published||unsavedEdition()||conflict)throw Error('請先核對並儲存這節課。');
      if(!window.EduPercentLessonExport)throw Error('未能載入課堂包匯出工具，請重新整理再試。');
      await window.EduPercentLessonExport.download(published);
      note('課堂包已下載。在 OpenMAIC 選「匯入課堂」，開啟 .maic.zip 檔案。');
    }));
    function editionButtons(){
      save.disabled=!data||conflict||!unsavedEdition();
      download.disabled=!published||conflict||unsavedEdition();
      download.title=download.disabled?'先核對並儲存這節課。':'下載已儲存的第 '+revision+' 版。';
    }
    const tools=el('div',null,'actions');tools.append(generate,choose);
    const sourceFile=el('details');sourceFile.append(el('summary','從文件讀取講義'),label(window.EduStudioDemo?'Word（DOCX）或文字檔（TXT）':'可選取文字的 PDF、Word（DOCX）或文字檔（TXT）',file));
    compose.append(el('p','中二數學 · 連續百分率變化','muted'),label('一頁講義',source),sourceFile,tools,state,reload,resolve);
    const editionActions=el('div',null,'actions');editionActions.append(save,download);
    review.append(evidence,values,controls,editionActions);
    preview.append(el('p','試玩時的作答只供預覽。','muted'),previewTitle,previewInstructions,canvas,grade,feedback);
    wrap.append(compose,side);root.append(wrap,preview);
    function redrawPreview(){
      player?.destroy();canvas.replaceChildren();feedback.textContent='';
      if(data){
        previewTitle.textContent=data.title;previewInstructions.textContent=data.instructions;
        player=engine.mount(canvas,engine.project(data),{});
      }
    }
    function controlsFor(){
      controls.replaceChildren();
      const name=el('input');name.maxLength=100;name.value=data.title;
      const info=el('textarea');info.maxLength=600;info.rows=2;info.value=data.instructions;
      for(const [node,key] of [[name,'title'],[info,'instructions']]){
        const fallback=data[key];node.oninput=()=>{
          data={...data,[key]:node.value.trim()||fallback};editionButtons();schedule();
        };node.onchange=()=>{node.value=data[key];redrawPreview();};
      }
      const details=el('details');details.open=true;
      details.append(el('summary','修改課堂內容'),label('課堂名稱',name),label('學生指引',info),el('h3','換數新題'));
      const fields=el('div',null,'numbers');
      const groups=[['price','新題原價（港元）',[50,80,100,120,150,180,200,240,250,300,400,500,800,1000]],
        ['down','先減價（%）',[5,10,15,20,25,30,40,50,60,75]],['up','再加價（%）',[5,10,15,20,25,30,40,50,60,75]]];
      for(const [key,text,numbers] of groups){
        const select=el('select');for(const value of [...new Set([...numbers,data.transfer[key]])].sort((a,b)=>a-b))select.add(new Option(String(value),String(value)));
        select.add(new Option('自訂數值…','custom'));select.value=String(data.transfer[key]);
        select.onchange=()=>{try{
          let v=select.value;
          if(v==='custom'){
            const max=key==='price'?10000:99;
            v=window.prompt(text+'（1 至 '+max+' 的整數）',String(data.transfer[key]));
            if(v===null){select.value=String(data.transfer[key]);return;}
            if(!/^\d+$/.test(v.trim()))throw Error('請以整數填寫'+text+'。');
          }
          const next=engine.validate({...data,transfer:{...data.transfer,[key]:Number(v)}});
          const choice=String(next.transfer[key]);
          if(!Array.from(select.options).some(o=>o.value===choice))select.add(new Option(choice,choice),select.options.length-1);
          select.value=choice;data=next;editionButtons();redrawPreview();schedule();}
          catch(err){select.value=String(data.transfer[key]);note(err.message,true);}};
        fields.append(label(text,select));
      }
      details.append(fields);controls.append(details);
    }
    function display(){
      side.replaceChildren();
      generate.disabled=conflict;resolve.hidden=reload.hidden=!conflict;
      editionButtons();
      preview.hidden=!data;controls.hidden=!data;
      if(data){
        evidence.textContent=data.quote;
        values.textContent='原價 HK$'+data.example.price+'　先減 '+data.example.down+'%　再加 '+data.example.up+'%';
        controlsFor();side.append(review,delivery.side);delivery.redraw();
      }else{
        const example=el('figure',null,'lesson-illustration');
        example.append(el('figcaption','講義示例 · 同樣加減兩成'));
        for(const [step,value] of [['原價',100],['減價後',80],['再加價後',96]]){
          const row=el('div'),line=el('span'),bar=el('i');
          bar.style.width=value+'%';line.setAttribute('aria-hidden','true');line.append(bar);
          row.append(el('span',step),line,el('strong',value+' 元'));example.append(row);
        }
        side.append(example);
      }
      redrawPreview();
    }
    display();host.replaceChildren(root);
    if(conflict)note('活動庫或工作草稿已有較新版本，請選擇要使用的內容。',true);
    else if(wr&&source.value)note('已讀取上次的工作草稿。');
    return {flush,roomChange:()=>delivery.redraw()};
  }
  return {open};
})();
