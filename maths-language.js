(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  let language = 'zh-HK';
  try {
    if (sessionStorage.getItem('eduflow-maths-language') === 'en') language = 'en';
  } catch {}

  function text(chinese, english) {
    if (!english || chinese === english) return escape(chinese);
    return `<span data-maths-zh="${escape(chinese)}" data-maths-en="${escape(english)}" lang="${language}">${escape(language === 'en' ? english : chinese)}</span>`;
  }

  function controls(partial = false) {
    return `<div class="maths-language no-print" role="group" aria-label="試題語言"><span>試題語言</span><button type="button" lang="zh-HK" data-maths-language="zh-HK" aria-pressed="${language === 'zh-HK'}">中文</button><button type="button" lang="en" data-maths-language="en" aria-pressed="${language === 'en'}">English</button>${partial ? '<small>部分試題備有英譯</small>' : ''}</div>`;
  }

  function entry(paper, question) {
    const origin = question.bankOrigin;
    if (origin?.variant) return null;
    const id = origin?.paperId || paper.id;
    const qid = origin?.questionId || question.id;
    const record = window.EduFlowMathsEnglish?.[id]?.questions?.[qid];
    if (!record || record.sourcePrompt !== question.prompt || !Array.isArray(question.criteria)) return null;
    const scoringKey = JSON.stringify([question.solution, ...question.criteria.map(c => [c.id, c.label, c.max, c.mode])]);
    if (record.sourceKey !== scoringKey) return null;
    const original = window.AssessmentData?.papers.find(p => p.id === id)?.questions.find(q => q.id === qid);
    if (!original || original.kind !== question.kind || original.unit !== question.unit ||
        String(original.expected ?? '') !== String(question.expected ?? '') ||
        (question.referenceAnswer || '') !== (original.referenceAnswer || '') ||
        question.diagram !== original.diagram ||
        JSON.stringify(question.options || []) !== JSON.stringify(original.options || [])) return null;
    return record;
  }

  function title(paper) {
    const record = window.EduFlowMathsEnglish?.[paper.id];
    return record?.sourceTitle === paper.title ? record.title : '';
  }

  function available(paper) {
    return paper.questions.length > 0 && paper.questions.every(q => entry(paper, q));
  }

  function paperControls(paper) {
    return paper.questions.some(q => entry(paper, q)) ? controls(!available(paper)) : '';
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-maths-language]');
    if (!button) return;
    language = button.dataset.mathsLanguage === 'en' ? 'en' : 'zh-HK';
    try { sessionStorage.setItem('eduflow-maths-language', language); } catch {}
    for (const field of document.querySelectorAll('[data-maths-en]')) {
      field.textContent = language === 'en' ? field.dataset.mathsEn : field.dataset.mathsZh;
      field.lang = language;
    }
    for (const other of document.querySelectorAll('button[data-maths-language]')) {
      other.setAttribute('aria-pressed', String(other.dataset.mathsLanguage === language));
    }
  });

  window.EduFlowMathsLanguage = {text, controls, entry, title, available, paperControls};
})();
