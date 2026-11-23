/* The public trial stores only catalogue references, fictional roster numbers and example choices. */
window.createPreviewFollowups = function (catalogue, getPaper, figure, esc) {
  'use strict';
  const prefix='eduflow-hk-preview:point-practice:v1:';
  const sourceFor=(paper,q)=>EduFlowQuestionBank.resolveParallelSource(catalogue,q,paper.id);
  const read=key=>{try{return JSON.parse(localStorage.getItem(prefix+key))}catch{return null}};
  const write=(key,data)=>localStorage.setItem(prefix+key,JSON.stringify(data));
  const failure='此瀏覽器未能儲存進度。請檢查網站的儲存權限後重試。';
  const name=n=>'示例學生 '+String(n).padStart(2,'0');
  const linkBack=s=>'#sample-analysis/'+s.paper+'/'+(s.room||'demo')+'/'+s.index+'~'+s.point;
  function matchingRubric(q,base) {
    return q.kind===base.kind && q.criteria.length===base.criteria.length && q.criteria.every(c=>
      base.criteria.some(b=>b.id===c.id && b.max===c.max && b.mode===c.mode && b.label===c.label));
  }
  function keyFor(s) {
    return [s.paper,s.room||'demo',s.index,s.point].join('~');
  }
  function load(key) {
    const s=read(key);
    if (!s || !Number.isInteger(s.index) || !['','1a','1b','2a','2b'].includes(s.room) || keyFor(s)!==key) return null;
    const p=getPaper(s.paper),q=p?.questions[s.index];
    const ref=q && sourceFor(p,q);
    const v=ref?.generator.get(ref.paperId,ref.questionId,s.variant);
    const point=v?.criteria.find(c=>c.id===s.point);
    if (!point || !matchingRubric(q,ref.question) || ref.variant===s.variant ||
        !Array.isArray(s.members) || !s.members.length || s.members.length>9 ||
        !s.members.every(m=>Number.isInteger(m.n) && m.n>=1 && m.n<=9 && Number.isInteger(m.before) && m.before>=0 && m.before<point.max) ||
        new Set(s.members.map(m=>m.n)).size!==s.members.length) return null;
    return {s,p,v,point};
  }
  function status(key,n,max) {
    const submitted=read(key+':submission:'+n);
    const score=read(key+':released:'+n);
    return {submitted:['complete','partial'].includes(submitted)?submitted:null,
      score:Number.isInteger(score) && score>=0 && score<=max?score:null};
  }
  function example(v,point,choice) {
    if (choice==='complete') return [v.sample?.working,v.sample?.answer].filter(Boolean).join('；') || v.solution;
    if (v.kind==='text') return v.criteria.filter(c=>c.id!==point.id).map(c=>c.label).join('。') || '未作答';
    if (point.mode==='manual') return String(v.sample?.answer??v.expected);
    return (v.sample?.working?v.sample.working+'；':'')+'最終答案留白';
  }
  function mountTeacher(root,p,room,index,records,initialPoint) {
    const q=p.questions[index],ref=sourceFor(p,q);
    if (!ref || !matchingRubric(q,ref.question) || !records.length) return;
    const candidates=q.criteria.map((point,i)=>({point,members:records.flatMap((r,j)=>
      Number.isFinite(r[i]) && r[i]<point.max?[{n:j+1,before:r[i]}]:[])})).filter(item=>item.members.length);
    if (!candidates.length) return;
    const box=document.createElement('section');
    box.className='point-practice';
    root.append(box);
    const jump=document.createElement('button');
    jump.className='button';jump.type='button';jump.textContent='跟進這題的失分學生';
    root.querySelector('.report-prompt')?.after(jump);
    box.innerHTML='<h2>按失分點派再練</h2><label>跟進哪個評分點？<select data-point-choice>'+
      candidates.map(({point,members})=>'<option value="'+esc(point.id)+'">'+esc(point.label)+'（'+members.length+' 人未取滿分）</option>').join('')+
      '</select></label><div data-point-body></div><p role="status" data-point-notice></p>';
    const select=box.querySelector('[data-point-choice]'),body=box.querySelector('[data-point-body]'),notice=box.querySelector('[data-point-notice]');
    jump.onclick=()=>{select.focus();box.scrollIntoView({block:'start'})};
    if (candidates.some(c=>c.point.id===initialPoint)) select.value=initialPoint;
    function show() {
      notice.textContent='';
      const {point,members}=candidates.find(c=>c.point.id===select.value);
      const spec={paper:p.id,room:room||'',index,point:point.id,members};
      const key=keyFor(spec),saved=load(key);
      if (saved) { result(saved,key);return; }
      const versions=Array.from({length:ref.generator.count(ref.paperId,ref.questionId)},(_,i)=>i+1).filter(i=>i!==ref.variant);
      body.innerHTML='<p><strong>收件學生</strong>　'+members.map(m=>name(m.n)).join('、')+'</p>'+
        '<label>挑一道再練題<select data-point-version>'+versions.map(i=>'<option value="'+i+'">變式 '+i+'</option>').join('')+'</select></label>'+
        '<div class="point-question" data-point-question></div><button class="button primary" type="button" data-point-dispatch>派給這 '+members.length+' 人</button>';
      const version=body.querySelector('[data-point-version]');
      function preview() {
        const v=ref.generator.get(ref.paperId,ref.questionId,Number(version.value));
        const other=v.criteria.find(c=>c.id===point.id);
        body.querySelector('[data-point-question]').innerHTML='<p>'+esc(v.prompt)+'</p>'+figure(v)+
          '<p><strong>再練會核對</strong>　'+esc(other.label)+'（'+other.max+' 分）</p>';
      }
      version.addEventListener('change',preview);preview();
      body.querySelector('[data-point-dispatch]').onclick=()=>{
        try { if (!load(key)) write(key,{...spec,variant:Number(version.value)});show(); }
        catch { notice.textContent=failure; }
      };
    }
    function result({s,v,point},key) {
      const rows=s.members.map(m=>({...m,...status(key,m.n,point.max)}));
      const attained=rows.filter(m=>m.score===point.max).length;
      const needs=rows.filter(m=>m.score!==null && m.score<point.max).length;
      body.innerHTML='<div class="point-question"><strong>已派變式 '+s.variant+'</strong><p>'+esc(v.prompt)+'</p>'+figure(v)+
        '<p>再練評分點　'+esc(point.label)+'</p></div>'+
        '<h3>同一批學生的前後表現</h3><p class="point-totals" aria-live="polite">已取滿分 '+attained+' 人　·　仍需跟進 '+needs+' 人　·　待發布 '+(rows.length-attained-needs)+' 人</p>'+
        (rows.some(r=>!r.submitted)?'<button class="button" type="button" data-fixture>載入未交學生的示例作答</button>':'')+
        '<ul class="point-roster">'+rows.map(m=>{
          const student='<a href="#sample-followup/'+esc(key)+'/'+m.n+'">'+name(m.n)+'的作業</a>';
          const before='原題 '+m.before+'/'+point.max+' 分';
          if (m.score!==null) return '<li>'+student+'<p>'+before+'　→　再練 '+m.score+'/'+point.max+' 分（已發布）</p></li>';
          if (!m.submitted) return '<li>'+student+'<p>'+before+'　·　待交再練</p></li>';
          const sample=example(v,point,m.submitted);
          return '<li>'+student+'<p>'+before+'　·　已交，待老師核對</p><p class="point-response">'+esc(sample)+'</p>'+
            '<form data-point-release="'+m.n+'"><label>本項給分<select name="score" required><option value="">選擇分數</option>'+
            Array.from({length:point.max+1},(_,i)=>'<option value="'+i+'">'+i+' / '+point.max+'</option>').join('')+
            '</select></label><button class="button" type="submit">確認並發布</button></form></li>';
        }).join('')+'</ul>';
      const fill=body.querySelector('[data-fixture]');
      if(fill) fill.onclick=()=>{
        try { rows.forEach((m,j)=>{if(!status(key,m.n,point.max).submitted)write(key+':submission:'+m.n,j%3===1?'partial':'complete')});show(); }
        catch { notice.textContent=failure; }
      };
      body.querySelectorAll('[data-point-release]').forEach(form=>form.onsubmit=e=>{
        e.preventDefault();
        if(!form.reportValidity())return;
        try {
          const n=Number(form.dataset.pointRelease);
          if(status(key,n,point.max).score===null) write(key+':released:'+n,Number(form.elements.score.value));
          show();
        } catch { notice.textContent=failure; }
      });
    }
    select.addEventListener('change',show);show();
    const refresh=e=>{
      if (!box.isConnected) { window.removeEventListener('storage',refresh);return; }
      const key=prefix+keyFor({paper:p.id,room,index,point:select.value});
      if (e.key===null || e.key===key || e.key?.startsWith(key+':')) show();
    };
    window.addEventListener('storage',refresh);
    window.addEventListener('hashchange',()=>window.removeEventListener('storage',refresh),{once:true});
  }
  function student(root,key,n) {
    const loaded=load(key);
    if (!loaded || !loaded.s.members.some(m=>m.n===n)) {
      root.innerHTML='<h1>找不到示例再練</h1><p>請在派發這次再練的瀏覽器打開作業。</p><a href="schools.html#parallel-papers">返回學校試用</a>';return;
    }
    const {s,p,v,point}=loaded;
    const render=()=>{
      const st=status(key,n,point.max);
      root.innerHTML='<section class="trial-answer-report"><a class="back-link" href="'+esc(linkBack(s))+'">返回老師的再練報告</a>'+
        '<header><p>'+name(n)+' · '+esc(p.year+p.subject)+'</p><h1>我的再練作業</h1><p>'+esc(p.title)+' · 第 '+(s.index+1)+' 題同類練習</p></header>'+
        '<section class="point-practice"><p>'+esc(v.prompt)+'</p>'+figure(v)+
        (st.submitted?'<h2>已交的示例作答</h2><p>'+esc(example(v,point,st.submitted))+'</p>'+
          (st.score===null?'<p>等候老師發布評分。</p>':'<p><strong>已發布　'+st.score+' / '+point.max+' 分</strong></p><p>'+esc(point.label)+'</p>'):
          '<form><fieldset><legend>試交一份虛構作答</legend>'+['complete','partial'].map((k,i)=>
            '<label><input type="radio" name="sample" value="'+k+'" '+(!i?'checked':'')+'> 作答 '+(i+1)+'　'+esc(example(v,point,k))+'</label>').join('')+
            '</fieldset><button class="button primary" type="submit">提交所選作答</button></form>')+
        '<p data-error role="status"></p></section></section>';
      const form=root.querySelector('form');
      if(form)form.onsubmit=e=>{
        e.preventDefault();
        try { if(!status(key,n,point.max).submitted)write(key+':submission:'+n,form.elements.sample.value);render(); }
        catch { root.querySelector('[data-error]').textContent=failure; }
      };
    };
    render();
  }
  return {mountTeacher,student};
};
