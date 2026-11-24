(() => {
  'use strict';
  const storageKey = 'eduflow-marking-comparison-percent-v1';
  const points = [
    {id:'price', label:'折後售價為 288 元', suggestion:1, evidence:'第 1 行列出 360 × 0.8 = 288 元。'},
    {id:'profit', label:'盈利為 48 元', suggestion:1, evidence:'第 2 行以售價減去成本。'},
    {id:'base', label:'以成本 240 元作分母列式', suggestion:1, evidence:'預設建議引用第 3 行的 48 ÷ 288。算式用了售價 288 元，與此評分點要求的分母不同。'},
    {id:'rate', label:'得出盈利佔成本 20%', suggestion:null, evidence:'第 4 行有塗改，預設建議保留此項給老師判讀。'}
  ];
  const el = id => document.getElementById(id);
  const form = el('mark-form');
  const report = el('report');
  const grades = new Set(['0','1','unreadable']);
  const officialScores = new Set(['0','1','pending']);
  const firstPublication = {price:'1',profit:'1',base:'1',rate:'0'};
  const empty = () => ({
    scores:{}, exposure:'', revealed:false, seenHere:false,
    official:{...firstPublication}, published:{...firstPublication}, decisions:{}, adjusted:{}
  });

  function restore() {
    const result = empty();
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey));
      if (!raw || typeof raw !== 'object') return result;
      for (const point of points) {
        const saved = raw.scores?.[point.id];
        if (grades.has(saved)) result.scores[point.id] = saved;
        const id=point.id, mark=raw.official?.[id], released=raw.published?.[id], decision=raw.decisions?.[id];
        if(officialScores.has(mark))result.official[id]=mark;
        if(released==='0'||released==='1')result.published[id]=released;
        if(decision && decision.score===result.official[id] && ['0','1'].includes(decision.score) &&
            ['kept','changed'].includes(decision.kind))result.decisions[id]={score:decision.score,kind:decision.kind};
        if(raw.adjusted?.[id]===true)result.adjusted[id]=true;
      }
      result.seenHere = raw.seenHere === true;
      result.exposure = ['seen','unseen'].includes(raw.exposure) ? raw.exposure : '';
      result.revealed = raw.revealed === true && result.exposure !== '' &&
        points.every(point => point.id in result.scores);
      if (result.seenHere && !result.revealed) result.exposure = 'seen';
      if (result.revealed) result.seenHere = true;
    } catch { /* Missing or outdated browser records start a new example. */ }
    return result;
  }
  let state = restore();
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      el('storage-warning').hidden = true;
    } catch {
      el('storage-warning').hidden = false;
    }
  }
  function option(value, label) {
    return new Option(label, value);
  }
  for (const [index, point] of points.entries()) {
    const field = document.createElement('div');
    field.className = 'criterion';
    const label = document.createElement('label');
    label.htmlFor = 'grade-' + point.id;
    label.textContent = (index + 1) + '. ' + point.label;
    const select = document.createElement('select');
    select.id = label.htmlFor;
    select.name = point.id;
    select.required = true;
    select.add(option('', '請選擇'));
    select.add(option('1', '1 分'));
    select.add(option('0', '0 分'));
    select.add(option('unreadable', '無法判讀'));
    select.addEventListener('change', () => {
      if (grades.has(select.value)) state.scores[point.id] = select.value;
      else delete state.scores[point.id];
      save();
      updateProgress();
    });
    field.append(label, select);
    el('criteria').append(field);
  }
  function updateProgress() {
    el('progress').textContent = '已填 ' + Object.keys(state.scores).length + ' / ' + points.length + ' 項';
  }
  function renderForm() {
    for (const point of points) el('grade-' + point.id).value = state.scores[point.id] || '';
    for (const input of form.elements.exposure) {
      input.checked = input.value === state.exposure;
      input.disabled = state.seenHere && input.value === 'unseen';
    }
    el('repeat-note').hidden = !state.seenHere;
    updateProgress();
  }
  function needsReview(point){
    return state.scores[point.id]==='unreadable' || point.suggestion===null || Number(state.scores[point.id])!==point.suggestion;
  }
  function scoreLabel(value){
    return value==='pending'?'待判讀':value==='unreadable'?'無法判讀':value===null?'待覆核':value+' 分';
  }
  function publication(){
    const total=points.reduce((sum,p)=>sum+Number(state.published[p.id]),0);
    const changes=points.filter(p=>state.official[p.id]!==state.published[p.id]).length;
    const ungraded=points.filter(p=>state.official[p.id]==='pending').length;
    el('student-score').textContent='示例學生目前可見 '+total+' / 4 分。';
    el('release-note').textContent=!changes?'正式評分與上次發布相同。':
      '有 '+changes+' 項正式評分與上次發布不同。'+(ungraded?'尚有評分點待判讀。':'可把最新分數發回示例學生。');
    el('publish').disabled=!changes||!!ungraded;
  }
  function renderReport() {
    const list = el('differences');
    list.replaceChildren();
    let comparable = 0, agree = 0;
    for (const point of points) {
      const grade = state.scores[point.id];
      let status;
      if (grade === 'unreadable') status = '老師無法判讀';
      else if (point.suggestion === null) status = 'AI 待覆核';
      else {
        comparable++;
        if (Number(grade) === point.suggestion) { agree++; status = '一致'; }
        else status = point.suggestion > Number(grade) ? 'AI 多給分' : 'AI 少給分';
      }
      const li = document.createElement('li');
      const heading = document.createElement('strong');
      heading.textContent = point.label;
      const scores = document.createElement('span');
      const teacher = grade === 'unreadable' ? '無法判讀' : grade + ' 分';
      const ai = point.suggestion === null ? '待覆核' : point.suggestion + ' 分';
      scores.textContent = '你給 ' + teacher + '　·　AI ' + ai + '　·　' + status;
      if (status !== '一致') scores.className = 'flag';
      const evidence = document.createElement('small');
      evidence.textContent = point.evidence;
      li.append(heading, scores, evidence);
      if(needsReview(point)){
        const link=document.createElement('a');
        link.className='point-link';
        link.href='#review/'+point.id;
        link.textContent=state.decisions[point.id]?'已處理 · 查看記錄':'待跟進 · 核對此項';
        link.setAttribute('aria-label',link.textContent+'：'+point.label);
        li.append(link);
      }
      list.append(li);
    }
    el('basis').textContent = state.exposure === 'unseen' ? '你在查看本例建議前已確認評分。' : '你已看過本例建議，這次記錄為再次覆核。';
    el('summary').textContent = '可逐項比較 ' + comparable + ' 項，其中 ' + agree + ' 項一致、' +
      (comparable - agree) + ' 項有分差；另有 ' + (points.length - comparable) + ' 項待判讀。';
    const review=points.filter(needsReview);
    const handled=review.filter(p=>state.decisions[p.id]).length;
    el('followup-count').textContent='待跟進 '+(review.length-handled)+' 項　·　已處理 '+handled+' 項';
    publication();
  }
  function current(){
    const [,mode,id]=location.hash.match(/^#(review|grading)\/(price|profit|base|rate)$/)||[];
    const point=points.find(p=>p.id===id);
    return state.revealed && point && needsReview(point)?{mode,point}:null;
  }
  function renderPoint(view){
    const {mode,point}=view,id=point.id,decision=state.decisions[id],index=points.indexOf(point);
    const editing=mode==='grading';
    el('followup-title').textContent=point.label;
    el('point-context').textContent=(editing?'修改正式評分':'核對分差')+'　·　第 '+(index+1)+' 個評分點';
    el('line-number').textContent='學生作答 · 第 '+(index+1)+' 行';
    el('student-line').textContent=document.querySelectorAll('.working li')[index].textContent;
    el('independent-score').textContent=scoreLabel(state.scores[id]);
    el('ai-score').textContent=scoreLabel(point.suggestion);
    el('official-score').textContent=scoreLabel(state.official[id]);
    el('point-evidence').textContent=point.evidence;
    el('formal-editor').hidden=!editing;
    el('review-controls').hidden=editing;
    el('new-mark').value=state.official[id];
    el('cancel-edit').href='#review/'+id;
    el('edit-link').href='#grading/'+id;
    el('resolve').hidden=!!decision;
    el('reopen').hidden=!decision;
    el('resolve').disabled=state.official[id]==='pending';
    el('resolve').textContent=state.adjusted[id]?'確認新評分，完成跟進':'保留現有正式分，完成跟進';
    el('decision-status').textContent=decision?(decision.kind==='changed'?'已處理，正式評分已修改。':'已處理，保留原有正式分。'):
      state.official[id]==='pending'?'此項正式分待判讀，可稍後繼續跟進。':
      state.adjusted[id]?'修改已儲存。請核對正式分，再確認完成跟進。':'待跟進。請對照原答，再決定保留或修改這一分。';
  }
  function draw() {
    const view=current();
    form.hidden = state.revealed;
    report.hidden = !state.revealed || !!view;
    el('followup').hidden=!view;
    if (state.revealed) renderReport();
    else { el('differences').replaceChildren(); renderForm(); }
    if(view)renderPoint(view);
  }
  for (const radio of form.elements.exposure) {
    radio.addEventListener('change', () => { state.exposure = radio.value; save(); });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state.revealed = true;
    state.seenHere = true;
    history.replaceState(null,'','#results');
    save(); draw();
    el('report-title').focus();
  });
  el('retry').addEventListener('click', () => {
    state = {...empty(), seenHere:true, exposure:'seen', official:state.official, published:state.published};
    history.replaceState(null,'',location.pathname+location.search);
    save(); draw();
    el('grade-' + points[0].id).focus();
  });
  el('save-mark').onclick=()=>{
    const view=current(),newMark=el('new-mark').value;
    if(!view||view.mode!=='grading'||!officialScores.has(newMark))return;
    const id=view.point.id;
    if(newMark!==state.official[id]){
      state.official[id]=newMark;
      delete state.decisions[id];
      state.adjusted[id]=true;
      save();
    }
    location.hash='review/'+id;
  };
  el('resolve').onclick=()=>{
    const view=current();
    if(!view||view.mode!=='review')return;
    const id=view.point.id,mark=state.official[id];
    if(mark==='pending'||state.decisions[id])return;
    state.decisions[id]={score:mark,kind:state.adjusted[id]?'changed':'kept'};
    delete state.adjusted[id];
    save();draw();el('reopen').focus();
  };
  el('reopen').onclick=()=>{
    const view=current();
    if(!view||view.mode!=='review')return;
    delete state.decisions[view.point.id];
    save();draw();el('resolve').focus();
  };
  el('publish').onclick=()=>{
    if(el('publish').disabled)return;
    state.published={...state.official};
    save();draw();el('student-score').setAttribute('tabindex','-1');el('student-score').focus();
  };
  window.addEventListener('hashchange',()=>{
    draw();
    if(state.revealed)(current()?el('followup-title'):el('report-title')).focus();
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) { state = restore(); draw(); }
  });
  draw();
})();
