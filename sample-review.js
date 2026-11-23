/* One fictional pupil and one question. Each publication and request has its own record. */
function createSampleReview(initialFeedback) {
  'use strict';
  const el = id => document.getElementById(id);
  const prefix = 'eduflow-hk-preview:sample-review:v1:';
  const seed = {id:'sample',number:1,marks:[1,1,0],feedback:initialFeedback,ink:[]};
  const types = {correction:'訂正',review:'評分覆核'};
  const memory = new Map();
  let local = true;
  function unavailable() {
    local = false;
    el('demoNote').textContent = '這是虛構答卷。目前瀏覽器無法儲存資料，關閉此頁後請重新試用。';
  }
  function read(key) {
    if (local) {
      try {
        const raw = localStorage.getItem(prefix+key);
        if (raw !== null) { const value = JSON.parse(raw); memory.set(key,value); return value; }
      } catch { unavailable(); }
    }
    return memory.get(key);
  }
  function write(key,value) {
    memory.set(key,value);
    if (local) {
      try {localStorage.setItem(prefix+key,JSON.stringify(value));} catch {unavailable();}
    }
  }
  function ids() {
    const list = read('publications');
    return ['sample',...(Array.isArray(list)?list.filter(id=>typeof id==='string' && /^[a-f0-9-]{36}$/.test(id)):[])];
  }
  function get(id) { return id === 'sample' ? seed : read('pub/'+id); }
  function current() { return get(ids().at(-1)) || seed; }
  function lock(action) {
    return navigator.locks ? navigator.locks.request(prefix+'write',action) : Promise.resolve(action());
  }
  const status = text => {el('reviewStatus').textContent = text;};
  const sum = pub => pub.marks.reduce((a,b)=>a+b,0);
  function publish(values, expected) {
    return lock(() => {
      const prev = current();
      if (prev.id !== expected) return {conflict:true,pub:prev};
      if (prev.feedback === values.feedback && JSON.stringify(prev.marks) === JSON.stringify(values.marks) &&
          JSON.stringify(prev.ink) === JSON.stringify(values.ink)) return {pub:prev};
      const list = ids(), pub = {...values,id:crypto.randomUUID(),number:prev.number+1};
      write('pub/'+pub.id,pub);
      write('publications',[...list.slice(1),pub.id]);
      return {pub};
    });
  }
  const requestKey = (id,type) => 'request/'+id+'/'+type;
  const thread = (id,type) => read(requestKey(id,type));
  const field = (tag,text) => {const n=document.createElement(tag);n.textContent=text;return n;};
  function showReply(container, text, title) {
    const group = document.createElement('div');
    group.className = 'review-message';
    group.append(field('strong',title),field('p',text)); container.append(group);
  }
  function makeThread(pub,type,req,teacher) {
    const article = document.createElement('article');
    article.className = 'review-thread';
    const id = requestKey(pub.id,type), reply = read('reply/'+id);
    article.append(field('h4',types[type] + ' · ' + (reply ? '老師已回覆' : '待老師回覆')));
    article.append(field('small','提交時的成績 · 第 '+pub.number+' 版 · '+sum(pub)+' / 3 分'));
    showReply(article,req.body,'學生');
    if (reply) showReply(article,reply,'老師');
    else if (teacher) {
      const form = document.createElement('form'), label = document.createElement('label');
      const input = document.createElement('textarea'), send = field('button','發送回覆');
      const draft = 'draft/reply/'+id;
      input.rows=3; input.required=true; input.maxLength=1500; input.value=read(draft)||'';
      label.textContent='回覆學生'; label.append(input);
      send.type='submit';send.className='demo-primary';
      input.addEventListener('input',()=>write(draft,input.value));
      form.append(label,send);
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const answer=input.value.trim();
        if (!answer) {input.focus();status('請先填寫回覆。');return;}
        await lock(()=>{
          if (read('reply/'+id)) {status('此項已在另一頁回覆，請查看最新內容。');return;}
          write('reply/'+id,answer);write(draft,'');
          status('學生現在可以查看老師的回覆。');
        }); renderTeacher();
      });
      article.append(form);
    }
    return article;
  }
  function allThreads(container, teacher) {
    const rows = [];
    for (const id of ids().reverse()) {
      const version = get(id); if (!version) continue;
      for (const type of Object.keys(types)) {
        const req = thread(id,type);
        if (typeof req?.body === 'string') rows.push({version,type,req});
      }
    }
    if (teacher) rows.sort((a,b)=>Number(!!read('reply/'+requestKey(a.version.id,a.type))) - Number(!!read('reply/'+requestKey(b.version.id,b.type))));
    container.replaceChildren(...rows.map(({version,type,req})=>makeThread(version,type,req,teacher)));
    if (!rows.length && teacher) container.append(field('p','尚未收到示例學生的訂正或覆核申請。'));
  }
  let displayed = seed;
  function refreshForm() {
    const pub=displayed, type=el('requestType').value;
    const available=Object.keys(types).filter(t=>!thread(pub.id,t));
    el('requestForm').hidden=!available.length;
    for (const option of el('requestType').options) option.disabled=!available.includes(option.value);
    if (!available.length) return;
    const selected=available.includes(type)?type:available[0];
    el('requestType').value=selected;
    el('requestLabel').textContent=selected==='correction'?'訂正後的算式及理由':'希望老師覆核哪一步？請寫明理由。';
    el('requestBody').value=read('draft/'+requestKey(pub.id,selected))||'';
  }
  function renderStudent(pub) {
    displayed=pub;
    allThreads(el('studentThreads'),false);
    refreshForm();
  }
  function renderTeacher() { allThreads(el('teacherThreads'),true); }
  el('requestType').addEventListener('change',refreshForm);
  el('requestBody').addEventListener('input',e=>write('draft/'+requestKey(displayed.id,el('requestType').value),e.target.value));
  el('requestForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const body=el('requestBody').value.trim(), id=displayed.id, type=el('requestType').value;
    if (!body) {status('請先填寫算式或覆核理由。');el('requestBody').focus();return;}
    await lock(()=>{
      if (current().id!==id) {
        status('老師已發布新成績，請先查看新版，再決定是否提交。');
        window.dispatchEvent(new Event('sample-publication-change'));return;
      }
      if (thread(id,type)) {status('這項申請已提交。');return;}
      write(requestKey(id,type),{body});write('draft/'+requestKey(id,type),'');
      status('已提交給示例老師。');
    });
    renderStudent(current());
  });
  window.addEventListener('storage',e=>{
    if (!e.key?.startsWith(prefix) || e.key.startsWith(prefix+'draft/')) return;
    if (e.key===prefix+'publications') window.dispatchEvent(new Event('sample-publication-change'));
    else if (!el('studentView').hidden) renderStudent(current());
    else if (!el('teacherRequests').hidden) renderTeacher();
  });
  return {current, publish, renderStudent, renderTeacher, status};
}
