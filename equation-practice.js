/* Shared by the teacher workbench and the server-side verification process. */
(() => {
  'use strict';

  const numeric = /\d+(?:\.\d+)?|\.\d+/g;
  const decimal = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(?:\/(\d+))?$/;
  const formats = [
    ['printing', /^(?:印刷費包括一次排版費#元及每冊#元。總費#元,印了多少冊|印製講義須付排版費#元,另每冊收費#元。若合共付了#元,印了多少冊)[?。.]?$/, '冊'],
    ['rental', /^(?:租單車已繳#元,其中#元是按金,餘額支付每小時#元的租金。可租多少小時|租用單車付款#元,當中包括按金#元,其餘是按每小時#元計算的租金。租用了多少小時)[?。.]?$/, 'h']
  ];
  const example = '解方程：3(x − 2) = x + 8。';
  const formatError = '請輸入有唯一數值解的一元一次方程，或印刷收費、單車租金題。';

  function normalized(text) {
    return text.replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/[–−]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim();
  }

  function inspect(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 850) throw Error(formatError);
    const text = normalized(prompt);
    if (/\d\s+\d/.test(text) || [...text.matchAll(numeric)].length > 24) throw Error(formatError);
    const skeleton = text.replace(/\s/g, '').replace(numeric, '#');
    const context = formats.find(([, pattern]) => pattern.test(skeleton));
    let compact = '', variable, shape;
    if (!context) {
      let equation = text.replace(/[。?.]$/, '').trim();
      const request = /[,;。]\s*(?:請|请)?求(?:出)?\s*([a-zA-Z])(?:\s*的\s*值)?$/.exec(equation);
      if (request) equation = equation.slice(0,request.index).replace(/^(?:若|已知)\s*/, '').trim();
      equation = equation.replace(/^(?:請|请)?(?:求解|解)(?:\s*(?:下列|以下|這個|这个)?\s*方程(?:式)?)?\s*:?\s*/, '');
      compact = equation.replace(/\s/g, '');
      const symbols = new Set(compact.match(/[a-zA-Z]/g));
      if (symbols.size !== 1 || !compact.includes('=') || !/^[a-zA-Z0-9().+\-*/=]+$/.test(compact)) throw Error(formatError);
      variable = [...symbols][0];
      if (request && request[1] !== variable) throw Error('要求的未知數與方程不符。');
      shape = compact.replace(numeric, '#');
    } else {
      shape = skeleton;
    }
    // The algebra checker parses the complete prompt and applies the word problem's domain.
    const check = globalThis.EduEquationCheck.check({prompt,referenceAnswer:'0'});
    if (!['match','mismatch'].includes(check?.status)) throw Error(formatError);
    const raw = check.computed.split(' ')[0];
    const parts = decimal.exec(raw);
    if (!parts) throw Error(formatError);
    const expected = Number(parts[1]) / Number(parts[2] || 1);
    if (!Number.isFinite(expected) || Math.abs(expected) > 1e6) throw Error('解的數值超出本練習範圍。');
    return {shape, raw, expected, variable, unit:context?.[2], compact, context:context?.[0]};
  }

  function questionFrom(source, candidate) {
    if (typeof candidate?.prompt !== 'string' || typeof candidate.referenceAnswer !== 'string' || candidate.referenceAnswer.length > 100) {
      throw Error('變式欠缺題目或參考答案。');
    }
    const prompt = candidate.prompt.trim(), current = inspect(prompt);
    if (current.shape !== source.shape || current.raw === source.raw) throw Error('變式須保留原題的運算結構，並有不同的解。');
    const calculation = globalThis.EduEquationCheck.check({prompt, referenceAnswer:candidate.referenceAnswer});
    if (calculation?.status !== 'match') throw Error('變式的參考答案與重新計算的結果不符。');
    const solution = calculation.steps.join('\n');
    const q = {
      topic: current.context ? '列方程解收費問題' : '解一元一次方程',
      kind:'number', working:true, prompt, expected:current.expected, referenceAnswer:current.raw,
      solution, sample:{answer:current.raw,working:solution},
      criteria:[
        {id:'method',max:1,mode:'manual',label:current.context ? '按收費條件列出正確的方程。' : '正確整理方程，列出等價的移項、展開或去分母步驟。'},
        {id:'answer',max:1,mode:'auto',label:'得出 ' + calculation.computed + '。'}
      ]
    };
    if (current.unit) q.unit=current.unit;
    if (current.variable) q.variable=current.variable;
    return q;
  }

  function verifyCandidate(sourcePrompt, candidate) {
    return questionFrom(inspect(sourcePrompt),candidate);
  }

  function generate(sourcePrompt, candidates) {
    const source = inspect(sourcePrompt);
    if (Array.isArray(candidates) && candidates.length === 2) {
      try {
        const questions = candidates.map(candidate => questionFrom(source,candidate));
        if (questions[0].expected !== questions[1].expected) return {mode:'ai', questions};
      } catch { /* An incomplete or inconsistent pair is replaced with calculated variants. */ }
    }
    const text = normalized(sourcePrompt);
    const literals = [...text.matchAll(numeric)].reverse();
    const pool = [], answers = new Set([source.raw]);
    for (const token of literals) {
      let found = 0;
      for (let step=1;step<=18 && found<4;step++) {
        // Retain decimal place value when varying a stated measurement or coefficient.
        const places = (token[0].split('.')[1] || '').length;
        if (places > 4 || token[0].length > 8) continue;
        const scaled = Math.round(Number(token[0]) * 10**places);
        const value = (scaled + step) / 10**places;
        const newText = text.slice(0,token.index) + value.toFixed(places) + text.slice(token.index + token[0].length);
        try {
          const proposed = inspect(newText);
          if (answers.has(proposed.raw) || Math.abs(proposed.expected)>10000) continue;
          const question = questionFrom(source,{prompt:newText,referenceAnswer:proposed.raw});
          answers.add(proposed.raw);
          pool.push({question,slot:token.index,complexity:Number.isInteger(proposed.expected)?0:proposed.raw.length});
          found++;
        } catch { /* Some changes give an inadmissible count or a degenerate equation. */ }
      }
    }
    pool.sort((a,b)=>a.complexity-b.complexity);
    if (pool.length < 2) throw Error('這道題未能產生兩道可核對的同類題。請改用數值較簡單的方程。');
    const first = pool[0], next = pool.find((item,i)=>i && item.slot!==first.slot && item.complexity===first.complexity) || pool[1];
    return {mode:'rules', questions:[first.question,next.question]};
  }

  globalThis.EduEquationPractice = Object.freeze({inspect,verifyCandidate,generate,example});
})();
