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

  function revisionBasis(q) {
    return [q.kind, q.prompt, q.referenceAnswer || '', q.expected ?? null, q.unit || '', q.variable || '',
      q.solution, q.criteria.map(c => [c.id, c.label, c.max, c.mode]), q.options || [], q.diagram || ''];
  }

  function teacherEntry(q) {
    const en = q.teacherEnglish;
    return en?.reviewed && en.prompt && en.solution && q.criteria.every(c => en.criteria?.[c.id]) &&
      JSON.stringify(en.basis) === JSON.stringify(revisionBasis(q)) ? en : null;
  }

  function bindRevision(q, data) {
    if (!data || typeof data.reviewed !== 'boolean' || !Array.isArray(data.labels) || data.labels.length !== q.criteria.length) {
      throw Error('請逐項核對英譯及評分點。');
    }
    function field(value, limit) {
      if (typeof value !== 'string' || value.length > limit || (data.reviewed && !value.trim())) {
        throw Error('確認英譯前，請填妥英文題目、解法及每個評分點。');
      }
      return value.trim();
    }
    return {reviewed:data.reviewed, basis:revisionBasis(q), prompt:field(data.prompt,2500),
      solution:field(data.solution,3500), criteria:Object.fromEntries(q.criteria.map((c,i)=>[c.id,field(data.labels[i],500)]))};
  }

  function entry(paper, question) {
    if (question.teacherEnglish) return teacherEntry(question);
    const origin = question.bankOrigin;
    if (origin?.variant) return null;
    const id = origin?.paperId || paper.englishOrigin || paper.variantOf || paper.id;
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

  window.EduFlowMathsLanguage = {text, controls, entry, title, available, paperControls, bindRevision, teacherEntry};
})();
