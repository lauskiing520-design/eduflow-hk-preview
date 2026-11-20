'use strict';
/* Class assignment on the public, static preview. All class and pupil counts are examples. */
window.createPreviewClasses = function ({papers, esc, href, heading, sheetQuestion, sourceCredit}) {
  const rooms = [
    {id:'1a', name:'中一 A 班', year:'中一', pupils:26},
    {id:'1b', name:'中一 B 班', year:'中一', pupils:25},
    {id:'2a', name:'中二 A 班', year:'中二', pupils:27},
    {id:'2b', name:'中二 B 班', year:'中二', pupils:26}
  ];
  const storeKey = 'eduflow-hk-preview:class-assignments:v1';
  const paperById = new Map(papers.map(p => [p.id, p]));
  const roomById = new Map(rooms.map(r => [r.id, r]));
  let records = [], persistent = true;

  function validRecord(row) {
    const room = roomById.get(row?.room);
    return room && paperById.get(row.paper)?.year === room.year &&
      (row.due === '' || /^\d{4}-\d{2}-\d{2}$/.test(row.due));
  }
  function read() {
    if (!persistent) return;
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || '[]');
      records = Array.isArray(raw) ? raw.filter(validRecord) : [];
    } catch { persistent = false; }
  }
  function note() {
    return persistent ? '這是示例班級，派卷記錄只保存在這個瀏覽器。' : '這是示例班級。目前瀏覽器無法儲存記錄，重新載入後需再派卷。';
  }
  function dueLabel(row) { return row.due ? '截止日期 '+row.due : '未設截止日期'; }
  function detailRoute(row) { return 'sample-homework/'+row.room+'/'+row.paper; }
  function assignment(p) {
    if (!p) return heading('找不到這份試卷','請從試卷列表重新選卷。')+href('papers','返回試卷列表',true);
    const choices = rooms.filter(room => room.year === p.year);
    if (!choices.length) return heading('暫無適用的示例班級','請從試卷列表選擇中一或中二試卷。')+href('papers','返回試卷列表',true);
    const options = choices.map((room,i) => {
      const assigned = records.some(row => row.room===room.id && row.paper===p.id);
      return `<label class="sample-room-option"><input type="radio" name="room" value="${room.id}" ${i===0?'checked':''} required><span><strong>${room.name}</strong><small>${room.pupils} 名示例學生${assigned?' · 已派此卷':''}</small></span></label>`;
    }).join('');
    return heading('派給班級',note(),'paper/'+p.id,'返回試卷預覽')+
      `<form id="sample-assignment" class="sample-assignment" data-paper="${esc(p.id)}">
      <header><p>${esc(p.year)} · ${esc(p.subject)} · ${p.questions.length} 題</p><h2>${esc(p.title)}</h2></header>
      <fieldset><legend>選擇收卷班級</legend><div class="sample-room-options">${options}</div></fieldset>
      <label class="sample-due">截止日期（選填）<input type="date" name="due"></label>
      <div class="actions"><button class="button primary" type="submit">確認派卷</button>${href('papers','返回選卷')}</div></form>`;
  }
  function classList() {
    return heading('班級與作業',note())+`<section class="sample-rooms">${rooms.map(room => {
      const items = records.filter(row => row.room===room.id);
      return `<article><div class="sample-class-head"><div><h2>${room.name}</h2><p>${room.pupils} 名示例學生 · ${items.length} 份作業</p></div>${href('sample-student/'+room.id,'查看學生頁面')}</div>
      ${items.length ? '<ul>'+items.map(row => '<li><a href="#'+detailRoute(row)+'">'+esc(paperById.get(row.paper).title)+'</a><span>'+esc(dueLabel(row))+'</span></li>').join('')+'</ul>' : '<p>尚未派卷。<a href="#papers">前往試卷列表選卷</a></p>'}</article>`;
    }).join('')}</section>`;
  }
  function receipt(roomId, paperId) {
    const row = records.find(item => item.room===roomId && item.paper===paperId);
    if (!row) return heading('這個瀏覽器沒有這份示例作業','可從試卷列表選卷，再派給示例班級。')+href('papers','選擇試卷',true);
    const room = roomById.get(row.room), p = paperById.get(row.paper);
    return heading('已派給'+room.name,note(),'classes','班級與作業')+
      `<section class="sample-assignment"><header><p>${room.name} · ${esc(p.subject)}</p><h2>${esc(p.title)}</h2></header>
      <p>${p.questions.length} 題 · ${esc(dueLabel(row))}</p>
      <div class="actions">${href('sample-student/'+room.id,'查看學生收到的作業',true)}${href('classes','查看班級作業')}</div></section>`;
  }
  function student(roomId) {
    const room = roomById.get(roomId);
    if (!room) return heading('找不到這個示例班級','請返回班級與作業重新選擇。','classes','班級與作業');
    const items = records.filter(row => row.room===room.id);
    return heading('我的作業',room.name+' · 示例學生視角','classes','返回班級與作業')+
      `<section class="sample-rooms">${items.length ? items.map(row => {
        const p = paperById.get(row.paper);
        return `<article class="sample-class-head"><div><h2>${esc(p.title)}</h2><p>${esc(p.subject)} · ${p.questions.length} 題 · ${esc(dueLabel(row))}</p></div>${href('sample-paper/'+room.id+'/'+p.id,'查看試題')}</article>`;
      }).join('') : '<article><h2>暫無作業</h2><p>在教師的試卷列表選一份卷派給這個班，這裡就會顯示。</p>'+href('papers','前往選卷',true)+'</article>'}</section>`;
  }
  function studentPaper(roomId,paperId) {
    if (!records.some(row => row.room===roomId && row.paper===paperId)) return student(roomId);
    const p = paperById.get(paperId), room = roomById.get(roomId);
    return heading(p.title,room.name+' · '+p.questions.length+' 題 · 學生試題預覽','sample-student/'+room.id,'返回我的作業')+
      sourceCredit(p)+'<section class="paper-screen-questions" aria-label="試題">'+
      p.questions.map((q,i) => sheetQuestion(p,q,i)).join('')+'</section>';
  }
  document.addEventListener('change', event => {
    if (!event.target.matches('#sample-assignment input[name="room"]')) return;
    restoreDue(event.target.form);
  });
  function restoreDue(form) {
    const row = records.find(x => x.room===form.elements.room.value && x.paper===form.dataset.paper);
    form.elements.due.value = row?.due || '';
  }
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id!=='sample-assignment') return;
    event.preventDefault();
    read();
    const row = {room:form.elements.room.value,paper:form.dataset.paper,due:form.elements.due.value};
    if (!validRecord(row) || !form.reportValidity()) return;
    records = [row,...records.filter(x => x.room!==row.room || x.paper!==row.paper)];
    try { localStorage.setItem(storeKey,JSON.stringify(records)); persistent=true; } catch { persistent=false; }
    location.hash = detailRoute(row);
  });
  function route(view,key,num) {
    if (!['assign','classes','sample-homework','sample-student','sample-paper'].includes(view)) return null;
    read();
    switch (view) {
      case 'assign': return ['派給班級',assignment(paperById.get(key))];
      case 'classes': return ['班級與作業',classList()];
      case 'sample-homework': return ['派卷記錄',receipt(key,num)];
      case 'sample-student': return ['我的作業',student(key)];
      case 'sample-paper': return ['學生試題預覽',studentPaper(key,num)];
    }
  }
  return {route,restoreDue};
};
