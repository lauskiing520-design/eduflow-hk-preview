(() => {
  'use strict';
  const engine=globalThis.EduEquationPractice;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let carried;
  function suitable(paper) {
    return paper?.year==='中一' && paper.subject==='數學' && paper.questions.some(q=>{
      if (q.source?.type==='adapted' || q.diagram || q.figure) return false;
      if (paper.custom) return true;
      try { engine.inspect(q.prompt); return true; } catch { return false; }
    });
  }
  function open(prompt) {
    carried=prompt;
    location.hash='equation-practice';
  }
  function mount(root,{paper,index,request,save,onSaved,readDraft,writeDraft}) {
    const fromEditor=carried;
    carried=undefined;
    const sourceOptions=paper?.questions.map((q,i)=>({q,i})).filter(({q})=>q.source?.type!=='adapted' && !q.diagram && !q.figure) || [];
    const supported=sourceOptions.find(({q})=>{try{engine.inspect(q.prompt);return true;}catch{return false;}});
    const initial=sourceOptions.find(item=>item.i===index) || supported || sourceOptions[0];
    const title='中一方程同類練習';
    root.innerHTML='<a class="sheet-back" href="#'+(paper?'paper/'+esc(paper.id):'papers')+'">'+(paper?'返回原卷':'返回試卷列表')+'</a>'+
      '<header class="page-heading"><h1>自訂方程出同類題</h1><p>輸入一道中一方程，產生兩題，核對解法後選入再練卷。</p></header>'+
      '<section class="scan-box"><h2>原題</h2>'+(sourceOptions.length?'<label class="answer-label">從原卷選題<select data-ep="source">'+sourceOptions.map(({q,i})=>'<option value="'+i+'">第 '+(i+1)+' 題 · '+esc(q.topic||q.prompt.slice(0,24))+'</option>').join('')+'</select></label>':'')+
      '<label class="answer-label">題目<textarea data-ep="prompt" maxlength="850" rows="3" required></textarea></label>'+
      '<p class="field-note">可用四則、括號或分數。文字題支援印刷收費及單車租金，可套用下方例題的句式。</p>'+
      '<details><summary>可用的文字題例子</summary><p>印刷費包括一次排版費24元及每冊3元。總費60元，印了多少冊？</p><p>租單車已繳85元，其中25元是按金，餘額支付每小時10元的租金。可租多少小時？</p></details>'+
      '<div class="page-actions"><button type="button" class="button primary" data-ep="generate">'+(request?'產生並驗算兩題':'以規則產生並驗算兩題')+'</button></div>'+
      (!request?'<p class="field-note">展示站使用規則出題，儲存的卷可在這個瀏覽器試派。</p>':'')+'</section>'+
      '<p data-ep="draft-status" role="status"></p><div data-ep="draft-tools" hidden><button class="button" type="button" data-ep="load">讀取已儲存的草稿</button> <button class="button" type="button" data-ep="replace" hidden>用目前內容取代草稿</button></div>'+
      '<p data-ep="status" role="status"></p><section class="scan-box" data-ep="result" hidden><h2>選入再練卷</h2><div data-ep="rows"></div>'+
      '<label class="answer-label">試卷名稱<input data-ep="title" maxlength="120" required></label>'+
      '<div class="page-actions"><button type="button" class="button primary" data-ep="save">儲存並預覽試卷</button></div></section>';
    const field=name=>root.querySelector('[data-ep="'+name+'"]');
    const prompt=field('prompt'), picker=field('source'), status=field('status');
    field('title').value=title;
    prompt.value=fromEditor ?? initial?.q.prompt ?? engine.example;
    if(picker)picker.value=String(initial?.i);
    let generationId=crypto.randomUUID(),saveId=crypto.randomUUID(),batch,busy=false;
    let revision=0, dirty=false, paused=false, inFlight=null, timer;
    const note=field('draft-status'), tools=field('draft-tools');
    const savedText=request?'草稿已儲存至伺服器。':'草稿已儲存在這個瀏覽器。';
    const snapshot=()=>({
      sourcePrompt:prompt.value,title:field('title').value,mode:batch?.mode||'',
      candidates:(batch?.questions||[]).map(({prompt,referenceAnswer})=>({prompt,referenceAnswer})),
      selected:batch?[...field('rows').querySelectorAll('input:checked')].map(input=>Number(input.value)):[]
    });
    const empty=()=>({sourcePrompt:'',title:'',mode:'',candidates:[],selected:[]});
    function pause(message,mayReplace) {
      paused=true; note.textContent=message; tools.hidden=false;field('replace').hidden=!mayReplace;
    }
    async function drain() {
      clearTimeout(timer);
      if(inFlight)return inFlight;
      if(paused || !dirty)return;
      inFlight=(async()=>{
        while(dirty && !paused){
          dirty=false;
          const data={...snapshot(),revision};
          try {
            const result=await writeDraft(data);
            revision=result.draft.revision;
            note.textContent=savedText;
          }catch(error){
            dirty=true;
            if(error.code==='equation_draft_conflict')pause('另一個視窗或裝置已更改草稿。可保留本頁內容另存試卷，或讀取已儲存的草稿。',false);
            else pause((error.message||'未能儲存草稿。')+' 可重新讀取草稿，或重試儲存目前內容。',true);
          }
        }
      })();
      try{await inFlight;}finally{inFlight=null;}
    }
    function changed(){
      dirty=true;
      if(paused)return;
      note.textContent='正在儲存草稿…';
      clearTimeout(timer);timer=setTimeout(drain,220);
    }
    function showBatch(selected) {
      field('rows').innerHTML=batch.questions.map((q,i)=>
        '<article class="answer-question"><label><input type="checkbox" value="'+i+'"'+(selected.includes(i)?' checked':'')+'> 選入第 '+(i+1)+' 題</label><h3>'+esc(q.prompt)+'</h3>'+
        '<p>答案　'+esc(q.referenceAnswer)+(q.unit?' '+esc(q.unit):'')+'</p><details><summary>驗算過程及評分點</summary><ol>'+
        q.solution.split('\n').map(line=>'<li>'+esc(line)+'</li>').join('')+'</ol><ul>'+
        q.criteria.map(c=>'<li>'+esc(c.label)+'（'+c.max+' 分）</li>').join('')+'</ul></details></article>').join('');
      field('result').hidden=false;
    }
    async function restore(atEntry) {
      lock(true);
      try {
        const {draft}=await readDraft();
        revision=draft.revision;
        if(atEntry && (fromEditor!==undefined || initial) && draft.sourcePrompt && draft.sourcePrompt!==prompt.value){
          pause('帶入的原題與已儲存的草稿不同。原草稿會保留，你可以選擇接着整理哪一份。',true);
          return;
        }
        tools.hidden=true; paused=false; dirty=false;
        if(!draft.sourcePrompt && !draft.title && !draft.candidates?.length){
          if(atEntry){
            if(fromEditor!==undefined || initial)changed();
          }else{
            prompt.value='';field('title').value=title;batch=null;field('result').hidden=true;
            field('rows').replaceChildren();status.textContent='';note.textContent='尚未有已儲存的草稿。';
          }
          return;
        }
        prompt.value=draft.sourcePrompt;field('title').value=draft.title;
        if(picker){const match=sourceOptions.find(({q})=>q.prompt===draft.sourcePrompt);picker.value=String(match?.i??'');}
        batch=null;field('result').hidden=true;field('rows').replaceChildren();status.textContent='';
        if(draft.candidates?.length){
          const questions=draft.candidates.map(candidate=>engine.verifyCandidate(draft.sourcePrompt,candidate));
          batch={mode:draft.mode,questions};showBatch(draft.selected);
          status.textContent=draft.mode==='ai'?'已恢復經驗算的 AI 變式。':'已恢復經驗算的規則變式。';
        }
        note.textContent=savedText;
      }catch(error){
        pause((error.message||'未能讀取草稿。')+' 請重試讀取。',false);
      }finally{lock(false);}
    }
    field('load').addEventListener('click',()=>restore(false));
    field('replace').addEventListener('click',()=>{paused=false;tools.hidden=true;changed();drain();});
    root.addEventListener('focusout',()=>{if(dirty && !paused)drain();});
    const beforeLeave=event=>{if((dirty && !paused)||inFlight){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeLeave);
    window.addEventListener('hashchange',()=>{window.removeEventListener('beforeunload',beforeLeave);drain();},{once:true});
    function invalidate() {
      generationId=crypto.randomUUID();saveId=crypto.randomUUID();
      batch=null;field('result').hidden=true;field('rows').replaceChildren();status.textContent='';changed();
    }
    prompt.addEventListener('input',invalidate);
    picker?.addEventListener('change',()=>{prompt.value=paper.questions[Number(picker.value)].prompt;invalidate();});
    function lock(working) {
      busy=working;
      for(const input of root.querySelectorAll('button,input,select,textarea'))input.disabled=working;
      if(!working && batch)field('save').disabled=!field('rows').querySelector('input:checked');
    }
    field('generate').addEventListener('click',async()=>{
      if(busy)return;
      const original=prompt.value.trim();
      lock(true);field('result').hidden=true;batch=null;
      status.textContent=request?'正在產生及核對同類題…':'正在驗算同類題…';
      try {
        engine.inspect(original);
        const proposal=request?await request({prompt:original,requestId:generationId}):null;
        if(!root.isConnected)return;
        batch=engine.generate(original,proposal?.mode==='ai'?proposal.candidates:null);
        saveId=crypto.randomUUID();
        status.textContent=batch.mode==='ai'?'兩道 AI 變式已通過逐題驗算。':request?
          (proposal?.notice || 'AI 建議未通過同類及答案核對。')+'已改用規則生成，兩題均已驗算。':'兩道規則變式均已驗算。';
        showBatch([0,1]);changed();
      }catch(error){status.textContent=error.message || '暫時未能產生同類題。';}
      finally{lock(false);}
    });
    field('rows').addEventListener('change',()=>{saveId=crypto.randomUUID();field('save').disabled=!field('rows').querySelector('input:checked');changed();});
    field('title').addEventListener('input',()=>{saveId=crypto.randomUUID();changed();});
    field('save').addEventListener('click',async()=>{
      if(busy || !batch || !field('title').reportValidity())return;
      const chosen=[...field('rows').querySelectorAll('input:checked')].map(box=>batch.questions[Number(box.value)]);
      if(!chosen.length)return;
      lock(true);
      try{
        await drain();
        const saved=await save({requestId:saveId,title:field('title').value.trim(),sourcePrompt:prompt.value.trim(),questions:chosen});
        if(!paused){
          try {const result=await writeDraft({...empty(),revision});revision=result.draft.revision;}
          catch{/* The new paper exists; a newer draft in another window takes precedence. */}
        }
        dirty=false;clearTimeout(timer);
        if(root.isConnected)onSaved(saved.paper);
      }catch(error){status.textContent=error.message || '試卷未能儲存，請重試。';}
      finally{lock(false);}
    });
    restore(true);
  }
  globalThis.EduEquationPracticeUI={mount,open,suitable};
})();
