(() => {
  'use strict';
  const engine=window.EduScienceReadings;
  const exampleTitle='量度出水速率';
  function mount(root,{load,store,finish,openPaper,local=false}) {
    root.innerHTML='<a class="sheet-back" href="science.html">返回中一科學</a><header class="page-heading"><h1>用實驗讀數出卷</h1><p>貼上時間及量筒讀數，核對折線圖和四道探究題後，便可派給班內學生。</p></header>'+
      '<form class="scan-box" data-readings-form><label class="answer-label">試卷名稱<input name="title" maxlength="120" required></label>'+
      '<label class="answer-label">數據來源<select name="source"><option value="measured">班級實測</option><option value="simulated">模擬數據</option></select></label>'+
      '<label class="answer-label">時間（秒）和累積體積（cm³）<textarea rows="6" name="readings" maxlength="600" placeholder="0, 0&#10;10, 40&#10;25, 85" aria-describedby="readings-help" required></textarea></label>'+
      '<p id="readings-help" class="field-note">每行一組，用逗號或空格分隔。也可從試算表貼入兩欄，共 3 至 8 行。時間用整秒，體積可填至小數後一位。</p>'+
      '<div class="actions"><button class="button primary">預覽試卷</button><button type="button" class="button" data-sample>填入示例讀數</button></div></form>'+
      '<p role="status" data-draft></p><div class="actions" data-recovery hidden><button type="button" class="button" data-reload></button></div>'+
      '<p role="status" data-feedback></p><section class="scan-box" data-preview hidden><h2 data-title></h2><p>4 題 · 11 分 · 18 分鐘</p>'+
      '<figure class="question-figure"><img data-graph alt=""><figcaption data-caption></figcaption></figure><div data-questions></div>'+
      '<div class="actions"><button type="button" class="button primary" data-finish>儲存並預覽試卷</button></div></section>';
    const el=s=>root.querySelector(s), form=el('form'), fields=form.elements, note=el('[data-draft]'), feedback=el('[data-feedback]');
    const get=()=>({title:fields.title.value, source:fields.source.value,readings:fields.readings.value});
    const put=data=>{for(const k of ['title','source','readings'])fields[k].value=data[k];};
    let revision=0, ready=false, conflict=false, syncing=null, timer=0, saved='', previewed='', saveId=crypto.randomUUID();
    const stateLabel=local?'已儲存在這個瀏覽器。':'已儲存至伺服器，可在另一部電腦繼續。';
    function recovery(message,label) {
      conflict=true; note.textContent=message; el('[data-reload]').textContent=label; el('[data-recovery]').hidden=false;
    }
    function flush() {
      clearTimeout(timer);
      if(syncing)return syncing;
      if(!ready || conflict)return Promise.resolve();
      syncing=(async()=>{
        for (;;) {
          const spec=get(), serialized=JSON.stringify(spec);
          if(serialized===saved)break;
          try {
            const {draft}=await store({revision,...spec});
            revision=draft.revision; saved=serialized; note.textContent=stateLabel;
          } catch(err) {
            recovery(err.message || '草稿暫時未能儲存。',err.code==='science_draft_conflict'?'讀取最新草稿':'重試儲存');
            break;
          }
        }
      })().finally(()=>{syncing=null;});
      return syncing;
    }
    function invalidate(){
      el('[data-preview]').hidden=true; feedback.textContent=''; previewed=''; saveId=crypto.randomUUID();
      if(!ready || conflict)return;
      note.textContent='正在儲存草稿…'; clearTimeout(timer);timer=setTimeout(flush,350);
    }
    async function restore() {
      form.inert=true;
      try {
        const {draft}=await load();
        if(!root.isConnected)return;
        put(draft); revision=draft.revision; saved=JSON.stringify(get()); ready=true; conflict=false;
        el('[data-recovery]').hidden=true; el('[data-preview]').hidden=true;previewed='';
        note.textContent=revision?stateLabel:(local?'展示站的草稿及試卷會儲存在這個瀏覽器。':'讀數會自動儲存在教師帳戶。');
      } catch(err) {recovery(err.message || '未能讀取草稿。','重新讀取草稿');}
      finally{form.inert=!ready;}
    }
    el('[data-reload]').onclick=()=>{
      if(!ready || el('[data-reload]').textContent!=='重試儲存')return restore();
      conflict=false;el('[data-recovery]').hidden=true;flush();
    };
    form.oninput=invalidate;
    el('[data-sample]').onclick=()=>{put({title:exampleTitle,source:'simulated',readings:engine.sample});invalidate();};
    form.onsubmit=event=>{
      event.preventDefault();
      try {
        const paper=engine.build(get()), q=paper.questions[0], body=el('[data-questions]');
        el('[data-title]').textContent=paper.title; el('[data-graph]').src=q.diagram;el('[data-graph]').alt=q.diagramAlt;
        el('[data-caption]').textContent=q.diagramCaption; body.replaceChildren();
        for(const [i,item] of paper.questions.entries()){
          const article=document.createElement('article'), title=document.createElement('h3'), prompt=document.createElement('p');
          title.textContent='第 '+(i+1)+' 題　'+item.topic;prompt.textContent=item.prompt;
          const details=document.createElement('details'), summary=document.createElement('summary'), answer=document.createElement('p'), list=document.createElement('ul');
          summary.textContent='查看解法及評分點';answer.textContent=item.solution;
          for(const c of item.criteria){const li=document.createElement('li');li.textContent=c.label+'（'+c.max+' 分）';list.append(li);}
          details.append(summary,answer,list);article.append(title,prompt,details);body.append(article);
        }
        previewed=JSON.stringify(get());el('[data-preview]').hidden=false;feedback.textContent='試卷已按目前讀數重新計算。';el('[data-preview]').scrollIntoView({block:'start'});
      }catch(err){feedback.textContent=err.message;el('[data-preview]').hidden=true;}
    };
    el('[data-finish]').onclick=async()=>{
      if(!previewed || previewed!==JSON.stringify(get()))return;
      const button=el('[data-finish]');button.disabled=true;form.inert=true;
      try {
        await flush();
        const {paper}=await finish({requestId:saveId,...get()});
        if(root.isConnected)openPaper(paper);
      }catch(err){feedback.textContent=err.message || '未能儲存試卷。';}
      finally{button.disabled=false;form.inert=false;}
    };
    // Flush a pending edit when the teacher uses an in-app navigation link.
    window.addEventListener('hashchange',()=>flush(),{once:true});
    restore();
  }
  window.EduScienceReadingsUI={mount};
})();
