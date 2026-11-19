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
      document.querySelectorAll('.demo-lines .selected').forEach(line => line.classList.remove('selected'));
      const line = get('line' + (index + 1));
      line.classList.add('selected');
      line.tabIndex = -1;
      line.focus({ preventScroll: true });
      line.scrollIntoView({block:'nearest'});
    });
    get('rubric').append(row);
  });
  function show(view) {
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
    get('studentScore').textContent = '本題得分 ' + total() + ' / 3 分';
    get('breakdown').replaceChildren(...criteria.map((item, i) => {
      const li = document.createElement('li');
      li.textContent = item.title + '：' + selects[i].value + ' / 1 分';
      return li;
    }));
    get('studentFeedback').textContent = get('feedback').value.trim() || '老師未填寫評語。';
    show('studentView');
  });
  get('revise').addEventListener('click', () => show('teacherView'));
  get('back').addEventListener('click', () => show('confirmed'));
})();
