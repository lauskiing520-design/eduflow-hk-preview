/* The public trial retains edits on this browser, scoped to the source question. */
window.EduPreviewVerification = (() => {
  const choices = [
    ['s1-equations-a','中一方程 A'], ['s1-equations-b','中一方程 B'],
    ['s2-percent-a','中二百分法 A'], ['s2-percent-b','中二百分法 B']
  ];

  function page(paper, room, escape) {
    const route = encodeURIComponent(paper.id) + (room ? '/' + encodeURIComponent(room) : '');
    const selector = room ? '' : '<nav class="av-switch" aria-label="選擇驗算試卷">' +
      choices.map(([id, name]) => '<a href="#verify/' + id + '"' +
        (id === paper.id ? ' aria-current="page"' : '') + '>' + name + '</a>').join('') + '</nav>';
    return '<section class="av-preview"><a class="back-link" href="#preflight/' + route + '">返回出卷前檢查</a>' +
      '<header class="page-heading"><h1>' + escape(paper.title) + '</h1>' +
      '<p>修改題目或參考答案，再按「重新驗算」。試改會保存在這個瀏覽器，原卷仍可從試卷預覽打開。</p></header>' +
      selector + EduAnswerVerification.render(paper) + '</section>';
  }

  function mount(root, paper, room, position, saveCopy) {
    const initialEdits = {};
    const key = index => 'eduflow:verification:v1:' + paper.id + ':' + paper.questions[index].id;
    paper.questions.forEach((q, i) => {
      try {
        const entry = JSON.parse(localStorage.getItem(key(i)));
        if (entry?.source === q.prompt && entry.sourceKey === EduAnswerVerification.reference(q)) initialEdits[i] = entry;
      } catch { /* Storage is optional for the public trial. */ }
    });
    EduAnswerVerification.mount(root, paper, {
      initialEdits, initialIndex:/^q[1-9]\d*$/.test(position) ? Number(position.slice(1))-1 : undefined,
      onSelect(index) {
        const route = '#verify/' + encodeURIComponent(paper.id) + (room ? '/' + room : '') + '/q' + (index+1);
        history.replaceState(history.state, '', route);
      },
      saveLabel:'另存這題到試改本',
      onSave:changes => EduVerificationEditor.edit(root,paper,changes,saveCopy),
      onDraftChange(index, edit) {
        if (edit) {
          const q = paper.questions[index];
          localStorage.setItem(key(index), JSON.stringify({...edit, source:q.prompt, sourceKey:EduAnswerVerification.reference(q)}));
        } else localStorage.removeItem(key(index));
      }
    });
  }
  return {page, mount};
})();
