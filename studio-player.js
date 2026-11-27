window.EduStudioPlayer=(()=>{
  'use strict';
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function matchPreview(data){
    if(data.kind==='percentLesson')return EduPercentLesson.project(data);
    if(data.kind!=='match')return {...data};
    // Rotate the choices so reading down the page does not give away the order.
    return {kind:data.kind,title:data.title,instructions:data.instructions,lefts:data.pairs.map(p=>p.left),
      choices:[...data.pairs.slice(1),data.pairs[0]].map(p=>p.right)};
  }
  function scorePreview(data,view,answers){
    if(data.kind==='scienceInquiryLab')return EduScienceInquiry.grade(data,answers,true);
    if(data.kind==='priceInvestigation')return EduInvestigation.grade(data,answers,true);
    if(data.kind==='percentLesson')return EduPercentLesson.grade(data,answers,true);
    if(data.kind==='app'){
      const outcome=EduStudioApp.answer(data,answers,true);
      return {score:outcome.score,max:outcome.maximum,answers:outcome.answers};
    }
    const score=data.kind==='match'?answers.filter((v,i)=>view.choices[v]===data.pairs[i].right).length:
      Number(data.a*answers[0]+data.b===data.target);
    return {score,max:data.kind==='match'?data.pairs.length:1,answers};
  }
  function hintHistory(records) {
    const list=el('ol');
    list.className='studio-hint-log';
    records.forEach((record,index)=>{
      const row=el('li'),source=record.source==='ai'?'AI 選擇的提示':'操作提示';
      const meta=el('span',source+' '+(index+1));
      meta.className='hint-source';
      row.append(meta,el('p',record.text));
      if(record.evidence){
        const reading=el('p','當時畫面：'+record.evidence);
        reading.className='hint-evidence';
        row.append(reading);
      }
      list.prepend(row);
    });
    return list;
  }
  function hintPanel(options,read,finished) {
    const host=el('aside'),title=el('h2','操作提示'),ask=el('button','給我一個提示');
    host.className='studio-hint-panel';
    host.setAttribute('aria-label','操作提示');
    ask.type='button';
    const intro=el('p',options.local?'展示版會按當前畫面，用本機規則選擇提示。':'按下按鈕後，學校配置的 AI 可參考目前畫布的讀數和選擇來挑選提示。');
    const limit=el('p'),notice=el('p'),log=el('div');
    intro.className='hint-intro';limit.className='hint-quota';notice.className='hint-status';
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    let records=options.records,activeRequest=null,retry=null,lastShown=null,currentHint=null;
    function redraw() {
      const atLimit=records.length>=6;
      ask.disabled=Boolean(activeRequest);
      ask.textContent=atLimit?'重看這個畫面的提示':'給我一個提示';
      ask.hidden=finished;intro.hidden=finished;
      limit.textContent=atLimit?'已用 6 / 6 個提示。回到曾取得提示的畫面，可重看對應的提示。':'已用 '+records.length+' / 6 個提示';
      const history=hintHistory(records);
      log.replaceChildren();
      if(history.children.length>1){
        const latest=el('ol'),older=el('details');
        latest.className=history.className;
        const index=currentHint?records.findIndex(h=>h.text===currentHint.text&&h.evidence===currentHint.evidence&&h.source===currentHint.source):-1;
        const shown=index>=0?history.children[records.length-1-index]:history.firstElementChild;
        latest.append(shown);
        older.append(el('summary',(index>=0&&index<records.length-1?'其他 ':'先前 ')+history.children.length+' 個提示'),history);
        log.append(latest,older);
      }else log.append(history);
    }
    function stateChanged() {
      if(lastShown!==null&&lastShown!==JSON.stringify(read())){
        lastShown=null;currentHint=null;redraw();
        notice.textContent='畫面已改變，下方保留先前操作的提示。';
      }
    }
    ask.onclick=async()=>{
      if(finished||ask.disabled)return;
      const answers=structuredClone(read()),signature=JSON.stringify(answers);
      if(!retry||retry.signature!==signature)retry={signature,id:crypto.randomUUID().replaceAll('-','')};
      activeRequest=retry;lastShown=null;currentHint=null;redraw();
      notice.textContent='正在查看這次操作…';
      try {
        const result=await options.request(answers,activeRequest.id);
        if(!Array.isArray(result?.hints))throw Error('未能讀取提示。');
        records=result.hints;retry=null;
        const current=signature===JSON.stringify(read());
        lastShown=current?signature:null;
        currentHint=current&&!finished?(result.hint||records.at(-1)):null;
        if(!finished)notice.textContent=current?'已收到提示。':'畫面已改變，新收到的提示對應剛才的操作。';
      } catch(error) {
        if(!finished)notice.textContent=error.message||'未能取得提示，可再試一次。';
      } finally {
        activeRequest=null;redraw();
      }
    };
    host.append(title,intro,ask,limit,notice,log);redraw();
    return {host,stateChanged,finish:()=>{finished=true;lastShown=null;currentHint=null;notice.textContent='';redraw();}};
  }
  function mount(host,data,receipt,submit,draft=null,saveDraft=null,hints=null){
    const form=el('form'),instruction=el('p',data.instructions),fields=el('fieldset'),legend=el('legend','我的作答');
    fields.className='studio-player-fields';fields.append(legend);
    const message=el('p');message.setAttribute('role','status');
    const previous=receipt?.answers||draft?.answers;
    const science=data.kind==='scienceInquiryLab',investigation=science||data.kind==='priceInvestigation';
    const courseUI=investigation?(science?EduScienceUI:EduInvestigationUI):null;
    let saved,saveTimer,saving=null,closed=Boolean(receipt);
    async function flushProgress(){
      clearTimeout(saveTimer);
      if(!investigation||!saveDraft||closed)return;
      if(saving)return saving;
      saving=(async()=>{
        while(!closed&&saved!==JSON.stringify(read())){
          const latest=read(),signature=JSON.stringify(latest);
          await saveDraft(latest);saved=signature;
        }
      })();
      try{await saving;}finally{saving=null;}
    }
    function scheduleProgress(){
      if(!saved||!saveDraft||closed)return;
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>flushProgress().then(()=>{
        if(!closed)message.textContent='進度已保存。';
      }).catch(err=>{message.textContent=err.message;}),650);
    }
    if(investigation){
      form.className='investigation-session';
      legend.textContent=science?'科學實驗紀錄與作答':'校刊報價探究作答';
      legend.className='iv-sr-only';instruction.hidden=true;
    }
    let read,canvas,help,lesson,updateLessonSubmit=()=>{};
    if(investigation){
      canvas=el('div');fields.append(canvas);
      lesson=courseUI.mount(canvas,{data,answers:previous||undefined,readonly:Boolean(receipt),
        onChange:()=>{updateLessonSubmit();help?.stateChanged();scheduleProgress();}});
      read=()=>lesson.read();
      saved=JSON.stringify(read());
      if(Array.isArray(hints?.records)&&typeof hints.request==='function')help=hintPanel(hints,read,Boolean(receipt));
    }else if(data.kind==='percentLesson'){
      canvas=el('div');fields.append(canvas);
      lesson=EduPercentLesson.mount(canvas,data,{answers:previous||undefined,readonly:Boolean(receipt),onChange:()=>updateLessonSubmit()});
      read=()=>lesson.read();
    }else if(data.kind==='app'){
      canvas=el('div');fields.append(canvas);
      let state=previous||EduStudioApp.initial(data);
      read=()=>state;
      EduStudioApp.mount(canvas,data,state,value=>{state=value;help?.stateChanged();},Boolean(receipt));
      if(Array.isArray(hints?.records)&&typeof hints.request==='function')help=hintPanel(hints,read,Boolean(receipt));
    }else if(data.kind==='match'){
      const selects=data.lefts.map((left,i)=>{
        const label=el('label',left),s=el('select');label.className='match-line';s.required=true;
        s.add(new Option('選擇配對',''));data.choices.forEach((v,j)=>s.add(new Option(v,String(j))));
        if(Number.isInteger(previous?.[i]))s.value=String(previous[i]);label.append(s);fields.append(label);return s;
      });
      read=()=>selects.map(s=>s.value===''?null:Number(s.value));
    }else{
      const lab=el('div');lab.className='lab';
      const x=el('input');x.type='range';x.step='1';x.min=data.min;x.max=data.max;x.value=String(previous?.[0]??Math.max(data.min,Math.min(0,data.max)));
      const variable=el('span'),label=el('label');label.append(variable,x);
      const formula=(data.a===1?'x':data.a===-1?'−x':data.a+'x')+
        (data.b>0?' + '+data.b:data.b<0?' − '+(-data.b):'');
      const formulaLine=el('p',formula+' = '+data.target),output=el('output');
      const balance=el('div');balance.className='studio-balance';balance.setAttribute('aria-hidden','true');
      const beam=el('div');beam.className='studio-beam';
      const left=el('span'),right=el('span');left.className='studio-pan left';right.className='studio-pan right';
      beam.append(left,right);balance.append(beam);
      const redraw=()=>{variable.textContent='調整 x　'+x.value;const value=data.a*Number(x.value)+data.b;
        const diff=data.target-value;
        // In screen coordinates a positive rotation lowers the right-hand pan.
        const tilt=diff===0?0:Math.sign(diff)*Math.min(13,3+Math.sqrt(Math.abs(diff))*1.3);
        beam.style.setProperty('--studio-tilt',tilt+'deg');left.textContent=value;right.textContent=data.target;
        x.setAttribute('aria-valuetext','x 等於 '+x.value+'，左邊 '+value+'，右邊 '+data.target);
        output.textContent='左邊 '+value+(value===data.target?' ＝ ':value<data.target?' ＜ ':' ＞ ')+'右邊 '+data.target+(value===data.target?' · 平衡':'');};
      redraw();x.addEventListener('input',redraw);lab.append(formulaLine,balance,label,output);fields.append(lab);read=()=>[Number(x.value)];
    }
    const button=el('button','提交作答');button.type='submit';button.className='primary';
    const save=el('button','保存進度');save.type='button';save.hidden=!saveDraft;
    const bar=el('div');bar.className='actions';bar.append(button,save);
    if(lesson){
      updateLessonSubmit=()=>{
        const answers=read();
        if(science){
          button.disabled=!EduScienceInquiry.isComplete(data,answers);
          button.title=button.disabled?'完成課堂內的五道選擇題後即可交回。':'';
          return;
        }
        if(investigation){
          button.disabled=!['quote','model','budget','advice'].every(s=>EduInvestigation.diagnose(data,answers,s).complete);
          button.title=button.disabled?'完成報價、預算及採購建議後即可交回。':'';
          return;
        }
        button.disabled=answers.prediction===null||answers.trialUp===null||answers.exitPrice===null;
        button.title=button.disabled?'完成預測、試驗和新題後便可提交。':'';
      };
      updateLessonSubmit();
    }
    const report=r=>{
      closed=true;clearTimeout(saveTimer);
      fields.disabled=true;bar.hidden=true;
      help?.finish();
      if(canvas){
        canvas.inert=false;
        if(investigation){
          lesson.destroy();lesson=courseUI.mount(canvas,{data,answers:r.answers,readonly:true});
          fields.disabled=false;
        }else if(lesson){lesson.destroy();lesson=EduPercentLesson.mount(canvas,data,{answers:r.answers,readonly:true});}
        else EduStudioApp.mount(canvas,data,r.answers,()=>{},true);
      }
      message.textContent=r.max===0?'已提交探索紀錄。':'已完成，得分 '+r.score+' / '+r.max+'。';
      if(investigation){
        message.textContent='已交回 · 客觀題 '+r.score+' / '+r.max+' 分。';
        const feedback=el('section');feedback.className='panel investigation-feedback';
        feedback.append(el('h3',r.review?'老師給你的回饋':science?'實驗紀錄已交給老師':'採購建議待老師覆核'));
        if(r.review)feedback.append(el('p',r.review.comment));
        message.after(feedback);
      }
    };
    form.append(instruction);
    if(help&&investigation){
      const prompt=el('details'),toggle=el('summary','卡在哪一步？取得課堂追問');prompt.className='investigation-help';
      prompt.append(toggle,help.host);form.append(fields,prompt);
    }else if(help){
      const workspace=el('div');workspace.className='studio-play-layout';
      workspace.append(fields,help.host);form.append(workspace);
    }else form.append(fields);
    form.append(bar,message);host.replaceChildren(form);
    if(receipt){report(receipt);return;}
    if(draft?.revision)message.textContent='已讀取上次保存的進度。';
    save.onclick=async()=>{
      if(!saveDraft||save.disabled)return;const answers=read();
      button.disabled=save.disabled=fields.disabled=true;if(canvas)canvas.inert=true;
      try{if(investigation)await flushProgress();else await saveDraft(answers);message.textContent='進度已保存，可從學生入口繼續。';}
      catch(err){message.textContent=err.message;}
      finally{button.disabled=save.disabled=fields.disabled=false;if(canvas)canvas.inert=false;updateLessonSubmit();}
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(button.disabled)return;
      const answers=read();
      if(data.kind==='match'&&new Set(answers).size!==answers.length){message.textContent='每個選項只可配對一次，請檢查重複的選項。';return;}
      button.disabled=save.disabled=true;fields.disabled=true;if(canvas)canvas.inert=true;message.textContent='正在提交…';
      try{if(investigation)await flushProgress();const r=await submit(answers);report(r);}
      catch(error){message.textContent=error.message;button.disabled=save.disabled=false;fields.disabled=false;if(canvas)canvas.inert=false;updateLessonSubmit();}
    };
  }
  return {matchPreview,scorePreview,mount,hintHistory};
})();
