/* A teacher can compare a fresh calculation against the current answer key. */
globalThis.EduAnswerVerification = (() => {
  'use strict';

  const labels = {
    match:'答案相符', mismatch:'答案不符', invalid:'需要核對', unsupported:'需要人手核對', pending:'待重新驗算'
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

  function reference(question) {
    if (Object.hasOwn(question, 'referenceAnswer')) return String(question.referenceAnswer ?? '');
    if (typeof question.expected === 'number' || typeof question.expected === 'string') return String(question.expected);
    return String(question.solution || '');
  }

  function engine(paper) {
    if (paper?.subject !== '數學') return null;
    if (paper.year === '中一') return globalThis.EduEquationCheck;
    if (paper.year === '中二') return globalThis.EduPercentCheck;
    return null;
  }

  function eligible(paper) {
    const verifier = engine(paper);
    if (!verifier || !Array.isArray(paper.questions) || !paper.questions.length) return false;
    return /^(s1-equations|s2-percent)-[ab]$/.test(paper.id) || paper.questions.some(q => verifier.check(q) !== null);
  }

  function editable(paper) {
    return paper?.subject === '數學' && ['中一','中二'].includes(paper.year) &&
      paper.questions.some(q => ['text','number'].includes(q.kind));
  }

  function check(question, paper) {
    return engine(paper)?.check(question) || {
      status:'unsupported', computed:'', steps:[],
      note:'暫時無法從這個寫法確定整道題的算式。請對照題目和參考解法核對。'
    };
  }

  function resultHTML(result) {
    const status = Object.hasOwn(labels, result.status) ? result.status : 'unsupported';
    const steps = (result.steps || []).map(s => '<li>' + escape(s) + '</li>').join('');
    return '<div class="av-outcome av-' + status + '" data-av-status="' + status + '">' +
      '<strong class="av-status">' + labels[status] + '</strong>' +
      (result.computed ? '<p>獨立計算結果　<b>' + escape(result.computed) + '</b></p>' : '') +
      (steps ? '<ol>' + steps + '</ol>' : '') + (result.note ? '<p>' + escape(result.note) + '</p>' : '') + '</div>';
  }

  function render(paper) {
    if (!eligible(paper) && !editable(paper)) return '';
    return '<section class="answer-verification" data-answer-verification aria-label="答案驗算">' +
      '<header><h2>答案驗算</h2><p data-av-summary></p></header>' +
      '<label>選擇題目<select data-av-picker></select></label>' +
      '<div class="av-fields"><label>題目<textarea data-av-prompt rows="3" maxlength="4000"></textarea></label>' +
      '<label><span data-av-ref-label>參考答案</span><textarea data-av-reference rows="2" maxlength="4000"></textarea></label></div>' +
      '<div class="av-actions"><button type="button" class="button primary" data-av-run>重新驗算</button>' +
      '<button type="button" class="button" data-av-english hidden>編修英譯</button>' +
      '<button type="button" class="button" data-av-reset hidden>還原這題</button>' +
      (globalThis.EduEquationPracticeUI?.suitable(paper) ? '<button type="button" class="button" data-av-practice>以目前題目出同類題</button>' : '')+'</div>' +
      '<div data-av-result aria-live="polite"></div><div class="av-save" data-av-save-area hidden>' +
      '<button type="button" class="button" data-av-save></button></div><p role="status" data-av-message></p></section>';
  }

  function mount(root, paper, options = {}) {
    const block = root.matches?.('[data-answer-verification]') ? root : root.querySelector('[data-answer-verification]');
    if (!block || block.dataset.ready || !paper.questions.length) return;
    block.dataset.ready = '1';
    const el = name => block.querySelector('[data-av-' + name + ']');
    const states = paper.questions.map((q, i) => {
      const draft = options.initialEdits?.[i];
      const edited = draft && typeof draft.prompt === 'string' && typeof draft.referenceAnswer === 'string';
      const prompt = edited ? draft.prompt : q.prompt;
      const ref = edited ? draft.referenceAnswer : reference(q);
      return {prompt, ref, result:runCheck(q, prompt, ref)};
    });

    function runCheck(q, prompt, ref) {
      // Omitted and deliberately blank keys differ for papers with a written solution.
      const current = {...q, prompt};
      if (ref !== reference(q)) current.referenceAnswer = ref;
      if (!prompt.trim() || !ref.trim()) return {status:'invalid',computed:'',steps:[],note:'請填寫題目和參考答案，再按重新驗算。'};
      return check(current, paper);
    }
    const firstProblem = states.findIndex(s => s.result.status === 'mismatch' || s.result.status === 'invalid');
    const firstSupported = states.findIndex(s => s.result.status === 'match');
    let index = Number.isInteger(options.initialIndex) && options.initialIndex >= 0 && options.initialIndex < states.length
      ? options.initialIndex : firstProblem >= 0 ? firstProblem : Math.max(0, firstSupported);
    const picker = el('picker');
    states.forEach((_, i) => picker.add(new Option('', String(i))));
    const changed = i => states[i].prompt !== paper.questions[i].prompt || states[i].ref !== reference(paper.questions[i]);

    function summarize() {
      const tally = {match:0, mismatch:0, review:0, pending:0};
      states.forEach((state, i) => {
        const status = state.result?.status || 'pending';
        tally[Object.hasOwn(tally,status) ? status : 'review']++;
        picker.options[i].text = '第 ' + (i+1) + ' 題 · ' + (paper.questions[i].topic || '試題') + ' · ' + labels[status];
      });
      const tags = [tally.match + ' 題相符'];
      if (tally.mismatch) tags.push(tally.mismatch + ' 題答案不符');
      if (tally.review) tags.push(tally.review + ' 題需核對');
      if (tally.pending) tags.push(tally.pending + ' 題待驗算');
      el('summary').textContent = '全卷 ' + states.length + ' 題　' + tags.join(' · ');
    }
    function refreshResult() {
      const result = states[index].result;
      el('result').innerHTML = resultHTML(result || {status:'pending', note:'題目或答案已修改。按「重新驗算」查看新結果。'});
      el('reset').hidden = !changed(index);
      el('save-area').hidden = !options.onSave || !changed(index) || !result;
      if (options.onSave) el('save').textContent = options.saveLabel || '採用修改';
      summarize();
    }
    function select() {
      const q = paper.questions[index];
      el('english').hidden = !options.onSave || !['text','number'].includes(q.kind);
      el('english').textContent = q.teacherEnglish && !globalThis.EduFlowMathsLanguage.teacherEntry(q)
        ? '編修英譯（待核對）' : '編修英譯';
      if(el('practice'))el('practice').hidden=Boolean(q.source?.type==='adapted' || q.diagram || q.figure);
      picker.value = String(index);
      el('ref-label').textContent = '參考答案' + (q.unit ? '（' + q.unit + '）' : '');
      el('prompt').value = states[index].prompt;
      el('reference').value = states[index].ref;
      el('message').textContent = '';
      refreshResult();
    }
    function notifyDraft() {
      if (options.onDraftChange) {
        const state = states[index];
        try {
          options.onDraftChange(index, changed(index) ? {prompt:state.prompt, referenceAnswer:state.ref} : null);
        } catch {
          el('message').textContent = '瀏覽器未能儲存試改內容，這次仍可繼續驗算。';
        }
      }
    }
    picker.addEventListener('change', () => {
      index = Number(picker.value);
      select();
      options.onSelect?.(index);
    });
    block.addEventListener('input', event => {
      if (!event.target.matches('[data-av-prompt],[data-av-reference]')) return;
      const state = states[index], wasChecked = state.result !== null;
      state.prompt = el('prompt').value;
      state.ref = el('reference').value;
      state.result = null;
      el('message').textContent = '';
      if (wasChecked) refreshResult();
      else el('reset').hidden = !changed(index);
      notifyDraft();
    });
    el('run').addEventListener('click', () => {
      const state = states[index];
      state.result = runCheck(paper.questions[index], state.prompt, state.ref);
      refreshResult();
    });
    el('practice')?.addEventListener('click',()=>globalThis.EduEquationPracticeUI.open(el('prompt').value,paper.year));
    el('reset').addEventListener('click', () => {
      const q = paper.questions[index];
      states[index] = {prompt:q.prompt, ref:reference(q), result:runCheck(q, q.prompt, reference(q))};
      select(); notifyDraft(); el('run').focus();
    });
    async function edit(editEnglish) {
      const state = states[index];
      if (!options.onSave || (!editEnglish && (!state.result || !changed(index)))) return;
      const btn = el(editEnglish ? 'english' : 'save');
      btn.disabled = true;
      try {
        await options.onSave({index, question:paper.questions[index], prompt:state.prompt,
          referenceAnswer:state.ref, result:state.result, editEnglish});
      } catch(error) { el('message').textContent = error.message || '未能採用修改，請再試。'; }
      finally { btn.disabled = false; }
    }
    el('save').addEventListener('click', () => edit(false));
    el('english').addEventListener('click', () => edit(true));
    select();
  }

  return {eligible, editable, check, reference, render, mount, resultHTML};
})();
