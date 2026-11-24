/* Fictional, pre-scored submissions for the public teacher view. No pupil data is collected. */
window.createPreviewAnswerReport = function (catalogue,esc) {
  'use strict';
  const workedExamples = new Map();
  const examples = {
    's1-equations-a':[[-34,8],[-3,5],[26,4],[5,8],[6,5]],
    's1-equations-b':[[8,26],[4,-2],[-3.5,14],[6,4],[8,6]],
    's2-percent-a':[[0.325,67.5],[664.7,491.3],[5,35],[392,432],[13.04,45],[288,300],null,[7,14],[180,12],[95,90],null,[9,36]],
    's2-percent-b':[[0.375,62.5],[447.12,524.88],[5,25],[450.5,476],[11.11,60],[346.5,420],null,[82.5,75],[3750,6000],[24,30],null,[26.25,15]],
    's1-science-inquiry-full':[null,null,null,null,[64,59],[8,6],null,[174,59]]
  };
  for (const [id,pairs] of Object.entries(examples)) {
    const original = catalogue.find(p => p.id === id);
    pairs.forEach((pair,i) => { if (pair && original) workedExamples.set(original.questions[i].prompt,pair); });
  }
  const eligible = p => (p?.year==='中一' && ['科學','數學'].includes(p.subject)) ||
    (p?.year==='中二' && p.subject==='數學');
  const numeric = q => q.kind === 'number' && Number.isFinite(q.expected) && q.criteria.some(c=>c.mode==='auto');
  const choice = q => q.kind==='choice' && q.options?.includes(q.expected) && q.criteria.some(c=>c.mode==='auto');
  function withUnit(value,unit) {
    if (unit==='$') return '$'+value;
    return String(value)+(unit?((unit==='%' || unit==='°')?'':' ')+unit:'');
  }
  function exampleRows(q) {
    const answer = q.expected, method = q.criteria.some(c=>c.mode!=='auto');
    let alternatives;
    if (choice(q)) alternatives=q.options.filter(v=>v!==answer);
    else if (workedExamples.has(q.prompt)) alternatives=workedExamples.get(q.prompt);
    else if (q.unit==='%') alternatives=[answer===0?1:answer/100,answer+5];
    else if (q.unit) alternatives=[answer+1,answer+2];
    else alternatives=[answer===0?2:-answer,answer===-0.5?answer+2:answer+1];
    const first=alternatives[0],second=alternatives[1]??first;
    const rows = [
      [answer,'full'],[first,method?'partial':'zero'],[first,'zero'],[second,'zero'],[answer,'full'],
      [first,'zero'],[second,method?'partial':'zero'],[null,'zero'],[answer,'full']
    ];
    const format = v => String(Number(v.toFixed(8)));
    return rows.map(([v,mark],i)=>({
      answer:v===null?'':choice(q)?v:i===2 && Number.isInteger(v) && Math.abs(v)<10000?withUnit((v*2)+'/2',q.unit):withUnit(format(v),q.unit),mark
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
      const final = choice(q)?{kind:'choice',value:q.options.indexOf(row.answer)}:AssessmentCore.numberAnswer(row.answer,q);
      if (final.kind==='choice' && final.value<0) { s.unclassified++; continue; }
      if (final.kind!=='number' && final.kind!=='choice') { s.unclassified++; continue; }
      if (final.kind==='number' && Math.abs(final.value-q.expected)<=1e-9*Math.max(1,Math.abs(q.expected))) { s.answerCredit++; continue; }
      const key = final.kind==='choice'?'選項 '+(final.value+1):withUnit(final.value,q.unit);
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
  function openMarks(q) {
    // Each entry represents the points that a fictional teacher awarded on one script.
    const examplesByTopic = {
      '變量辨認': [[0],[0],[],[0],[0],[0],[1],[0],[0,1]],
      '控制條件': [[],[0],[0],[0],[1],[0],[0],[],[0,1]],
      '百分點': [[0],[0],[1],[0],[0],[0],[0],[0],[0,1]],
      '錯解辨析': [[0],[0],[0],[],[1],[0],[0],[0],[0,1]]
    };
    const awards = (q.criteria.length===2 && examplesByTopic[q.topic]) ||
      [[],[0],[0],[],[1],[0],[],[0],q.criteria.map((c,i)=>i)];
    return awards.map(missed=>q.criteria.map((c,i)=>missed.includes(i)?0:c.max));
  }
  function pointRecords(q) {
    if (q.kind==='text' && q.criteria.every(c=>c.mode==='manual')) return openMarks(q);
    if (!numeric(q) && !choice(q)) return [];
    return exampleRows(q).map(row=>q.criteria.map(c=>row.mark==='full' || (row.mark==='partial' && c.mode==='manual')?c.max:0));
  }
  function teachingPriorities(p) {
    // Row n is the same fictional pupil across this report and the follow-up roster.
    const rank = (a,b) => b.missed-a.missed || b.missed*a.known-a.missed*b.known ||
      a.index-b.index || a.pointIndex-b.pointIndex;
    const perQuestion = p.questions.flatMap((q,index) => {
      const records = pointRecords(q);
      const points = q.criteria.map((point,pointIndex) => {
        const scores = records.map(row=>row[pointIndex]).filter(Number.isFinite);
        return {index,pointIndex,point,known:scores.length,missed:scores.filter(score=>score<point.max).length};
      }).filter(item=>item.missed>0);
      return points.sort(rank).slice(0,1);
    });
    return perQuestion.sort(rank).slice(0,3);
  }
  function prioritiesPanel(p) {
    const items = teachingPriorities(p).map(item=>{
      const q=p.questions[item.index];
      return {...item,number:item.index+1,topic:q.topic||'評分點',label:item.point.label,
        prompt:EduReteachPrompts.buildPrompt(q,item.point)};
    });
    return '<section class="report-priorities" aria-labelledby="report-priorities-title"><h2 id="report-priorities-title">下節課講評重點</h2>'+
      (items.length ? '<p>按各評分點未取滿分的人數排序，每題選一項。分母是此項有評分紀錄的人數。</p><ol>'+
        items.map(({index,number,point,known,missed,topic,label,prompt})=>
          '<li><div class="priority-heading"><h3>第 '+number+' 題 · '+esc(topic)+'</h3>'+
          '<span>'+missed+' / '+known+' 人未取滿分</span></div><p>'+esc(label)+'</p>'+
          '<p class="priority-prompt"><strong>課堂提問</strong> '+esc(prompt)+'</p>'+
          '<button type="button" data-priority-question="'+index+'" data-priority-point="'+esc(point.id)+'" aria-label="查看第 '+number+' 題的評分紀錄">查看本題紀錄</button></li>'
        ).join('')+'</ol><details><summary>預覽講評備課提綱</summary><p class="priority-brief">'+
          esc(EduReteachPrompts.lessonBrief(items))+'</p></details>' :
        '<p>這批示例評分紀錄暫未顯示可跟進的失分點。</p>')+'</section>';
  }
  const sampleCourses = [
    ['s1-equations-a','中一方程'],['s2-percent-a','中二百分法'],['s1-science-inquiry-full','中一科學探究']
  ];
  function openReport(q) {
    const records=openMarks(q);
    const max=q.criteria.reduce((sum,c)=>sum+c.max,0);
    const totals=records.map(marks=>marks.reduce((sum,n)=>sum+n,0));
    const full=totals.filter(n=>n===max).length,zero=totals.filter(n=>n===0).length;
    const summary={published:records.length,fullCredit:full,zeroCredit:zero,partialCredit:records.length-full-zero,
      blank:1,otherWrong:0,patterns:[],unavailable:0,unclassified:0};
    const missed=q.criteria.map((c,i)=>({id:c.id,label:c.label,count:records.filter(scores=>scores[i]<c.max).length}))
      .filter(item=>item.count).sort((a,b)=>b.count-a.count);
    return EduAnswerPatterns.render({...summary,mode:'rubric',rubricMisses:missed})+
      '<details><summary>核對本題的 9 份示例評分記錄</summary><p>'+
      q.criteria.map((c,i)=>'評分點 '+(i+1)+'：'+esc(c.label)).join('<br>')+'</p><ol>'+
      records.map((scores,i)=>'<li>答卷 '+(i+1)+' · '+totals[i]+'/'+max+' 分　'+
        q.criteria.map((c,n)=>'評分點 '+(n+1)+'：'+scores[n]+'/'+c.max).join('，')+'</li>').join('')+
      '</ol></details>';
  }
  function page(p,room) {
    const back = room?'sample-homework/'+room+'/'+p.id:'paper/'+p.id;
    return '<section class="trial-answer-report"><a class="back-link" href="#'+esc(back)+'">'+
      (room?'返回這份班級作業':'返回這份試卷')+'</a><header><p>'+esc(p.year+' · '+p.subject)+'</p>'+
      '<h1>全班常見錯答</h1><p>'+esc(p.title)+'</p></header>'+
      '<p class="trial-report-note">這是示例報告，使用九份已發布成績的虛構答卷。</p>'+
      (!room && sampleCourses.some(([id])=>id===p.id)?'<nav class="report-course-links" aria-label="切換示例報告">'+
        sampleCourses.map(([id,name])=>'<a href="#sample-analysis/'+id+'"'+(id===p.id?' aria-current="page"':'')+'>'+name+'</a>').join('')+'</nav>':'')+
      prioritiesPanel(p)+
      '<label for="report-question">查看哪一題？</label><select id="report-question">'+
      p.questions.map((q,i)=>'<option value="'+i+'">第 '+(i+1)+' 題 · '+esc(q.topic||q.prompt.slice(0,30))+'</option>').join('')+
      '</select><div id="report-question-body" aria-live="polite"></div></section>';
  }
  function mount(root,p,questionFigure,followups,room,initial='') {
    const picker = root.querySelector('#report-question');
    const body = root.querySelector('#report-question-body');
    const [startIndex,firstCriterion] = initial.split('~');
    if (/^\d+$/.test(startIndex) && Number(startIndex)<p.questions.length) picker.value=startIndex;
    function show(selectedPoint) {
      const q = p.questions[Number(picker.value)];
      const follow=EduFlowQuestionBank.relatedLink(catalogue,q,p.id);
      const practice=follow?'<div class="actions"><a class="button" href="'+esc(follow)+'">選這題的同類題</a></div>':'';
      const options=choice(q)?'<ol type="A">'+q.options.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>':'';
      const header = '<h2 tabindex="-1">第 '+(Number(picker.value)+1)+' 題</h2><p class="report-prompt">'+esc(q.prompt)+'</p>'+options+questionFigure(q);
      if (!numeric(q) && !choice(q)) {
        if (q.kind==='text' && q.criteria.length && q.criteria.every(c=>c.mode==='manual')) {
          body.innerHTML=header+openReport(q)+practice;
          followups.mountTeacher(body,p,room,Number(picker.value),pointRecords(q),selectedPoint);
          return;
        }
        body.innerHTML=header+'<p>此題須逐份閱讀作答。這個數值錯答示例未提供此題的評分記錄。</p>';
        return;
      }
      const rows = exampleRows(q);
      const records = pointRecords(q);
      const labels = {full:'滿分',partial:'部分得分',zero:'零分'};
      body.innerHTML=header+'<p>參考答案　<strong>'+esc(withUnit(q.expected,q.unit))+'</strong></p>'+
        EduAnswerPatterns.render(summarize(q,rows))+
        '<p>同一個答案可能來自不同的解法。講評時，可對照上面的評分點，再請學生說明怎樣列式。</p>'+
        '<details><summary>核對本題的 9 份示例評分記錄</summary><ol>'+
        rows.map((r,i)=>'<li>答卷 '+(i+1)+' · 最終答案　<strong>'+esc(r.answer||'留白')+'</strong><span>'+labels[r.mark]+'</span>'+
          '<small>'+q.criteria.map((c,j)=>esc(c.label)+' '+records[i][j]+'/'+c.max).join('，')+'</small></li>').join('')+
        '</ol></details>'+practice;
      followups.mountTeacher(body,p,room,Number(picker.value),records,selectedPoint);
    }
    picker.addEventListener('change',()=>show());
    root.querySelectorAll('[data-priority-question]').forEach(button=>button.addEventListener('click',()=>{
      picker.value=button.dataset.priorityQuestion;
      show(button.dataset.priorityPoint);
      body.querySelector('h2').focus();
    }));
    show(firstCriterion);
  }
  return {eligible,page,mount};
};
