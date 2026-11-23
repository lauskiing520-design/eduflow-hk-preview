(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sample=window.EduDepartmentSample,api='/api/eduflow/ai/';
  const labels={pending:'待審核',approved:'已入庫',rejected:'已退回'};
  let auth,state,source,busy=false,loadVersion=0;
  async function read(path,options={}) {
    const response=await fetch(api+path,{cache:'no-store',credentials:'same-origin',...options});
    if(response.status===401)throw Error('請先登入教師工作台，再查看科組。');
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'讀取失敗，請重新載入。');
    return data;
  }
  function problem(q){
    const figure=/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(q.diagram||'')?
      '<img src="'+q.diagram+'" alt="'+esc(q.diagramAlt||'試題附圖')+'">':'';
    return '<p>'+esc(q.prompt)+'</p>'+figure+
      (q.kind==='choice'?'<ol>'+q.options.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>':'')+
      '<details><summary>解法及評分點</summary><p>'+esc(q.solution)+'</p><ul>'+
      q.criteria.map(c=>'<li>'+esc(c.label)+'（'+esc(c.max)+' 分）</li>').join('')+'</ul>'+
      (q.sourceNotice?'<p>'+esc(q.sourceNotice)+'</p>':'')+'</details>';
  }
  function selected(){
    const q=source?.questions.find(q=>q.id===$('question').value);
    $('selected').innerHTML=q?'<div class="detail">'+problem(q)+'</div>':'';
    $('topic').value=q?.topic||'';
    $('rights').value='';
  }
  async function chooseSource(){
    const version=++loadVersion,id=$('source').value;
    source=null;
    $('question').replaceChildren();
    selected();
    if(!id)return;
    try{
      const paper=sample?sample.source(id):(await read('papers/'+encodeURIComponent(id))).paper;
      if(version!==loadVersion)return;
      source=paper;
      for(const [i,q] of paper.questions.entries())$('question').add(new Option('第 '+(i+1)+' 題 · '+q.prompt.slice(0,35),q.id));
      selected();
    }catch(error){if(version===loadVersion)$('message').textContent=error.message}
  }
  function entries(){
    const items=state.items.filter(i=>!$('status').value||i.status===$('status').value);
    $('items').innerHTML=items.map(i=>{
      const p=i.paper,q=p.questions[0];
      const controls=state.canReview && i.status==='pending'?
        '<div class="tools"><button type="button" class="primary" data-review="approve">批准入庫</button>'+
        '<label>退回原因<input maxlength="400"></label><button type="button" data-review="reject">退回修改</button></div>':'';
      return '<article class="entry" data-id="'+esc(i.id)+'"><h3>'+esc(q.topic)+' · '+labels[i.status]+'</h3>'+
        '<p>'+esc(p.year)+' '+esc(p.subject)+' · '+esc(p.title)+' · '+esc(i.author)+'</p><div class="detail">'+problem(q)+'</div>'+
        '<small>'+ (i.rights==='original'?'原創題目':'已確認科組分享權限')+(i.reviewer?' · 已由 '+esc(i.reviewer)+' 審核':'')+
        '</small>'+(i.feedback?'<p>科組意見：'+esc(i.feedback)+'</p>':'')+controls+'</article>';
    }).join('')||'<p>目前沒有符合這個狀態的題目。</p>';
  }
  async function change(body){
    if(busy)return;
    busy=true;
    document.querySelectorAll('button').forEach(el=>el.disabled=true);
    try{
      state=sample?sample.change(body):await read('question-bank/department',{method:'POST',
        headers:{'Content-Type':'application/json','X-Eduflow-CSRF':auth.csrf_token},body:JSON.stringify({...body,account_id:auth.account_id})});
      $('status').value='';
      entries();
      $('message').textContent=body.action==='approve'?'已入庫，同科組老師可在選題組卷使用。':body.action==='reject'?'已退回，提題老師可查看原因。':
        '已儲存送審記錄，請在下方查看狀態。';
    }catch(error){$('message').textContent=error.message}
    finally{busy=false;document.querySelectorAll('button').forEach(el=>el.disabled=false)}
  }
  $('submit').addEventListener('submit',e=>{e.preventDefault();if(source)change({action:'submit',paperId:source.id,
    questionId:$('question').value,topic:$('topic').value.trim(),rights:$('rights').value})});
  $('items').addEventListener('click',e=>{
    const b=e.target.closest('[data-review]');if(!b)return;
    const row=b.closest('[data-id]');change({action:b.dataset.review,id:row.dataset.id,feedback:row.querySelector('input').value.trim()});
  });
  $('role').addEventListener('change',()=>{sample.setLead($('role').value==='lead');state=sample.state();entries()});
  $('status').addEventListener('change',entries);
  $('source').addEventListener('change',chooseSource);
  $('question').addEventListener('change',selected);
  async function start(){
    try{
      if(sample){state=sample.state();$('trial').hidden=false}
      else{auth=await read('session');state=await read('question-bank/department')}
      $('department').textContent=state.department;
      $('library').hidden=$('submission').hidden=false;
      $('submit').hidden=!state.sources.length;$('source-empty').hidden=!!state.sources.length;
      for(const p of state.sources)$('source').add(new Option(p.year+' · '+p.title,p.id));
      $('message').textContent='';
      entries();await chooseSource();
    }catch(error){$('message').textContent=error.message}
  }
  start();
})();
