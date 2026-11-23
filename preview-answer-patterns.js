/* Fictional, pre-scored submissions for the public teacher view. No pupil data is collected. */
window.createPreviewAnswerReport = function (catalogue,esc) {
  'use strict';
  const workedExamples = new Map();
  const examples = {
    's1-equations-a':[[-34,8],[-3,5],[26,4],[5,8],[6,5]],
    's1-equations-b':[[8,26],[4,-2],[-3.5,14],[6,4],[8,6]]
  };
  for (const [id,pairs] of Object.entries(examples)) {
    const original = catalogue.find(p => p.id === id);
    pairs.forEach((pair,i) => { if (original) workedExamples.set(original.questions[i].prompt,pair); });
  }
  const eligible = p => p?.year === '中一' && p.subject === '數學';
  const numeric = q => q.kind === 'number' && Number.isFinite(q.expected) && q.criteria.some(c=>c.mode==='auto');
  function exampleRows(q) {
    const answer = q.expected, method = q.criteria.some(c=>c.mode!=='auto');
    const [first,second] = workedExamples.get(q.prompt) || [answer===0?2:-answer,answer===-0.5?answer+2:answer+1];
    const rows = [
      [answer,'full'],[first,method?'partial':'zero'],[first,'zero'],[second,'zero'],[answer,'full'],
      [first,'zero'],[second,method?'partial':'zero'],[null,'zero'],[answer,'full']
    ];
    const format = v => String(Number(v.toFixed(8)));
    return rows.map(([v,mark],i)=>({
      answer:v===null?'':i===2 && Number.isInteger(v) && Math.abs(v)<10000?(v*2)+'/2':format(v),mark
    }));
  }
  function summarize(q,rows) {
    const groups = new Map();
    const s = {published:rows.length,fullCredit:0,partialCredit:0,zeroCredit:0,answerCredit:0,blank:0,
      workingOnly:0,unclassified:0,unavailable:0,otherWrong:0,patterns:[],wrongCount:0};
    for (const row of rows) {
      s[{full:'fullCredit',partial:'partialCredit',zero:'zeroCredit'}[row.mark]]++;
      if (row.mark==='full') continue;
      if (row.answer==='') { s.blank++; continue; }
      const final = AssessmentCore.numberAnswer(row.answer,q);
      if (final.kind!=='number') { s.unclassified++; continue; }
      if (Math.abs(final.value-q.expected)<=1e-9*Math.max(1,Math.abs(q.expected))) { s.answerCredit++; continue; }
      const key = String(final.value);
      const group = groups.get(key) || {answer:key,count:0,partial:0,missed:[],examples:[]};
      group.count++;
      if (group.examples.length<2 && !group.examples.includes(row.answer)) group.examples.push(row.answer);
      if (row.mark==='partial') group.partial++;
      groups.set(key,group);
      s.wrongCount++;
    }
    s.patterns = [...groups.values()].filter(g=>g.count>=2).sort((a,b)=>b.count-a.count).slice(0,3);
    const manual = q.criteria.filter(c=>c.mode==='manual');
    if (manual.length===1 && manual[0].max===1) {
      for (const g of s.patterns) {
        const missed=g.count-g.partial;
        if (missed) g.missed=[{label:manual[0].label,count:missed}];
      }
    }
    s.otherWrong = s.wrongCount-s.patterns.reduce((sum,g)=>sum+g.count,0);
    return s;
  }
  function page(p,room) {
    const back = room?'sample-homework/'+room+'/'+p.id:'paper/'+p.id;
    return '<section class="trial-answer-report"><a class="back-link" href="#'+esc(back)+'">'+
      (room?'返回這份班級作業':'返回這份試卷')+'</a><header><p>'+esc(p.year+' · '+p.subject)+'</p>'+
      '<h1>全班常見錯答</h1><p>'+esc(p.title)+'</p></header>'+
      '<p class="trial-report-note">這是示例報告。下方用九份虛構答卷演示剛發布的成績如何匯總。每題都可展開評分記錄對照。</p>'+
      '<label for="report-question">查看哪一題？</label><select id="report-question">'+
      p.questions.map((q,i)=>'<option value="'+i+'">第 '+(i+1)+' 題 · '+esc(q.topic||q.prompt.slice(0,30))+'</option>').join('')+
      '</select><div id="report-question-body" aria-live="polite"></div></section>';
  }
  function mount(root,p) {
    const picker = root.querySelector('#report-question');
    const body = root.querySelector('#report-question-body');
    function show() {
      const q = p.questions[Number(picker.value)];
      const header = '<h2>第 '+(Number(picker.value)+1)+' 題</h2><p class="report-prompt">'+esc(q.prompt)+'</p>';
      if (!numeric(q)) {
        body.innerHTML=header+'<p>此題須逐份閱讀作答。這個數值錯答示例未提供此題的評分記錄。</p>';
        return;
      }
      const rows = exampleRows(q);
      const labels = {full:'滿分',partial:'部分得分',zero:'零分'};
      body.innerHTML=header+'<p>參考答案　<strong>'+esc(q.expected)+' '+esc(q.unit||'')+'</strong></p>'+
        EduAnswerPatterns.render(summarize(q,rows))+
        '<p>同一個答案可能來自不同的解法。講評時，可對照上面的評分點，再請學生說明怎樣列式。</p>'+
        '<details><summary>核對本題的 9 份示例評分記錄</summary><ol>'+
        rows.map(r=>'<li>最終答案　<strong>'+esc(r.answer||'留白')+'</strong><span>'+labels[r.mark]+'</span></li>').join('')+
        '</ol></details>';
    }
    picker.addEventListener('change',show);
    show();
  }
  return {eligible,page,mount};
};
