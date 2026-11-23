(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const paper = AssessmentData.papers.find(p => p.id === 's1-geometry-reasoning-v1');
  const scripts = {
    q3: [
      ['∠ACB = 180° − 128° = 52°，因為 B、C、D 在同一直線上。', 'AB = AC，所以 ∠ABC = ∠ACB = 52°。', '三角形內角和為 180°，∠BAC = 180° − 52° − 52° = 76°。'],
      ['C 點內角和 128° 加起來是 180°，所以內角是 52°。', '我用 180° − 52° = 128°，所以頂角是 128°。'],
      ['頂角是 76°。']
    ],
    q5: [
      ['長方形對邊相等，所以底 CD = 12 cm。', 'AB 平行 CD，E 沿 AB 移動時，到 CD 的垂直距離都是 8 cm。', '面積 = 12 × 8 ÷ 2 = 48 cm²，所以 AE 的長度不影響答案。'],
      ['底是 CD，即 12 cm。', '因為 AE 是 5 cm，面積 = 12 × 5 ÷ 2 = 30 cm²。'],
      ['面積 = 12 × 8 ÷ 2 = 48 cm²。']
    ]
  };
  const questions = paper.questions.filter(q => Object.hasOwn(scripts, q.id));
  const names = ['示例學生 A', '示例學生 B', '示例學生 C'];
  const storageKey = 'eduflow-hk-preview:question-queue:v1';
  const prefix = 'eduflow-hk-preview:question-queue:v2:';
  const memory = new Map();
  let persistent = true;
  let active = questions[0], pupil = 0;
  let displayed, stale = false;

  function validPoint(value, criterion) {
    return Number.isInteger(value) && value >= 0 && value <= criterion.max;
  }
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    let raw;
    try { raw = localStorage.getItem(key); } catch { persistent = false; }
    try { return JSON.parse(raw || 'null'); } catch { return null; }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      memory.delete(key);
    } catch { memory.set(key,value); persistent = false; }
  }
  function savePlace() {
    const place = {question:active.id,pupil};
    write(prefix+'place',place);
    try { sessionStorage.setItem(prefix+'place',JSON.stringify(place)); } catch {}
  }
  let place;
  try { place = JSON.parse(sessionStorage.getItem(prefix+'place')); } catch {}
  place ||= read(prefix+'place') || read(storageKey) || {};
  active = questions.find(q => q.id === place.question) || active;
  pupil = Number.isInteger(place.pupil) && names[place.pupil] ? place.pupil : 0;

  // Store independent fields. A confirmation applies only to the exact field versions reviewed.
  const rowKey = index => prefix+active.id+'/'+index+'/';
  function record(index = pupil) {
    const key = rowKey(index);
    const old = read(storageKey)?.records?.[active.id+'/'+index] || {};
    const values = active.criteria.map((c,i) => {
      const field = read(key+'mark/'+i);
      const value = field ? field.value : old.marks?.[i];
      return {value:validPoint(value,c)?value:null,id:field?.id||''};
    });
    const feedback = read(key+'comment');
    const comment = String((feedback ? feedback.value : old.comment) || '').slice(0,400);
    const version = JSON.stringify([values,comment,feedback?.id||'']);
    const proof = read(key+'confirmation');
    const marks = values.map(field=>field.value);
    const legacy = !feedback && values.every(field=>!field.id) && old.confirmed===true;
    return {marks,comment,version,confirmed:marks.every(m=>m!==null) && (proof ? proof===version : legacy)};
  }
  function conflict() {
    stale = true;
    announce('這份作答已在另一個分頁修改。請先讀取最新評分再繼續。');
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = '讀取最新評分';
    button.addEventListener('click',()=>{render();announce('已讀取最新評分。');});
    byId('queue-status').append(' ',button);
  }
  function current() {
    const latest = record();
    if (stale || latest.version!==displayed.version || latest.confirmed!==displayed.confirmed) {
      conflict(); return false;
    }
    return true;
  }
  function edit(field,value,message) {
    if (!current()) return;
    write(rowKey(pupil)+field,{value,id:crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random()});
    const latest = record();
    const expectedComment = field==='comment' ? value : displayed.comment;
    if (latest.comment!==expectedComment || latest.marks.some((n,i)=>n!==(field==='mark/'+i ? value : displayed.marks[i]))) {
      conflict(); return;
    }
    displayed=latest; updateSummary(); announce(message);
  }
  function announce(message) {
    byId('queue-status').textContent = message + (persistent ? '' : ' 目前瀏覽器無法儲存，離開頁面後記錄可能會遺失。');
  }
  function updateSummary() {
    const row = displayed, complete = row.marks.every(n => n !== null);
    const sum = row.marks.reduce((a,b) => a + (b ?? 0), 0);
    byId('total').textContent = (complete ? sum : '待評') + ' / ' + active.criteria.reduce((n,c) => n + c.max,0);
    const done = names.filter((_,i) => record(i).confirmed).length;
    byId('count').textContent = '本題已確認 ' + done + ' / ' + names.length + ' 份';
    for (let i = 0; i < names.length; i++) byId('pupil').options[i].textContent = names[i] + (record(i).confirmed ? ' · 已確認' : ' · 待確認');
    byId('save-next').textContent = names.some((_,i) => i !== pupil && !record(i).confirmed) ? '保存並改下一份' : '確認本題評分';
    byId('results').hidden = done === 0;
    const list = byId('record-list');
    list.replaceChildren();
    names.forEach((name,i) => {
      const item = record(i);
      if (!item.confirmed) return;
      const li = document.createElement('li'), button = document.createElement('button');
      li.textContent = name + ' · ' + item.marks.reduce((a,b) => a+b,0) + ' 分';
      button.type = 'button';
      button.textContent = '查看評分';
      button.setAttribute('aria-label','查看' + name + '的評分');
      button.addEventListener('click', () => { pupil = i; savePlace(); render(); byId('pupil').focus(); });
      li.append(button); list.append(li);
    });
  }
  function render() {
    const row = record();
    displayed = row; stale = false;
    byId('question').value = active.id; byId('pupil').value = String(pupil);
    byId('prompt').textContent = active.prompt;
    const img = byId('figure');
    img.hidden = !active.diagram;
    if (active.diagram) { img.src = active.diagram; img.alt = active.diagramAlt || '題目示意圖'; }
    byId('solution').textContent = active.solution;
    byId('script-title').textContent = names[pupil] + '的作答（謄錄）';
    byId('working').replaceChildren(...scripts[active.id][pupil].map(line => {
      const p = document.createElement('p'); p.textContent = line; return p;
    }));
    const fields = byId('points'); fields.replaceChildren();
    active.criteria.forEach((c,i) => {
      const label = document.createElement('label'), select = document.createElement('select');
      label.textContent = c.label;
      select.required = true; select.add(new Option('待評',''));
      for (let n = 0; n <= c.max; n++) select.add(new Option(n + ' 分',String(n)));
      select.value = row.marks[i] === null ? '' : String(row.marks[i]);
      select.addEventListener('change', () => {
        edit('mark/'+i,select.value === '' ? null : Number(select.value),'評分草稿已更新。');
      });
      label.append(select); fields.append(label);
    });
    byId('feedback').value = row.comment;
    updateSummary(); announce('');
  }
  questions.forEach(q => byId('question').add(new Option('第 ' + (paper.questions.indexOf(q)+1) + ' 題 · ' + (q.id==='q3'?'等腰三角形':'三角形面積'),q.id)));
  names.forEach((name,i) => byId('pupil').add(new Option(name,String(i))));
  byId('question').addEventListener('change', e => {
    active = questions.find(q => q.id === e.target.value);
    const next = names.findIndex((_,i) => !record(i).confirmed);
    pupil = next < 0 ? 0 : next; savePlace(); render();
  });
  byId('pupil').addEventListener('change', e => { pupil = Number(e.target.value); savePlace(); render(); });
  byId('feedback').addEventListener('input', e => {
    edit('comment',e.target.value,'評語草稿已更新。');
  });
  byId('mark-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!current()) return;
    const row = displayed;
    if (!row.marks.every((m,i) => validPoint(m,active.criteria[i]))) return;
    write(rowKey(pupil)+'confirmation',row.version);
    if (!record().confirmed) { conflict(); return; }
    const saved = names[pupil];
    const next = names.map((_,i) => (pupil+i+1)%names.length).find(i => !record(i).confirmed);
    if (next !== undefined) pupil = next;
    savePlace(); render();
    announce(next === undefined ? '三份作答已全部確認，可查看評分或選另一題。' : saved + '的評分已確認，現正批改' + names[pupil] + '。');
    if (next !== undefined) byId('script-title').focus();
  });
  window.addEventListener('storage',event=>{
    if (event.storageArea!==localStorage || event.key===prefix+'place') return;
    if (event.key!==null && event.key!==storageKey && !event.key.startsWith(prefix)) return;
    updateSummary();
    current();
  });
  render();
})();
