/* The pupil's questions and the teacher's read-only record share the same citations. */
(function(root){
  'use strict';
  const openPanels=new WeakMap();
  const el=(tag,text,css)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(css)node.className=css;return node;};
  function action(text,handler,css){const node=el('button',text,css);node.type='button';node.onclick=handler;return node;}
  function transcript(records,{showEvidence,toggleEvidence,onReply}={}){
    const list=el('ol',null,'hand-log');
    for(const turn of records||[]){
      const entry=el('li'),reply=turn.reply||{};
      const phase=turn.submitted?'交回後':'作答中',source=turn.source==='ai'?'學校 AI 引導':'按讀數引導';
      entry.append(el('small',phase+' · '+source),el('p',turn.question,'hand-question'),el('p',reply.text,'hand-answer'));
      if(reply.followUp)entry.append(el('p',reply.followUp,'hand-prompt'));
      if(Array.isArray(reply.citations)&&reply.citations.length){
        const refs=el('ul',null,'hand-refs');
        for(const c of reply.citations){
          const row=el('li'),times=Array.isArray(c.times)?c.times.map(v=>Number(v).toFixed(2)).join(' ／ '):'';
          const one=[1,2,3].includes(c.trial)&&Number.isFinite(c.times?.[c.trial-1]);
          const caption=c.length+' cm · '+(one?'第 '+c.trial+' 次 · '+c.times[c.trial-1].toFixed(2):times)+' 秒';
          row.append(el('span',caption));
          if(showEvidence){
            const go=action('查看圖中讀數',()=>showEvidence(c),'hand-locate');
            go.setAttribute('aria-label','查看 '+c.length+' cm 圖中讀數');row.append(go);
          }
          if(toggleEvidence){
            const use=action('加入我的證據',()=>toggleEvidence(c.length),'hand-add');
            use.dataset.handLength=String(c.length);row.append(use);
          }
          refs.append(row);
        }
        entry.append(refs);
      }
      const teacher=el('section',null,'hand-teacher');
      function showReply(){
        const comment=turn.teacherReply?.comment;
        teacher.replaceChildren();
        if(comment)teacher.append(el('strong','老師回覆'),el('p',comment));
      }
      showReply();entry.append(teacher);
      if(onReply){
        const editor=el('details',null,'hand-teacher-editor'),open=el('summary',turn.teacherReply?'修改老師回覆':'回覆這條提問');
        const label=el('label','回覆這位學生'),input=el('textarea'),result=el('p',null,'hand-status');
        input.rows=2;input.maxLength=600;input.value=turn.teacherReply?.comment||'';label.append(input);
        result.setAttribute('role','status');
        const save=action('送出老師回覆',async()=>{
          if(!input.value.trim()||save.disabled)return;
          save.disabled=true;input.readOnly=true;result.textContent='正在儲存回覆…';
          try{
            const updated=await onReply(turn,input.value.trim());
            if(!updated?.teacherReply?.comment)throw Error('未能確認回覆，請重試。');
            turn.teacherReply=updated.teacherReply;showReply();input.value=turn.teacherReply.comment;
            open.textContent='修改老師回覆';editor.open=false;result.textContent='學生可在這條提問查看老師回覆。';
          }catch(e){result.textContent=e.message||'未能儲存回覆，請重試。';}
          finally{input.readOnly=false;save.disabled=!input.value.trim()||input.value.trim()===turn.teacherReply?.comment;}
        });
        save.disabled=true;input.oninput=()=>{save.disabled=!input.value.trim()||input.value.trim()===turn.teacherReply?.comment;};
        editor.append(open,label,save);entry.append(editor,result);
      }
      list.append(entry);
    }
    return list;
  }
  function mount({discussion,getView,showEvidence,returnToAnswer,toggleEvidence,getEvidence,data}){
    const box=el('details',null,'science-hand'),summary=el('summary'),heading=el('strong','舉手提問');
    const count=el('span',null,'hand-count');summary.append(heading,count);
    const body=el('div',null,'hand-body'),log=el('div'),lab=el('label','想問哪一步？'),input=el('textarea');
    input.maxLength=400;input.rows=2;input.placeholder='例如：這兩組的平均時間不同，就能說一定是翼長造成的嗎？';lab.append(input);
    const send=action('送出問題',sendQuestion,'primary'),status=el('p',null,'hand-status');
    status.setAttribute('role','status');
    const starters=el('div',null,'hand-starters');
    for(const example of [data.rows[0].length+' cm 組的三次讀數為甚麼不同？','怎樣比較兩組的穩定程度？']){
      starters.append(action(example,()=>{input.value=example;input.focus();update();}));
    }
    const actions=el('div',null,'hand-actions');actions.append(send);
    const refresh=action('查看最新回覆',async()=>{
      if(pending||typeof discussion.refresh!=='function')return;
      pending=true;update();status.textContent='正在讀取最新回覆…';
      try{
        const response=await discussion.refresh();
        if(!Array.isArray(response?.discussions))throw Error('未能讀取提問紀錄。');
        records=response.discussions;discussion.records=records;
        if(disposed){openPanels.get(discussion)?.();return;}
        const latest=records.filter(t=>t.teacherReply?.comment).at(-1);
        draw();status.textContent=latest?'已讀取老師回覆。':'目前未有老師回覆。';
        if(latest&&latest!==records.at(-1))log.querySelector('.hand-earlier').open=true;
      }catch(e){if(!disposed)status.textContent=e.message||'未能讀取回覆，請重試。';}
      finally{pending=false;if(!disposed)update();}
    },'hand-back');
    if(typeof discussion.refresh==='function')actions.append(refresh);
    if(returnToAnswer)actions.append(action('返回撰寫實驗建議',returnToAnswer,'hand-back'));
    body.append(log,lab,starters,actions,status);box.append(summary,body);
    let records=discussion.records||[],pending=false,retry=null,disposed=false;
    function update(){
      const full=records.length>=12;
      count.textContent=records.length?'已記錄 '+records.length+' 次':'問實驗方法或圖中讀數';
      send.disabled=pending||full||!input.value.trim();
      refresh.disabled=pending;
      input.readOnly=pending||full;starters.hidden=full||records.length>0;
      if(full&&!pending)status.textContent='已記錄這節課的 12 次提問，可重看讀數和回答。';
    }
    function updateEvidence(){
      if(!getEvidence)return;
      const refs=getEvidence();
      for(const b of log.querySelectorAll('[data-hand-length]')){
        const length=Number(b.dataset.handLength),chosen=refs.includes(length);
        b.textContent=chosen?'已加入我的證據':'加入我的證據';b.setAttribute('aria-pressed',String(chosen));
        b.setAttribute('aria-label',length+' cm · '+b.textContent);
        b.disabled=!chosen&&refs.length>=2;
        b.title=b.disabled?'已引用兩組讀數，可先移除其中一組。':'';
      }
    }
    function draw(){
      const list=transcript(records,{showEvidence,toggleEvidence});
      if(records.length>1){
        const history=el('details',null,'hand-earlier'),earlier=el('ol',null,'hand-log');
        const prior=Array.from(list.children).slice(0,-1);
        earlier.append(...prior);history.append(el('summary','較早的 '+prior.length+' 次提問'),earlier);
        log.replaceChildren(history,list);
      }else log.replaceChildren(list);
      update();updateEvidence();
    }
    async function sendQuestion(){
      const question=input.value.trim();if(!question||pending||records.length>=12)return;
      if(!retry||retry.question!==question){
        retry={question,id:crypto.randomUUID().replaceAll('-',''),view:{...getView()}};
      }
      pending=true;update();status.textContent='正在查看這份實驗記錄…';
      try{
        const result=await discussion.ask(question,retry.id,retry.view);
        if(!Array.isArray(result?.discussions))throw Error('未能讀取提問紀錄，請再試一次。');
        records=result.discussions;discussion.records=records;
        if(disposed){openPanels.get(discussion)?.();return;}
        retry=null;input.value='';draw();status.textContent='回應已記錄。';
      }catch(e){if(!disposed)status.textContent=e.message||'暫未取得回應。你可以重新送出這條問題。';}
      finally{pending=false;if(!disposed)update();}
    }
    input.oninput=()=>{if(input.value.trim()!==retry?.question)retry=null;update();};
    const resume=()=>{records=discussion.records||[];draw();};
    openPanels.set(discussion,resume);draw();
    return {node:box,updateEvidence,destroy:()=>{
      disposed=true;if(openPanels.get(discussion)===resume)openPanels.delete(discussion);
    }};
  }
  root.EduScienceHandUI=Object.freeze({mount,transcript});
})(window);
