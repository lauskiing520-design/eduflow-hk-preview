/* Fictional department records for the static trial. No server or school credentials. */
window.EduDepartmentSample = (() => {
  const prefix='eduflow-hk-preview:department:v1:';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160"><rect width="360" height="160" fill="white"/><path d="M52 125 L185 32 L305 125 Z" fill="none" stroke="#245381" stroke-width="3"/><g font-family="sans-serif" font-size="18" fill="#16334a"><text x="32" y="145">A</text><text x="308" y="145">B</text><text x="181" y="24">C</text><text x="83" y="118">38°</text><text x="246" y="118">52°</text></g></svg>';
  const diagram='data:image/svg+xml;base64,'+btoa(Array.from(new TextEncoder().encode(svg),n=>String.fromCharCode(n)).join(''));
  const sources=[{id:'sample-school-quiz',title:'校本溫習 · 數與形',year:'中一',subject:'數學',questions:[
    {id:'q1',kind:'number',working:true,topic:'三角形內角',prompt:'圖中 ∠A＝38°，∠B＝52°。求 ∠C，並說明所用性質。',diagram,
      diagramAlt:'三角形 ABC，A 角 38°，B 角 52°。',unit:'°',expected:90,solution:'三角形內角和為 180°，∠C＝180°−38°−52°＝90°。',
      criteria:[{id:'method',mode:'manual',label:'利用三角形內角和列式',max:1},{id:'answer',mode:'auto',label:'得出 90°',max:1}]},
    {id:'q2',kind:'number',working:true,topic:'一元一次方程',prompt:'兩盒相同的筆和三枝散裝筆共有 19 枝。每盒有多少枝筆？',unit:'枝',expected:8,
      solution:'設每盒有 x 枝，2x＋3＝19，所以 x＝8。',criteria:[{id:'method',mode:'manual',label:'以每盒枝數為未知數列式',max:1},{id:'answer',mode:'auto',label:'得出 8 枝',max:1}]}
  ]}];
  let lead=false;
  function state() {
    const records=[];
    for (const p of sources) for (const q of p.questions) {
      const id='dept-'+p.id+'-'+q.id;
      let entry;
      try {entry=JSON.parse(localStorage.getItem(prefix+id));} catch {}
      if (!['approved','pending','rejected'].includes(entry?.status)) continue;
      records.push({id,status:entry.status,rights:entry.rights==='permission'?'permission':'original',
        author:'示例科任老師',reviewer:entry.status==='pending'?'':'示例科組長',feedback:String(entry.feedback||'').slice(0,400),
        paper:{id,title:p.title,year:p.year,subject:p.subject,departmentItem:true,
          questions:[{...q,id:'q1',topic:String(entry.topic||q.topic).slice(0,80),departmentItem:true}]}});
    }
    return {department:'數學科',canReview:lead,items:records,sources};
  }
  function change(b) {
    let record,id;
    if (b.action==='submit') {
      const p=sources.find(x=>x.id===b.paperId),q=p?.questions.find(y=>y.id===b.questionId);
      if (!q || !b.topic?.trim() || !['permission','original'].includes(b.rights)) throw Error('請選題並確認分享權限。');
      id='dept-'+p.id+'-'+q.id;
      const old=state().items.find(v=>v.id===id);
      if (old && old.status!=='rejected') return state();
      if (old && old.rights===b.rights && old.paper.questions[0].topic===b.topic.trim()) {
        throw Error('此示例版本已退回。請按科組意見修改知識點再送審。');
      }
      record={status:'pending',topic:b.topic.trim(),rights:b.rights};
    } else {
      const old=state().items.find(i=>i.id===b.id);
      if (!lead || !old || old.status!=='pending') throw Error('請切換至科組長查看待審題目。');
      if (b.action==='reject' && !b.feedback?.trim()) throw Error('請填寫退回原因。');
      id=old.id;record={status:b.action==='approve'?'approved':'rejected',topic:old.paper.questions[0].topic,rights:old.rights,feedback:b.feedback||''};
    }
    try {localStorage.setItem(prefix+id,JSON.stringify(record));} catch {throw Error('請開啟此網站的瀏覽器儲存權限，再重試。');}
    return state();
  }
  return {state,change,source:id=>sources.find(s=>s.id===id),setLead(value){lead=value;},
    approved:()=>state().items.filter(i=>i.status==='approved').map(i=>i.paper)};
})();
