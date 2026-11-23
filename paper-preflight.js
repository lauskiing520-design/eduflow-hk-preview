/* Read-only checks shared by the teacher workspace and the public preview. */
(function (root) {
  'use strict';

  const unknownTopic = '未標註知識點';
  const words = value => typeof value === 'string' ? value.trim() : '';
  const sideName = side => side === 'A' ? '本卷' : '對照卷';
  const sum = values => values.some(n => n == null) ? null : values.reduce((a, b) => a + b, 0);
  const message = (kind, severity, text, refs = []) => ({kind, severity, message: text, refs});
  const normalize = text => words(text)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]+/gu, s => '^(' + s.normalize('NFKC') + ')')
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+/gu, s => '_(' + s.normalize('NFKC') + ')')
    .normalize('NFKC').replace(/−/gu, '-').replace(/\s+/gu, ' ').trim();

  function readCriteria(question) {
    if (Object.prototype.hasOwnProperty.call(question, 'criteriaText')) {
      return words(question.criteriaText).split(/\r?\n/u).filter(s => s.trim()).map(line => {
        const parts = /^\s*(\d+)\s*[|｜:：]\s*(.+?)\s*$/u.exec(line);
        return parts ? {label: parts[2], max: Number(parts[1])} : {};
      });
    }
    return Array.isArray(question.criteria) ? question.criteria : [];
  }

  // Count explicitly evidenced method/justification rubric items once each.
  // The mark value, number of sentences and question difficulty are not step counts.
  function methodItem(item) {
    const id = words(item.id);
    const label = normalize(item.label);
    if (id === 'answer' || item.mode === 'auto' || /^(?:最後答案|最終數值|答案及單位|數值正確|結論正確|答案正確|final answer)/iu.test(label)) return false;
    if (/^(?:method|step\d+|reason|evidence|fairness)$/iu.test(id)) return true;
    if (/列式|算式|方程|指出|說明|解釋|推論|驗證|代入|計算|化簡|求解|求出|解法|運算|推導|理由|關係|根據|依據|比較|分別求|選取|換算|轉換|步驟|論證|分析|變量|變因|控制|誤差|證據|假設|建議.*改進|區別|辨別|辨認|分辨|判斷|歸納|反駁|解讀|讀出|提出.*(?:方法|設計)|[=×÷]|(?:explain|justif\w*|reasoning|evidence|calculat\w*|substitut\w*|compare|deduc\w*|interpret\w*|derive|method|equation)\b/iu.test(label)) return true;
    return null;
  }

  function rubric(question) {
    const criteria = readCriteria(question);
    if (!criteria.length || criteria.some(c => !c || !words(c.label) || !Number.isSafeInteger(c.max) || c.max <= 0)) {
      return {marks: null, steps: null};
    }
    const classifications = criteria.map(methodItem);
    return {marks: sum(criteria.map(c => c.max)), steps: classifications.includes(null) ? null : classifications.filter(Boolean).length};
  }

  // Read text nodes from the supported embedded SVG format without interpreting markup.
  function visibleLabels(data) {
    if (typeof data !== 'string' || data.length > 800000 || !/^data:image\/svg\+xml;base64,[\w+/=]+$/u.test(data)) return null;
    try {
      const binary = atob(data.slice(data.indexOf(',') + 1));
      const svg = new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
      if (!/^\s*<svg\b/iu.test(svg) || !/<\/svg>\s*$/iu.test(svg)) return null;
      return Array.from(svg.matchAll(/<text\b[^>]*>([^<>]*)<\/text>/giu), m => normalize(m[1]).replaceAll(' ', ''));
    } catch {
      return null;
    }
  }

  const geometryResult = (status, note) => ({status, note});
  const manual = note => geometryResult('manual', note);
  const mismatch = note => geometryResult('mismatch', note);
  const checked = note => geometryResult('checked', note);
  const angleKey = name => name.length === 3 && name[0] > name[2] ? name[2] + name[1] + name[0] : name;
  function angles(text) {
    const result = [];
    for (const m of normalize(text).matchAll(/(?:∠|角)\s*([A-Z]{1,3})\s*(?:=|為|是)\s*(\d+(?:\.\d+)?)\s*(?:°(?!C)|度)(?!\s*[-+*/×÷])/gu)) {
      result.push([angleKey(m[1]), Number(m[2])]);
    }
    return result;
  }

  function validFigure(f) {
    if (!f || typeof f !== 'object') return false;
    const whole = (k, min, max) => Number.isSafeInteger(f[k]) && f[k] >= min && f[k] <= max;
    if (f.kind === 'triangle') {
      return whole('a', 15, 130) && whole('b', 15, 130) && f.a + f.b <= 160 &&
        (f.variant === undefined || ['exterior','diagnose'].includes(f.variant));
    }
    if (f.kind === 'parallel') return whole('angle', 15, 160) && whole('coef', 2, 8) && whole('offset', 0, f.angle - 1);
    if (!['rectangle', 'lshape'].includes(f.kind)) return false;
    const min = f.kind === 'lshape' ? 5 : 2;
    if (!whole('width', min, 40) || !whole('height', min, 40)) return false;
    if (f.kind === 'lshape') return whole('cutWidth', 1, f.width - 1) && whole('cutHeight', 1, f.height - 1);
    return f.inset === undefined || whole('inset', 1, Math.ceil(Math.min(f.width, f.height) / 2) - 1);
  }

  function templateGeometry(q, labels) {
    const f = q.figure;
    if (!['triangle', 'rectangle', 'parallel', 'lshape'].includes(f.kind)) return manual('這種圖形的參數暫需人手核對。');
    if (!validFigure(f)) return mismatch('圖形參數不符合此模板的角度或尺寸範圍。');
    const prompt = normalize(q.prompt).replaceAll(' ', '');
    let expectedLabels;
    if (f.kind === 'triangle') {
      const exterior = f.variant === 'exterior';
      const matches = angles(q.prompt);
      const sets = exterior ? [['CAD'], ['B','ABC']] : [['A','BAC'], ['B','ABC']];
      const values = [exterior ? 180 - f.a : f.a, f.b];
      let complete = true;
      for (let i = 0; i < sets.length; i++) {
        const given = matches.filter(([name]) => sets[i].includes(name));
        if (given.some(([, n]) => n !== values[i])) return mismatch('題幹的角度與圖形參數不符，請核對角的頂點及度數。');
        if (!given.length) complete = false;
      }
      if (!complete) return manual('題幹未按可辨認的格式列出兩個已知角，請對照頂點及度數。');
      expectedLabels = ['A','B','C',values[0]+'°',values[1]+'°','x°'];
      if (exterior) expectedLabels.push('D');
    } else if (f.kind === 'parallel') {
      const match = /(?:分別是|分別為)(\d+)°(?:及|和|與|、)\((\d+)x\+(\d+)\)°/u.exec(prompt);
      if (!match || !prompt.includes('同位角')) return manual('請核對平行線、角的位置及代數式。');
      if (Number(match[1]) !== f.angle || Number(match[2]) !== f.coef || Number(match[3]) !== f.offset) return mismatch('題幹的已知角或角度算式與圖形參數不符。');
      expectedLabels = ['l','m',f.angle+'°','('+f.coef+'x+'+f.offset+')°'];
    } else {
      const dims = Array.from(prompt.matchAll(/(長|闊|寬)(\d+(?:\.\d+)?)(?:cm|厘米)/giu), m => [m[1] === '長' ? '長' : '闊', Number(m[2])]);
      const expected = [['長', f.width], ['闊', f.height]];
      if (f.kind === 'lshape') expected.push(['長', f.cutWidth], ['闊', f.cutHeight]);
      if (f.inset !== undefined) expected.push(['闊', f.inset]);
      if (dims.length !== expected.length || dims.some(([key], i) => key !== expected[i][0])) return manual('請核對長、闊及各尺寸所屬的位置。');
      if (dims.some(([, n], i) => n !== expected[i][1])) return mismatch('題幹的長、闊或邊框尺寸與圖形參數不符。');
      // The inset is displayed as a dashed border; only the outer lengths are printed.
      expectedLabels = expected.filter((_, i) => f.inset === undefined || i < 2).map(([, n]) => n+'cm');
    }
    if (!labels || !labels.length) return manual('題幹與模板參數已比對，請再檢查實際配圖。');
    if (labels.length !== expectedLabels.length || labels.some((v, i) => expectedLabels[i] !== v)) {
      return mismatch('配圖文字與模板應有的標記不一致，請對照圖及題幹。');
    }
    return checked('已比對模板已知量、題幹及圖中文字；線條位置與比例仍由老師核對。');
  }

  function checkGeometry(q) {
    const hasBinding = Object.prototype.hasOwnProperty.call(q, 'figurePrompt');
    const stale = hasBinding && (q.figure || q.diagram) && words(q.figurePrompt) !== words(q.prompt);
    if (!q.figure && !q.diagram) {
      if (/(?:如圖|見圖|下圖|上圖|圖中|附圖|shown in the (?:diagram|figure)|diagram (?:below|above))/iu.test(words(q.prompt))) return mismatch('題幹引用配圖，但此題沒有附圖。');
      return geometryResult('none', '');
    }
    const labels = visibleLabels(q.diagram);
    let result;
    if (q.figure) {
      result = templateGeometry(q, labels);
    } else {
      const facts = angles(q.prompt);
      const labelled = (labels || []).flatMap(angles);
      const descriptions = angles(q.diagramAlt);
      const conflict = facts.some(([key, n]) => [...labelled, ...descriptions].some(([other, v]) => key === other && n !== v));
      if (conflict) result = mismatch('同一個角在題幹與配圖文字中出現不同度數。');
      else if (facts.length && facts.every(([key, n]) => labelled.some(([other, v]) => key === other && n === v))) result = checked('已比對圖中明寫角名的度數；其餘標記及位置請人手核對。');
      else result = manual('請對照原圖核對標記、數值及位置，圖說本身不足以驗證原圖。');
    }
    if (stale) return result.status === 'mismatch' ? mismatch('題幹已更改。' + result.note) : manual('題幹已更改，須按目前題意重新核對配圖。');
    return result;
  }

  function totals(items) {
    return {questions: items.length, marks: sum(items.map(x => x.marks)), steps: sum(items.map(x => x.steps))};
  }

  function summarize(paper, side, warnings) {
    const input = Array.isArray(paper.questions) ? paper.questions : [];
    const questions = input.map((item, index) => {
      const q = item || {};
      const number = index + 1;
      const refs = [{side, number}];
      const prompt = words(q.prompt);
      const topic = words(q.topic);
      const {marks, steps} = rubric(q);
      if (!prompt) warnings.push(message('prompt', 'issue', sideName(side) + '第 ' + number + ' 題欠缺題幹。', refs));
      if (marks == null) warnings.push(message('rubric', 'issue', sideName(side) + '第 ' + number + ' 題的分值或評分要求未填妥。', refs));
      const geometry = checkGeometry(q);
      if (geometry.status === 'manual' || geometry.status === 'mismatch') {
        warnings.push(message('geometry', geometry.status === 'mismatch' ? 'issue' : 'review',
          sideName(side) + '第 ' + number + ' 題：' + geometry.note, refs));
      }
      return {number, id: words(q.id), prompt, topic: topic || unknownTopic, marks, steps, geometry};
    });
    if (!questions.length) warnings.push(message('empty', 'issue', sideName(side) + '尚未有題目。'));
    const groups = new Map();
    for (const q of questions) {
      if (!groups.has(q.topic)) groups.set(q.topic, []);
      groups.get(q.topic).push(q);
    }
    const unlabelled = groups.get(unknownTopic) || [];
    if (unlabelled.length) warnings.push(message('topic', 'review', sideName(side) + '有 ' + unlabelled.length + ' 題尚未標註知識點，分布未完整。', unlabelled.map(q => ({side, number: q.number}))));
    const uncertainSteps = questions.filter(q => q.steps == null && q.marks != null);
    if (uncertainSteps.length) warnings.push(message('stepBasis', 'review', sideName(side) + '有 ' + uncertainSteps.length + ' 題的評分文字未能區分方法分與結果分，請查閱評分準則。', uncertainSteps.map(q => ({side, number: q.number}))));
    const topics = Array.from(groups, ([topic, items]) => ({topic, ...totals(items)}));
    return {id: words(paper.id), title: words(paper.title), questionCount: questions.length,
      marks: questions.length ? sum(questions.map(q => q.marks)) : null,
      steps: questions.length ? sum(questions.map(q => q.steps)) : null,
      unmapped: unlabelled.length, questions, topics};
  }

  function contentText(value) {
    if (Array.isArray(value)) return value.map(contentText);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, contentText(value[k])]));
    if (typeof value !== 'string') return value;
    return normalize(value).replace(/\s*([=+*/×÷(),:;!?。、，；：！？])\s*/gu, '$1')
      .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu, '$1');
  }

  function signature(q, paper) {
    const stem = contentText(words(q.prompt).replace(/^\s*第\s*\d+\s*題\s*[：:.、]?\s*/u, ''));
    if (!stem) return null;
    const contextFields = ['context', 'stimulus', 'passage', 'material', 'materials', 'table', 'data'];
    const context = contextFields.map(k => [contentText(paper[k] ?? null), contentText(q[k] ?? null)]);
    const contextKey = JSON.stringify(context);
    const hasSource = context.some(pair => pair.some(v => v != null && v !== ''));
    // A generic instruction alone cannot identify its source passage or writing task.
    const generic = /^(?:請?(?:作答|作文|試寫一篇文章|根據(?:上文|材料|資料)(?:回答(?:下列)?問題|作答))|write (?:an? essay|your answer|a paragraph)|answer the (?:following )?questions?(?: (?:using|based on) the (?:passage|text))?)[.!?。！？]?$/iu;
    if (!hasSource && generic.test(stem)) return null;
    const options = Array.isArray(q.options) ? q.options.map(contentText) : [];
    const figureKind = q.figure?.kind;
    const knownFig = Boolean(figureKind && validFigure(q.figure));
    const image = words(q.diagram);
    const alt = contentText(words(q.diagramAlt));
    const exact = JSON.stringify([stem, options, contextKey, contentText(q.figure ?? null), image, alt]);
    const numericOnly = text => text.replace(/\d+(?:\.\d+)?/gu, '#');
    const inMath = /數學|数学|math/iu.test(words(paper.subject)) || /[=+×÷∠%°]/u.test(stem);
    const containsTask = /[\p{L}=+×÷∠%°]/u.test(stem);
    if (!inMath || !/\d/u.test(stem) || !containsTask) return {exact, numeric: null};
    const numeric = JSON.stringify([numericOnly(stem), options.map(o => typeof o === 'string' ? numericOnly(o) : o), contextKey,
      knownFig ? [figureKind, q.figure.variant || '', Object.hasOwn(q.figure, 'inset')] : [image, alt]]);
    return {exact, numeric};
  }

  function duplicateChecks(papers, warnings) {
    const seen = [];
    const pairs = [];
    papers.forEach((paper, paperIndex) => {
      const side = paperIndex ? 'B' : 'A';
      if (!Array.isArray(paper.questions)) return;
      paper.questions.forEach((q, index) => {
        const sig = signature(q || {}, paper);
        if (!sig) return;
        const ref = {side, number: index + 1};
        for (const earlier of seen) {
          const kind = earlier.sig.exact === sig.exact ? 'exact' : sig.numeric && earlier.sig.numeric === sig.numeric ? 'numeric' : null;
          if (!kind) continue;
          const previous = earlier.ref;
          const where = sideName(previous.side) + '第 ' + previous.number + ' 題及' + sideName(side) + '第 ' + ref.number + ' 題';
          warnings.push(message(kind === 'exact' ? 'duplicate' : 'numericDuplicate', kind === 'exact' ? 'issue' : 'review',
            where + (kind === 'exact' ? '的題幹、選項及已提供的材料相同。' : '的題幹及選項結構相同，請查看是否只更換了數值。'), [previous, ref]));
          if (previous.side !== side) pairs.push({a: previous.number, b: ref.number, kind});
        }
        seen.push({ref, sig});
      });
    });
    return pairs;
  }

  function compare(a, b, pairs, warnings) {
    const keys = new Set([...a.topics, ...b.topics].map(x => x.topic));
    const pick = (paper, topic) => {
      const row = paper.topics.find(t => t.topic === topic);
      return row ? {questions: row.questions, marks: row.marks, steps: row.steps} : {questions: 0, marks: 0, steps: 0};
    };
    const topics = Array.from(keys, topic => ({topic, a: pick(a, topic), b: pick(b, topic)}));
    const refs = (topic, paper, side) => paper.questions.filter(q => q.topic === topic).map(q => ({side, number: q.number}));
    for (const row of topics) {
      if (row.topic === unknownTopic) continue;
      const differences = [['questions','題數'], ['marks','配分'], ['steps','可辨認的方法評分項數']]
        .filter(([key]) => row.a[key] != null && row.b[key] != null && row.a[key] !== row.b[key]).map(([, name]) => name);
      if (differences.length) warnings.push(message('distribution', 'review', '「' + row.topic + '」在兩卷的' + differences.join('、') + '不同。',
        [...refs(row.topic, a, 'A'), ...refs(row.topic, b, 'B')]));
    }
    if (a.questionCount !== b.questionCount || (a.marks != null && b.marks != null && a.marks !== b.marks)) {
      warnings.push(message('totals', 'review', '兩卷的總題數或總分不同，請確認是否符合派卷安排。'));
    }
    return {topics, pairs};
  }

  function analyze(paperA, paperB = null) {
    const source = [paperA || {}];
    if (paperB != null) source.push(paperB);
    const warnings = [];
    const papers = source.map((p, i) => summarize(p, i ? 'B' : 'A', warnings));
    const pairs = duplicateChecks(source, warnings);
    if (source.length === 2 && ['year','subject'].some(k => words(source[0][k]) && words(source[1][k]) && words(source[0][k]) !== words(source[1][k]))) {
      warnings.push(message('scope', 'review', '兩卷的年級或科目不同，請確認比較對象。'));
    }
    return {papers, warnings, comparison: papers.length === 2 ? compare(papers[0], papers[1], pairs, warnings) : null};
  }

  function findCompanion(paper, catalog) {
    const pairedTitle = value => /^(.*?)[\s（(·－-]*([AB])\s*卷[)）]?\s*$/iu.exec(normalize(value));
    const title = pairedTitle(paper?.title);
    const list = Array.isArray(catalog) ? catalog : catalog?.papers;
    if (!title || !title[1].trim() || !Array.isArray(list) || !words(paper.year) || !words(paper.subject)) return null;
    const candidates = list.filter(other => {
      const candidate = pairedTitle(other?.title);
      return candidate && candidate[1].trim() === title[1].trim() && candidate[2].toUpperCase() !== title[2].toUpperCase() &&
        words(other.year) === words(paper.year) && words(other.subject) === words(paper.subject);
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  const api = Object.freeze({analyze, findCompanion});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PaperPreflight = api;
})(globalThis);
