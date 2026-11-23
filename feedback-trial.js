(() => {
  'use strict';
  const key='eduflow-feedback-example-v1', el=id=>document.getElementById(id);
  const modes=['score','short','detailed'];
  const examples={
    base:'盈利 45 元算對了。「佔成本」問的是每 100 元成本能賺多少，所以用 300 元作分母。45 ÷ 300 × 100% = 15%。',
    step:'保留你算出的 45 元；把算式的分母從售價 345 元換為成本 300 元，再把商乘以 100%。',
    ask:'你已找出盈利。題目說「佔成本」，哪個金額應當作 100%？請用它做分母再算一次。'
  };
  const initial={short:'算對盈利；再核對百分率的基數。',detailed:'你用售價減去成本，正確算出賺了 45 元。你列的 45 ÷ 345 是以售價為基數，題目問的卻是盈利佔成本多少。請把分母換成 300，重算並寫上百分號。'};
  let state={mode:'short',comment:initial.short,request:'base',preview:'',released:null};
  try {
    const old=JSON.parse(localStorage.getItem(key));
    if(old && modes.includes(old.mode) && typeof old.comment==='string' && Object.hasOwn(examples,old.request)) {
      state={mode:old.mode,comment:old.comment.slice(0,500),request:old.request,
        preview:old.preview===examples[old.request]?old.preview:'',
        released:old.released && modes.includes(old.released.mode) && typeof old.released.comment==='string'?old.released:null};
    }
  } catch {}
  function save(note=''){
    try {localStorage.setItem(key,JSON.stringify(state));el('message').textContent=note;}
    catch{el('message').textContent=note+' 本次只保留在頁面，重開後需要再試。';}
  }
  function draw() {
    const student=location.hash==='#student';
    el('teacher-view').hidden=student;el('student-view').hidden=!student;
    document.querySelectorAll('main nav a').forEach(a=>{if(a.hash===(student?'#student':'#teacher'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    el('mode').value=state.mode;el('request').value=state.request;el('comment').value=state.comment;
    el('writing').hidden=state.mode==='score';el('preview').hidden=!state.preview;el('proposal').textContent=state.preview;
    const r=state.released;
    el('released').hidden=!r;el('not-published').hidden=!!r;
    el('student-comment').textContent=r?.mode==='score'?'':r?.comment||'';el('points').hidden=r?.mode!=='detailed';
  }
  el('comment').oninput=e=>{state.comment=e.target.value;state.preview='';el('preview').hidden=true;save();};
  el('mode').onchange=e=>{state.mode=e.target.value;
    if (initial[state.mode] && Object.values(initial).includes(state.comment)) state.comment=initial[state.mode];state.preview='';save();draw();};
  el('request').onchange=e=>{state.request=e.target.value;state.preview='';save();draw();};
  el('rewrite').onclick=()=>{state.preview=examples[state.request];save('請比較現有評語和改寫範例。');draw();};
  el('adopt').onclick=()=>{state.comment=state.preview;state.preview='';save('已採用新評語，學生會在下次發布後看到。');draw();};
  el('publish').onclick=()=>{state.released={mode:state.mode,comment:state.mode==='score'?'':state.comment};save('已發布示例成績。');location.hash='student';draw();};
  window.addEventListener('hashchange',draw);draw();
})();
