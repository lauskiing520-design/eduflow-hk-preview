'use strict';
/* Class assignment on the public, static preview. All class and pupil counts are examples. */
window.createPreviewClasses = function ({papers, esc, href, heading, sheetQuestion, sourceCredit, syncPapers, hasReport, onRecordsChange}) {
  const rooms = [
    {id:'1a', name:'中一 A 班', year:'中一', pupils:26},
    {id:'1b', name:'中一 B 班', year:'中一', pupils:25},
    {id:'2a', name:'中二 A 班', year:'中二', pupils:27},
    {id:'2b', name:'中二 B 班', year:'中二', pupils:26}
  ];
  const storeKey = 'eduflow-hk-preview:class-assignments:v1';
  const recordPrefix = 'eduflow-hk-preview:assignment:v2:';
  const dueDrafts = new Map();
  const paperById = new Map(papers.map(p => [p.id, p]));
  const roomById = new Map(rooms.map(r => [r.id, r]));
  let records = [], persistent = true;

  function roster(room) {
    return Array.from({length:room.pupils}, (_,index) => {
      const number=String(index+1).padStart(2,'0');
      return {id:room.id+'-'+number,label:'示例學生 '+number};
    });
  }
  function recipients(row) {
    const members=roster(roomById.get(row.room));
    return row.studentIds ? members.filter(s=>row.studentIds.includes(s.id)) : members;
  }
  function validRecord(row) {
    const room = roomById.get(row?.room);
    return room && paperById.get(row.paper)?.year === room.year &&
      (row.studentIds === undefined || (Array.isArray(row.studentIds) && row.studentIds.length>0 &&
        recipients(row).length===row.studentIds.length)) &&
      (row.due === '' || /^\d{4}-\d{2}-\d{2}$/.test(row.due));
  }
  function read() {
    syncPapers();
    if (!persistent) return;
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || '[]');
      const merged = new Map();
      const add = row => { if(validRecord(row)) merged.set(detailRoute(row),row); };
      if(Array.isArray(raw)) raw.forEach(add);
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(recordPrefix)) continue;
        try { add(JSON.parse(localStorage.getItem(key))); } catch { continue; }
      }
      records = Array.from(merged.values());
    } catch { persistent = false; }
  }
  function note() {
    return persistent ? '這是示例班級，派卷記錄只保存在這個瀏覽器。' : '這是示例班級。目前瀏覽器無法儲存記錄，重新載入後需再派卷。';
  }
  function dueLabel(row) { return row.due ? '截止日期 '+row.due : '未設截止日期'; }
  function detailRoute(row) { return 'sample-homework/'+row.room+'/'+row.paper; }
  function assignment(p, roomId) {
    if (!p) return heading('找不到這份試卷','請從試卷列表重新選卷。')+href('papers','返回試卷列表',true);
    const choices = rooms.filter(room => room.year === p.year);
    if (!choices.length) return heading('暫無適用的示例班級','請從試卷列表選擇中一或中二試卷。')+href('papers','返回試卷列表',true);
    const selected = choices.find(room => room.id===roomId) || choices[0];
    const options = choices.map(room => {
      const assigned = records.some(row => row.room===room.id && row.paper===p.id);
      return `<label class="sample-room-option"><input type="radio" name="room" value="${room.id}" ${room===selected?'checked':''} required><span><strong>${room.name}</strong><small>${room.pupils} 名示例學生${assigned?' · 已派此卷':''}</small></span></label>`;
    }).join('');
    const fromRoom = selected.id === roomId;
    return heading('派給班級',note(),fromRoom?'class-papers/'+selected.id:'paper/'+p.id,fromRoom?'返回班級選卷':'返回試卷預覽')+
      `<p><a id="class-preflight" href="#preflight/${esc(p.id)}/${selected.id}">查看出卷前檢查</a></p><form id="sample-assignment" class="sample-assignment" data-paper="${esc(p.id)}">
      <header><p>${esc(p.year)} · ${esc(p.subject)} · ${p.questions.length} 題</p><h2>${esc(p.title)}</h2></header>
      <fieldset><legend>派給哪一班？</legend><div class="sample-room-options">${options}</div></fieldset>
      <div data-dispatch-recipients></div>
      <label class="sample-due">截止日期（選填）<input type="date" name="due"></label>
      <div class="actions"><button class="button primary" type="submit">確認派卷</button></div></form>`;
  }
  function classPapers(room) {
    if (!room) return classList();
    const options = new Map();
    for (const paper of paperById.values()) {
      if (paper.year!==room.year) continue;
      if (!options.has(paper.subject)) options.set(paper.subject,[]);
      options.get(paper.subject).push(`<option value="${esc(paper.id)}">${esc(paper.title)}（${paper.questions.length} 題）</option>`);
    }
    const groups = [...options].map(([subject,entries])=>`<optgroup label="${esc(subject)}">${entries.join('')}</optgroup>`).join('');
    return heading('為'+room.name+'選卷','選好試卷後，可以設定截止日期。','classes','返回班級與作業')+
      `<form id="sample-room-papers" class="sample-assignment" data-room="${room.id}">
       <label class="sample-paper-picker">選擇${room.year}試卷<select name="paper" required>${groups}</select></label>
       <div class="actions"><button type="submit" class="button primary">下一步：確認班級</button></div></form>`;
  }
  function classList() {
    return heading('班級與作業',note())+`<section class="sample-rooms">${rooms.map(room => {
      const items = records.filter(row => row.room===room.id);
      return `<article><div class="sample-class-head"><div><h2>${room.name}</h2><p>${room.pupils} 名示例學生 · ${items.length} 份作業</p></div><div class="actions">${href('class-papers/'+room.id,'為這班選卷',true)}${href('sample-student/'+room.id,'查看學生頁面')}</div></div>
      ${items.length ? '<ul>'+items.map(row => '<li><a href="#'+detailRoute(row)+'">'+esc(paperById.get(row.paper).title)+'</a><span>'+esc(dueLabel(row))+'</span></li>').join('')+'</ul>' : ''}</article>`;
    }).join('')}</section>`;
  }
  function missingAssignment(roomId,paperId) {
    const room = roomById.get(roomId), paper = paperById.get(paperId);
    if (!room || !paper || paper.year!==room.year) {
      return heading('找不到這份示例作業','請從班級與作業重新選擇。')+href('classes','查看示例班級',true);
    }
    return heading('這個瀏覽器沒有這份派卷記錄',room.name+' · '+paper.title)+
      '<section class="sample-assignment"><p>派卷只記錄在老師試用時的瀏覽器。在這裡確認派卷後，就能切換到學生視角查看同一份試題。</p><div class="actions">'+
      href('assign/'+paper.id+'/'+room.id,'試派這份卷給'+room.name,true)+href('paper/'+paper.id,'先看試題')+'</div></section>';
  }
  function receipt(roomId, paperId) {
    const row = records.find(item => item.room===roomId && item.paper===paperId);
    if (!row) return missingAssignment(roomId,paperId);
    const room = roomById.get(row.room), p = paperById.get(row.paper);
    const members=recipients(row), whole=members.length===room.pupils;
    return heading('已派給'+room.name,note(),'classes','班級與作業')+
      `<section class="sample-assignment"><header><p>${room.name} · ${esc(p.subject)}</p><h2>${esc(p.title)}</h2></header>
      <p>${p.questions.length} 題 · ${esc(dueLabel(row))}</p>
      <p>派發對象：${whole?'全班（'+members.length+' 人）':members.map(s=>s.label).join('、')+'（'+members.length+' 人）'}</p>
      <div class="actions">${href('sample-student/'+room.id+(whole?'':'/'+members[0].id),'查看學生收到的作業',true)}<a class="button" href="paper-receipt.html?room=${room.id}&amp;paper=${encodeURIComponent(p.id)}${whole?'':'&amp;pupils='+members.map(s=>s.id.slice(-2)).join(',')}">列印答題紙及收件</a>${whole && hasReport(p)?href('sample-analysis/'+p.id+'/'+room.id,'看本卷的示例錯答'):''}${href('assign/'+p.id+'/'+room.id,whole?'更改截止日期':'補派或更改截止日期')}</div></section>`;
  }
  function student(roomId,studentId) {
    const room = roomById.get(roomId);
    if (!room) return heading('找不到這個示例班級','請返回班級與作業重新選擇。','classes','班級與作業');
    const members=roster(room), person=studentId?members.find(s=>s.id===studentId):members[0];
    if(!person) return heading('找不到這位示例學生',room.name,'sample-student/'+room.id,'返回班級學生頁面');
    const items = records.filter(row => row.room===room.id && recipients(row).some(s=>s.id===person.id));
    return heading('我的作業',room.name+' · 示例學生視角','classes','返回班級與作業')+
      `<label class="sample-paper-picker">查看哪位示例學生的作業？<select id="sample-student-id" data-room="${room.id}">${members.map(s=>`<option value="${s.id}" ${s.id===person.id?'selected':''}>${s.label}</option>`).join('')}</select></label><section class="sample-rooms">${items.length ? items.map(row => {
        const p = paperById.get(row.paper);
        return `<article class="sample-class-head"><div><h2>${esc(p.title)}</h2><p>${esc(p.subject)} · ${p.questions.length} 題 · ${esc(dueLabel(row))}</p></div>${href('sample-paper/'+room.id+'/'+p.id+(studentId?'/'+person.id:''),'查看試題')}</article>`;
      }).join('') : '<article><h2>暫無作業</h2><p>老師派卷後，這裡會列出試卷和截止日期。</p>'+href('class-papers/'+room.id,'返回教師視角選卷',true)+'</article>'}</section>`;
  }
  function studentPaper(roomId,paperId,studentId) {
    const row=records.find(row=>row.room===roomId && row.paper===paperId);
    if (!row) return missingAssignment(roomId,paperId);
    const person=studentId||roster(roomById.get(roomId))[0].id;
    const back='sample-student/'+roomId+(studentId?'/'+encodeURIComponent(studentId):'');
    if(!recipients(row).some(s=>s.id===person))return heading('這位學生沒有收到此卷','可返回學生頁查看已獲派的作業。',back,'返回我的作業');
    const p = paperById.get(paperId), room = roomById.get(roomId);
    return heading(p.title,room.name+' · '+p.questions.length+' 題 · 學生試題預覽（只供閱覽）',back,'返回我的作業',window.EduFlowMathsLanguage.title(p))+
      window.EduFlowMathsLanguage.paperControls(p)+sourceCredit(p)+'<section class="paper-screen-questions" aria-label="試題">'+
      p.questions.map((q,i) => sheetQuestion(p,q,i)).join('')+'</section>';
  }
  document.addEventListener('change', event => {
    if(event.target.id==='sample-student-id') location.hash='sample-student/'+event.target.dataset.room+'/'+event.target.value;
    if (event.target.matches('#sample-assignment input[name="room"]')) restoreDue(event.target.form);
    if (event.target.matches('#sample-assignment [name="due"], #sample-assignment [name="recipient"], #sample-assignment [name="recipientScope"]')) updateSubmit(event.target.form);
  });
  function existing(form) {
    return records.find(x => x.room===form.elements.room.value && x.paper===form.dataset.paper);
  }
  function updateSubmit(form) {
    const row = existing(form);
    const selected=EduFlowClassRecipients.selected(form);
    const extending=row?.studentIds && (!selected || selected.some(id=>!row.studentIds.includes(id)));
    form.querySelector('button[type="submit"]').textContent = !row?'確認派卷':extending?'確認補派':row.due===form.elements.due.value?'查看已派作業':'更新截止日期';
  }
  function restoreDue(form) {
    const row = existing(form);
    const room = form.elements.room.value;
    const panel=form.querySelector('[data-dispatch-recipients]'), members=roster(roomById.get(room));
    panel.innerHTML=row && !row.studentIds ? '<p>已派發至全班（'+members.length+' 人）</p>' : EduFlowClassRecipients.fields(members,esc,row?.studentIds);
    if(row?.studentIds) for(const box of panel.querySelectorAll('input:checked')) box.disabled=true;
    EduFlowClassRecipients.sync(form);
    form.elements.due.value = dueDrafts.get(form.dataset.paper+'/'+room) ?? row?.due ?? '';
    document.getElementById('class-preflight').href='#preflight/'+form.dataset.paper+'/'+room;
    updateSubmit(form);
  }
  document.addEventListener('click', event => {
    if (!event.target.closest('#class-preflight')) return;
    const form = document.getElementById('sample-assignment');
    dueDrafts.set(form.dataset.paper+'/'+form.elements.room.value,form.elements.due.value);
  });
  function carryDue(from,to,room) {
    if(dueDrafts.has(from+'/'+room)) dueDrafts.set(to+'/'+room,dueDrafts.get(from+'/'+room));
  }
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id==='sample-room-papers') {
      event.preventDefault();
      const room = roomById.get(form.dataset.room), paper = paperById.get(form.elements.paper.value);
      if (room && paper && paper.year===room.year) location.hash='assign/'+paper.id+'/'+room.id;
      return;
    }
    if (form.id!=='sample-assignment') return;
    event.preventDefault();
    read();
    const row = {room:form.elements.room.value,paper:form.dataset.paper,due:form.elements.due.value};
    EduFlowClassRecipients.sync(form);
    const prior=existing(form), selected=EduFlowClassRecipients.selected(form);
    if(selected && (!prior || prior.studentIds)){
      const ids=[...new Set([...(prior?.studentIds||[]),...selected])].sort();
      if(ids.length!==roomById.get(row.room)?.pupils) row.studentIds=ids;
    }
    if (!validRecord(row) || !form.reportValidity()) return;
    if (prior?.due===row.due && JSON.stringify(prior.studentIds)===JSON.stringify(row.studentIds)) { location.hash=detailRoute(row); return; }
    records = [row,...records.filter(x => x.room!==row.room || x.paper!==row.paper)];
    try { localStorage.setItem(recordPrefix+row.room+'/'+row.paper,JSON.stringify(row)); persistent=true; } catch { persistent=false; }
    dueDrafts.delete(row.paper+'/'+row.room);
    location.hash = detailRoute(row);
  });
  function route(view,key,num,person) {
    if (!['assign','classes','class-papers','sample-homework','sample-student','sample-paper'].includes(view)) return null;
    read();
    switch (view) {
      case 'assign': return ['派給班級',assignment(paperById.get(key),num)];
      case 'classes': return ['班級與作業',classList()];
      case 'class-papers': return ['為班級選卷',classPapers(roomById.get(key))];
      case 'sample-homework': return ['派卷記錄',receipt(key,num)];
      case 'sample-student': return ['我的作業',student(key,num)];
      case 'sample-paper': return ['學生試題預覽',studentPaper(key,num,person)];
    }
  }
  function refreshRecords() {
    const view = location.hash.slice(1).split('/')[0];
    if (['classes','sample-student','sample-paper','sample-homework'].includes(view)) onRecordsChange();
  }
  window.addEventListener('storage',event=>{
    if (event.key===storeKey || event.key?.startsWith(recordPrefix) || event.key===null) refreshRecords();
  });
  window.addEventListener('pageshow',event=>{ if(event.persisted) refreshRecords(); });
  return {route,restoreDue,carryDue,registerPaper(paper){paperById.set(paper.id,paper)}};
};
