/* Teacher-facing, published results only. Public samples can use the same renderer. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function render(result) {
    if (!result) return '';
    if (!result.published) return '<p>這題尚未發布成績。發布後即可查看全班的作答分布。</p>';
    const counts = [
      ['答案項取得滿分，其他項失分', result.answerCredit],
      ['沒有填寫答案或步驟', result.blank],
      ['只填寫步驟', result.workingOnly],
      ['其他未能歸類的作答', result.unclassified],
      ['其餘錯答', result.otherWrong],
      ['缺少歷史作答快照', result.unavailable]
    ].filter(([, value]) => value > 0);
    const patterns = result.patterns.map(p => {
      const steps = (p.missed || []).map(step =>
        `<li>${escape(step.label)} <span>（本組 ${escape(step.count)} 人未取足分）</span></li>`).join('');
      const examples = (p.examples || []).filter(text => text !== p.answer).map(text => `<code>${escape(text)}</code>`);
      return `<li class="answer-pattern"><div><strong>${escape(p.answer)}</strong> <span>${escape(p.count)} / ${escape(result.published)} 人</span></div>
        ${examples.length ? `<p>卷上寫法　${examples.join('、')}</p>` : ''}
        <p>這組有 ${escape(p.partial)} 人在本題取得部分分數。</p>
        ${steps ? `<p>可講評的評分點</p><ul>${steps}</ul>` : '<p>講評時可用原題條件逐一檢驗這個答案。</p>'}</li>`;
    }).join('');
    return `<p class="answer-result-line">已發布 ${escape(result.published)} 份 · 滿分 ${escape(result.fullCredit)} 人 · 部分得分 ${escape(result.partialCredit)} 人 · 零分 ${escape(result.zeroCredit)} 人</p>
      ${patterns ? `<ol class="answer-pattern-list">${patterns}</ol>` : '<p>目前沒有兩人或以上重複出現、可辨認的錯答。</p>'}
      ${counts.length ? `<ul class="answer-other-counts">${counts.map(([label,value]) => `<li>${label} <strong>${escape(value)} 人</strong></li>`).join('')}</ul>` : ''}`;
  }

  function report(questions, assigned) {
    const data = questions.map((q, i) => ({...q, number:i + 1})).filter(q => q.answerPatterns);
    if (!data.length) return '';
    const total = data[0].answerPatterns.published;
    const metric = q => q.answerPatterns.patterns[0]?.count || 0;
    const first = data.reduce((best, q) => metric(q) > metric(best) ? q : best);
    const choices = data.map(q => `<option value="${q.number}" ${q === first ? 'selected' : ''}>第 ${q.number} 題${metric(q) ? ' · 有重複錯答' : ''}</option>`).join('');
    function question(q) {
      const options = q.options?.length ? `<ol>${q.options.map(o => `<li>${escape(o)}</li>`).join('')}</ol>` : '';
      return `<p class="answer-prompt">${escape(q.prompt)}</p>${options}${render(q.answerPatterns)}`;
    }
    return `<details class="scan-box class-answer-patterns"${metric(first) ? ' open' : ''}>
      <summary><strong>常見錯答</strong><span>已發布 ${escape(total)} / 全班派卷 ${escape(assigned)} 份</span></summary>
      ${total ? `<label>查看題目 <select data-answer-question>${choices}</select></label><div data-answer-result aria-live="polite">${question(first)}</div>
      ${data.map(q => `<template data-answer-number="${q.number}">${question(q)}</template>`).join('')}
      <p class="field-note">每題最多列出三組，按相同數值或所選選項合計。學生的解題原因可在逐題評閱時核實。</p>`
      : '<p>本次作業已有成績發布後，便可逐題查看重複的錯答。</p>'}</details>`;
  }

  document.addEventListener('change', event => {
    if (!event.target.matches('[data-answer-question]')) return;
    const container = event.target.closest('.class-answer-patterns');
    const template = Array.from(container.querySelectorAll('template')).find(t => t.dataset.answerNumber === event.target.value);
    if (template) container.querySelector('[data-answer-result]').replaceChildren(template.content.cloneNode(true));
  });
  window.EduAnswerPatterns = {render, report};
})();
