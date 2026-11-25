(() => {
  'use strict';
  const language = window.EduFlowMathsLanguage;
  const catalog = new Map(window.AssessmentData.papers.map(paper => [paper.id, paper]));
  const library = document.querySelector('.hk-library');
  const get = selector => library.querySelector(selector);
  const tabs = [...library.querySelectorAll('.hk-subjects a')];
  const list = get('.hk-list');
  const picker = get('#hk-picker');
  const reading = get('.hk-reading');
  let currentPaper, index;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function marks(question) {
    return question.criteria.reduce((total, criterion) => total + criterion.max, 0);
  }

  function renderQuestion() {
    const q = currentPaper.questions[index];
    const body = get('.hk-excerpt');
    const en = language.entry(currentPaper, q);
    const prompt = element('p', undefined, 'hk-prompt');
    prompt.innerHTML = language.text(q.prompt,en?.prompt);
    body.replaceChildren(prompt);
    if (q.options) {
      const choices = element('ol');
      choices.type = 'A';
      choices.append(...q.options.map(value => element('li', value)));
      body.append(choices);
    }
    if (q.diagram) {
      const figure = element('figure');
      const image = element('img');
      image.src = q.diagram;
      image.alt = q.diagramAlt || '試題附圖';
      figure.append(image);
      body.append(figure);
    }
    const source = q.source;
    if (source?.type === 'adapted' || source?.dataReference) {
      const credit = element('details', undefined, 'hk-credit');
      credit.append(element('summary', source.type === 'adapted' ? '選題出處與授權' : '數據出處'));
      const notice = element('p', source.rights || source.dataTitle);
      const reference = element('a', source.item || '查看數據表');
      reference.href = source.reference && source.type === 'adapted' ? source.reference : source.dataReference;
      notice.append(' ', reference);
      if (source.licenseUrl) {
        const license = element('a', source.license);
        license.href = source.licenseUrl;
        notice.append(' · ', license);
      }
      credit.append(notice);
      body.append(credit);
    }
    get('.hk-topic').innerHTML = language.text(q.topic || '試題',en?.topic);
    get('.hk-page').textContent = '第 ' + (index + 1) + ' / ' + currentPaper.questions.length + ' 題';
    get('.hk-question-score').textContent = marks(q) + ' 分';
    get('[data-step="-1"]').disabled = index === 0;
    get('[data-step="1"]').disabled = index === currentPaper.questions.length - 1;
  }

  function selectPaper(id) {
    currentPaper = catalog.get(id);
    index = 0;
    picker.value = id;
    for (const button of list.children) button.setAttribute('aria-pressed', String(button.dataset.id === id));
    get('.hk-paper-title').innerHTML = language.text(currentPaper.title,language.title(currentPaper));
    get('.hk-paper-language').innerHTML = language.paperControls(currentPaper);
    const count = currentPaper.questions.length;
    const total = currentPaper.questions.reduce((sum, q) => sum + marks(q), 0);
    get('.hk-paper-meta').textContent = count + ' 題　·　' + total + ' 分　·　' + currentPaper.minutes + ' 分鐘';
    get('.hk-open').href = 'assessment.html#paper/' + encodeURIComponent(id);
    get('.hk-compose').href = 'assessment.html#question-bank/' + encodeURIComponent(id);
    renderQuestion();
  }

  function showGroup(key) {
    const tab = tabs.find(a => a.hash === '#' + key) || tabs[0];
    for (const a of tabs) {
      if (a === tab) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    const papers = tab.dataset.papers.split(' ').map(id => catalog.get(id)).filter(Boolean);
    list.replaceChildren();
    picker.replaceChildren();
    if (!papers.length) {
      reading.hidden = true;
      get('.hk-list-title').textContent = '此課題暫無試卷';
      return;
    }
    reading.hidden = false;
    get('.hk-list-title').textContent = tab.textContent.trim();
    get('.hk-list-count').textContent = papers.length + ' 份卷';
    for (const paper of papers) {
      const button = element('button');
      button.type = 'button';
      button.dataset.id = paper.id;
      const languageNote = language.available(paper) ? ' · 中英雙語' : '';
      button.append(element('span', paper.title), element('small', paper.questions.length + ' 題 · ' + paper.minutes + ' 分鐘' + languageNote));
      list.append(button);
      picker.add(new Option(paper.title + languageNote, paper.id));
    }
    selectPaper(papers[0].id);
  }

  function fromHash() {
    const key = location.hash.slice(1);
    if (key === 'archive') {
      get('.hk-references').open = true;
      get('#archive').open = true;
      get('#archive').scrollIntoView({block: 'start'});
    } else {
      showGroup(key);
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    if (button) selectPaper(button.dataset.id);
  });
  picker.addEventListener('change', () => selectPaper(picker.value));
  get('.hk-pager').addEventListener('click', event => {
    const button = event.target.closest('button[data-step]');
    if (button && !button.disabled) {
      index += Number(button.dataset.step);
      renderQuestion();
    }
  });
  for (const tab of tabs) {
    tab.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (location.hash !== tab.hash) history.pushState(null, '', tab.hash);
      showGroup(tab.hash.slice(1));
    });
  }
  window.addEventListener('hashchange', fromHash);
  if (location.hash === '#archive') showGroup('');
  fromHash();
})();
