/* Teacher-facing, published results only. Public samples can use the same renderer. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function render(result) {
    if (!result) return '';
    if (!result.published) return '<p>這題尚未發布成績。發布後即可查看全班的作答分布。</p>';
    const rubric = result.mode === 'rubric';
    const counts = [
      ['答案項取得滿分，其他項失分', result.answerCredit],
      ['沒有填寫答案或步驟', result.blank],
      ['只填寫步驟', result.workingOnly],
      ['其他未能歸類的作答', result.unclassified],
      ['其餘錯答', result.otherWrong],
      [rubric ? '缺少已發布的逐項評分記錄' : '缺少歷史作答快照', result.unavailable]
    ].filter(([, value]) => value > 0);
    const patterns = (result.patterns || []).map(p => {
      const steps = (p.missed || []).map(step =>
        `<li>${escape(step.label)} <span>（本組 ${escape(step.count)} 人未取足分）</span></li>`).join('');
      const examples = (p.examples || []).filter(text => text !== p.answer).map(text => `<code>${escape(text)}</code>`);
      return `<li class="answer-pattern"><div><strong>${escape(p.answer)}</strong> <span>${escape(p.count)} / ${escape(result.published)} 人</span></div>
        ${examples.length ? `<p>卷上寫法　${examples.join('、')}</p>` : ''}
        <p>這組有 ${escape(p.partial)} 人在本題取得部分分數。</p>
        ${steps ? `<p>可講評的評分點</p><ul>${steps}</ul>` : '<p>講評時可用原題條件逐一檢驗這個答案。</p>'}</li>`;
    }).join('');
    const decisions = (result.rubricMisses || []).map(c =>
      `<li><strong>${escape(c.label)}</strong><span>${escape(c.count)} 人未取足分</span></li>`).join('');
    const rubricPanel = '<h3>開放題評分點</h3>' +
      (decisions ? `<ul class="answer-rubric-misses">${decisions}</ul>` :
        result.unavailable === result.published ? '<p>這批已發成績缺少逐項評分記錄，暫時未能計算各點失分人數。</p>' :
        '<p>已有評分依據的答卷，各評分點均獲滿分。</p>') +
      '<p class="field-note">按老師已確認並發布的逐項評分統計。同一份作答可在多個評分點失分。</p>';
    return `<p class="answer-result-line">已發布 ${escape(result.published)} 份 · 滿分 ${escape(result.fullCredit)} 人 · 部分得分 ${escape(result.partialCredit)} 人 · 零分 ${escape(result.zeroCredit)} 人</p>
      ${rubric ? rubricPanel : patterns ? `<ol class="answer-pattern-list">${patterns}</ol>` : '<p>目前沒有兩人或以上重複出現、可辨認的錯答。</p>'}
      ${counts.length ? `<ul class="answer-other-counts">${counts.map(([label,value]) => `<li>${label} <strong>${escape(value)} 人</strong></li>`).join('')}</ul>` : ''}`;
  }

  function report(questions, assigned, figure, sourcePaperId) {
    const data = questions.map((q, i) => ({...q, number:i + 1})).filter(q => q.answerPatterns);
    if (!data.length) return '';
    const total = data[0].answerPatterns.published;
    const metric = q => (q.answerPatterns.mode === 'rubric' ? q.answerPatterns.rubricMisses : q.answerPatterns.patterns)?.[0]?.count || 0;
    const first = data.reduce((best, q) => metric(q) > metric(best) ? q : best);
    const choices = data.map(q => `<option value="${q.number}" ${q === first ? 'selected' : ''}>第 ${q.number} 題${metric(q) ? (q.answerPatterns.mode==='rubric'?' · 有評分點失分':' · 有重複錯答') : ''}</option>`).join('');
    function question(q) {
      const options = q.options?.length ? `<ol>${q.options.map(o => `<li>${escape(o)}</li>`).join('')}</ol>` : '';
      const related = window.EduFlowQuestionBank?.relatedLink?.(window.AssessmentData?.papers || [],q,sourcePaperId);
      return `<p class="answer-prompt">${escape(q.prompt)}</p>${figure ? figure(q) : ''}${options}${render(q.answerPatterns)}` +
        (related ? `<a class="button" href="${escape(related)}">選這題的同類題</a>` : '');
    }
    return `<details class="scan-box class-answer-patterns"${metric(first) ? ' open' : ''}>
      <summary><strong>常見錯答</strong><span>已發布 ${escape(total)} / 全班派卷 ${escape(assigned)} 份</span></summary>
      ${total ? `<label>查看題目 <select data-answer-question>${choices}</select></label><div data-answer-result data-current="${first.number}" aria-live="polite">${question(first)}</div>
      ${data.map(q => `<template data-answer-number="${q.number}">${q === first ? '' : question(q)}</template>`).join('')}
      <p class="field-note">數值及選擇題每題最多顯示三組重複錯答。開放題可逐項查看全班失分人數。</p>`
      : '<p>本次作業已有成績發布後，便可逐題查看重複的錯答。</p>'}</details>`;
  }

  document.addEventListener('change', event => {
    if (!event.target.matches('[data-answer-question]')) return;
    const container = event.target.closest('.class-answer-patterns');
    const target = container.querySelector('[data-answer-result]');
    const templates = Array.from(container.querySelectorAll('template'));
    const slot = templates.find(t => t.dataset.answerNumber === target.dataset.current);
    const next = templates.find(t => t.dataset.answerNumber === event.target.value);
    if (slot && next && slot !== next) {
      slot.content.replaceChildren(...target.childNodes);
      target.replaceChildren(next.content);
      target.dataset.current = event.target.value;
    }
  });
  window.EduAnswerPatterns = {render, report};
})();
