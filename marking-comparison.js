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
  const empty = () => ({scores:{}, exposure:'', revealed:false, seenHere:false});

  function restore() {
    const result = empty();
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey));
      if (!raw || typeof raw !== 'object') return result;
      for (const point of points) {
        const saved = raw.scores?.[point.id];
        if (grades.has(saved)) result.scores[point.id] = saved;
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
      list.append(li);
    }
    el('basis').textContent = state.exposure === 'unseen' ? '你在查看本例建議前已確認評分。' : '你已看過本例建議，這次記錄為再次覆核。';
    el('summary').textContent = '可逐項比較 ' + comparable + ' 項，其中 ' + agree + ' 項一致、' +
      (comparable - agree) + ' 項有分差；另有 ' + (points.length - comparable) + ' 項待判讀。';
  }
  function draw() {
    form.hidden = state.revealed;
    report.hidden = !state.revealed;
    if (state.revealed) renderReport();
    else { el('differences').replaceChildren(); renderForm(); }
  }
  for (const radio of form.elements.exposure) {
    radio.addEventListener('change', () => { state.exposure = radio.value; save(); });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state.revealed = true;
    state.seenHere = true;
    save(); draw();
    el('report-title').focus();
  });
  el('retry').addEventListener('click', () => {
    state = {...empty(), seenHere:true, exposure:'seen'};
    save(); draw();
    el('grade-' + points[0].id).focus();
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) { state = restore(); draw(); }
  });
  draw();
})();
