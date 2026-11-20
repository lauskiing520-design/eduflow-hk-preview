(() => {
  const get = id => document.getElementById(id);
  const criteria = [
    { title: '展開括號', reason: '學生正確寫出 3x − 6。', score: 1 },
    { title: '移項及化簡', reason: '學生把 6 加回兩邊，得 3x = 18。', score: 1 },
    { title: '最後答案', reason: '學生寫 x = 9；正確答案是 x = 6。', score: 0 }
  ];
  const selects = [];
  const total = () => selects.reduce((sum, select) => sum + Number(select.value), 0);
  criteria.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'criterion';
    row.innerHTML = `<div class="rubric-row"><label for="mark-${index}">${item.title}</label><select id="mark-${index}"><option value="0">0 / 1 分</option><option value="1">1 / 1 分</option></select></div><p>示例建議 ${item.score} 分 · ${item.reason}</p><button type="button" aria-controls="line${index + 1}">對照原稿第 ${index + 1} 行</button>`;
    const select = row.querySelector('select');
    select.value = String(item.score);
    selects.push(select);
    select.addEventListener('change', () => { get('total').textContent = total() + ' / 3 分'; });
    row.querySelector('button').addEventListener('click', () => {
      document.querySelectorAll('#paper .selected').forEach(line => line.classList.remove('selected'));
      const line = get('line' + (index + 1));
      line.classList.add('selected');
      line.tabIndex = -1;
      line.focus({ preventScroll: true });
      line.scrollIntoView({block:'nearest'});
    });
    get('rubric').append(row);
  });
  function show(view) {
    get(view === 'studentView' ? 'studentPaper' : 'teacherPaper').append(get('paper'));
    get('paper').querySelector('.selected')?.classList.remove('selected');
    if (view !== 'teacherView') selectTool('read');
    ['teacherView','confirmed','studentView'].forEach(id => { get(id).hidden = id !== view; });
    const heading = get(view).querySelector('h2');
    heading.tabIndex = -1;
    heading.focus();
  }
  get('reviewForm').addEventListener('submit', event => {
    event.preventDefault();
    get('confirmedScore').textContent = '示例學生 A · ' + total() + ' / 3 分';
    show('confirmed');
  });
  get('studentButton').addEventListener('click', () => {
    const current = total();
    const previous = 1;
    get('studentScore').textContent = '本題得分 ' + current + ' / 3 分';
    get('previousScore').textContent = previous + ' / 3 分';
    get('currentScore').textContent = current + ' / 3 分';
    const difference = current - previous;
    get('progressChange').textContent = difference === 0
      ? '兩次練習得分相同。'
      : '今次比上次' + (difference > 0 ? '多' : '少') + '得 ' + Math.abs(difference) + ' 分。';
    get('breakdown').replaceChildren(...criteria.map((item, i) => {
      const li = document.createElement('li');
      li.textContent = item.title + '：' + selects[i].value + ' / 1 分';
      return li;
    }));
    get('studentFeedback').textContent = get('feedback').value.trim() || '老師未填寫評語。';
    show('studentView');
  });
  get('revise').addEventListener('click', () => show('teacherView'));
  get('back').addEventListener('click', () => show('teacherView'));

  const paper = get('paper');
  const ink = get('inkLayer');
  const history = [];
  let tool = 'read';
  let stroke = null;
  function selectTool(next) {
    tool = next;
    paper.classList.toggle('inking', next !== 'read');
    document.querySelectorAll('[data-tool]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.tool === next));
    });
  }
  function updateButtons() {
    get('undo').disabled = history.length === 0;
    get('clear').disabled = ink.children.length === 0;
  }
  function remember(nodes) {
    history.push(nodes);
    if (history.length > 100) history.shift();
    updateButtons();
  }
  function point(event) {
    const pt = new DOMPoint(event.clientX,event.clientY).matrixTransform(paper.getScreenCTM().inverse());
    return {x:Math.round(pt.x*10)/10, y:Math.round(pt.y*10)/10};
  }
  function eraseAt(pt) {
    const hit = new DOMPoint(pt.x, pt.y);
    for (const path of [...ink.children]) {
      if (path.isPointInStroke(hit)) path.remove();
    }
  }
  function draw(event) {
    if (event.pointerId !== stroke?.id) return;
    const pt = point(event);
    if (tool === 'erase') {
      const last = stroke.last || pt;
      const steps = Math.max(1, Math.ceil(Math.hypot(pt.x-last.x,pt.y-last.y)/2));
      for (let i=1;i<=steps;i++) eraseAt({x:last.x+(pt.x-last.x)*i/steps, y:last.y+(pt.y-last.y)*i/steps});
    } else {
      stroke.points.push(pt.x + ' ' + pt.y);
      stroke.path.setAttribute('d', 'M' + stroke.points.join(' L'));
    }
    stroke.last = pt;
  }
  function finish(event) {
    if (event.pointerId !== stroke?.id) return;
    if (tool !== 'erase' || ink.children.length !== stroke.before.length) remember(stroke.before);
    stroke = null;
    updateButtons();
  }
  document.querySelectorAll('[data-tool]').forEach(button =>
    button.addEventListener('click', () => selectTool(button.dataset.tool)));
  paper.addEventListener('pointerdown', event => {
    if (tool === 'read' || stroke || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    paper.setPointerCapture(event.pointerId);
    stroke = {id:event.pointerId, before:[...ink.children], points:[]};
    if (tool !== 'erase') {
      const pt = point(event);
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('class',tool);
      stroke.path = path;
      stroke.points.push(pt.x+' '+pt.y);
      ink.append(path);
    }
    draw(event);
  });
  paper.addEventListener('pointermove', draw);
  paper.addEventListener('pointerup', event => {draw(event);finish(event);});
  paper.addEventListener('pointercancel', finish);
  paper.addEventListener('lostpointercapture', finish);
  get('undo').addEventListener('click', () => {
    if (!history.length) return;
    ink.replaceChildren(...history.pop());
    updateButtons();
  });
  get('clear').addEventListener('click', () => {
    if (!ink.children.length) return;
    remember([...ink.children]);
    ink.replaceChildren();
    updateButtons();
  });
  get('printReport').addEventListener('click', () => window.print());
})();
