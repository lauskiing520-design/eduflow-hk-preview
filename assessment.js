(function(){
'use strict';
// Public workbench for catalogue papers and browser-local teacher trials.
const C=AssessmentCore;

const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trialPreflight=createPreviewPreflight(AssessmentData.papers,esc);
const trialBank=createPreviewQuestionBank(AssessmentData.papers);
const trialReport=createPreviewAnswerReport(AssessmentData.papers,esc);
const papers=[...AssessmentData.papers];
function questionFigure(q){return q.diagram&&/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(q.diagram)?`<figure class="question-figure"><img src="${q.diagram}" alt="${esc(q.diagramAlt||'幾何示意圖')}"><figcaption>示意圖，不按比例繪製；以題目所列條件為準。</figcaption></figure>`:''}

function getPaper(id){return papers.find(p=>p.id===String(id||'').split('~')[0])}

function href(route,label,primary=false){return `<a class="button ${primary?'primary':''}" href="#${route}">${label}</a>`}
function heading(title,description,back='papers',backLabel='試卷列表'){return `<div class="page-heading"><a class="back-link" href="#${back}">${backLabel}</a><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`}
function paperName(p){return p.year+p.subject+'：'+p.title}

function maxQuestion(q){return q.criteria.reduce((n,c)=>n+c.max,0)}

const libraryFilters=[
 ['bank','全部試卷',()=>true],
 ['math','數學',p=>p.subject==='數學'],
 ['science','科學',p=>p.subject==='科學'],
 ...[['chinese','中國語文'],['english','英國語文'],['ict','資訊科技']].map(([id,label])=>[id,label,p=>p.subject===label])
];
let libraryBack='papers';
function hub(filter='bank'){
 const current=libraryFilters.find(([id])=>id===filter)||libraryFilters[0];
 libraryBack=current[0]==='bank'?'papers':'papers/'+current[0];
 const tabs=libraryFilters.map(([id,label,matches])=>`<a href="#papers/${id}" ${id===current[0]?'aria-current="page"':''}>${label} <small>${papers.filter(matches).length}</small></a>`).join('');
 const rows=papers.filter(current[2]).map(p=>{
  const topics=[...new Set(p.questions.map(q=>q.topic).filter(Boolean))];
  return `<article class="library-row"><div><p class="library-subject">${esc(p.year)} · ${esc(p.subject)}</p><h2><a href="#paper/${esc(p.id)}">${esc(p.title)}</a></h2>${topics.length>1?`<p class="library-meta">${esc(topics.slice(0,3).join('、'))}</p>`:''}<p class="library-meta">${p.questions.length} 題　·　${C.totalMax(p)} 分　·　${p.minutes} 分鐘</p></div><div class="actions">${href('paper/'+p.id,'預覽試卷')}${href('assign/'+p.id,'派給班級',true)}</div></article>`;
 }).join('');
 return `<div class="exam-library"><header class="workspace-title"><div><h1>試卷列表</h1><p>選用現成試卷，或從題庫逐題挑選，組成適合自己班級的一份卷。</p></div>${href('question-bank','從題庫組卷',true)}</header><nav class="library-tabs" aria-label="篩選試卷">${tabs}</nav>${rows}</div>`;
}

function keyContent(p){return `<section class="teacher-key"><h2>教師參考答案及評分準則</h2><p>接受等值方法及合理文字表達；以下不是逐字匹配的短答答案。</p>${p.questions.map((q,i)=>`<details><summary>第 ${i+1} 題 · ${maxQuestion(q)} 分</summary><p>${esc(q.solution)}</p><ul>${q.criteria.map(c=>`<li>${esc(c.label)}（${c.max} 分；${c.mode==='auto'?'可按客觀答案比對':'教師覆核'}）</li>`).join('')}</ul></details>`).join('')}</section>`}
function printablePaperPage(p){return `${heading('列印空白試卷',paperName(p),'paper/'+p.id,'返回試卷預覽')}<div class="page-actions"><button type="button" class="button primary" data-action="print-paper">列印空白試卷</button></div><article class="print-paper"><header><p>${esc(p.year)}${esc(p.subject)} · ${p.questions[0]?.source?.type==='adapted'?esc(p.description):'試卷'}</p><h2>${esc(p.title)}</h2><p>${p.questions.length} 題，共 ${C.totalMax(p)} 分，建議 ${p.minutes} 分鐘</p>${sourceCredit(p)}<p class="print-candidate">姓名：_______________　班別：_______　日期：_______</p></header>${p.questions.map((q,i)=>`<section class="paper-question"><h3>${i+1}. ${esc(q.prompt)} <small>（${maxQuestion(q)} 分）</small></h3>${sourceLocator(p,q)}${questionFigure(q)}${q.kind==='choice'?`<ol type="A">${q.options.map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`:`<div class="paper-answer-space ${q.working||q.kind==='text'?'tall':''}"></div>`}</section>`).join('')}</article>`}

const sourceCredit = window.EduFlowSources.credit;
function sourceLocator(p,q){return window.EduFlowSources.locator(q)}
function sheetQuestion(p,q,i){return `<article class="paper-screen-question" id="preview-question-${i}"><div class="paper-question-meta"><strong>第 ${i+1} 題</strong><span>${q.kind==='choice'?'選擇題':q.working?'計算與步驟':'短答題'} / ${maxQuestion(q)} 分</span></div><div class="sheet-problem"><h3>${esc(q.prompt)}</h3>${questionFigure(q)}</div>${sourceLocator(p,q)}${q.kind==='choice'?`<ol type="A">${q.options.map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`:''}</article>`}
function paperPage(p,room){
 const suffix=room?'/'+room:'';
 return `<div class="teacher-sheet"><a class="sheet-back" href="#${libraryBack}">返回試卷列表</a>
 <header class="sheet-head"><div><p>${esc(p.year)} · ${esc(p.subject)}</p><h1>${esc(p.title)}</h1><p>${p.questions.length} 題　·　${C.totalMax(p)} 分　·　建議 ${p.minutes} 分鐘</p></div>
 <div class="sheet-actions">${href('assign/'+p.id+suffix,'派給班級',true)}${href('preflight/'+p.id+suffix,'出卷前檢查')}${href('key/'+p.id,'參考答案及評分準則')}${href('print/'+p.id,'列印預覽')}</div></header>
 ${sourceCredit(p)}<div class="sheet-body"><aside><h2>試題目錄</h2><nav class="paper-index" aria-label="試卷題目">${p.questions.map((q,i)=>`<a href="#paper/${esc(p.id)}" data-action="jump-paper-question" data-index="${i}">${i+1}</a>`).join('')}</nav></aside><section class="paper-screen-questions" aria-label="試題預覽">${p.questions.map((q,i)=>sheetQuestion(p,q,i)).join('')}</section></div></div>`;
}

const previewClasses=createPreviewClasses({papers,esc,href,heading,sheetQuestion,sourceCredit,syncPapers,onRecordsChange:render});
function registerPaper(copy){if(!getPaper(copy.id)){papers.push(copy);previewClasses.registerPaper(copy)}}
function syncPapers(){
 trialBank.sync(p=>{trialPreflight.addSource(p);registerPaper(p)});
 trialPreflight.sync(registerPaper);
}
function retiredRoute(view,key,p){
 const marking='<a class="button primary" href="marking-demo.html">試改示例答卷</a>';
 if(['upload','intake','split','scan','review','result'].includes(view)||view==='tasks'&&key==='scans'){
  return ['改卷示範',heading('試改手寫答卷','公開示範提供一份數學答卷，可核對評分、寫批註，再查看學生收到的結果。上傳自己的答卷需使用學校專屬工作台。')+marking];
 }
 if(view==='answer'&&p){
  return ['學生作業',heading(p.title,'將這份卷派給示例班級後，可從學生頁打開作業。','paper/'+p.id,'返回試卷預覽')+href('assign/'+p.id,'派給班級',true)];
 }
 if(['custom','generate','builder'].includes(view)||view==='tasks'&&key==='builders'){
  return ['選擇試卷',heading('選擇試卷','上傳校本試卷及建立出題草稿需使用學校專屬工作台。此處可選用中一及中二試卷，預覽或試派給班級。')+href('papers','選擇內置試卷',true)];
 }
 if(['tasks','homework','dispatch'].includes(view)){
  return ['班級作業',heading('查看示例作業','試派過的卷可在這個瀏覽器的「班級與作業」查看；學校的處理任務和學生記錄需在專屬工作台開啟。')+href('classes','查看班級與作業',true)];
 }
 return ['找不到頁面',heading('找不到這個頁面','請從試卷列表重新選卷或打開班級作業。')+href('papers','返回試卷列表',true)];
}
function render(){
 document.body.removeAttribute('data-print');
 const [view,key,num]=(location.hash.slice(1)||'papers').split('/');
 syncPapers();
 const room=['1a','1b','2a','2b'].includes(num)?num:'';
 const p=getPaper(key);
 let html,title,activeTab='papers';
 const preview=previewClasses.route(view,key,num);
 if(preview){[title,html]=preview;activeTab='classes'}
 else if(view==='question-bank'){title='從題庫組卷';html='<section id="question-bank"></section>';activeTab='question-bank'}
 else if(view==='sample-analysis'&&trialReport.eligible(p)){title='全班常見錯答';html=trialReport.page(p,room);activeTab='classes'}
 else if(view==='papers'){title='試卷列表';html=hub(key)}
 else if((view==='paper'||view==='ready')&&p){title=paperName(p);html=paperPage(p,room)}
 else if(view==='preflight'&&p){title='出卷前檢查';html=trialPreflight.page(p,room)}
 else if(view==='key'&&p){title='參考答案及評分準則';html=heading(p.title,p.year+' · '+p.subject,'paper/'+p.id,'返回試卷預覽')+keyContent(p)}
 else if(view==='print'&&p){title='列印空白試卷';html=printablePaperPage(p)}
 else if(view==='marking'){location.replace('marking-demo.html');return}
 else {[title,html]=retiredRoute(view,key,p);activeTab=''}
 $('#assessmentApp').innerHTML=html;
 if(view==='question-bank')trialBank.mount($('#question-bank'),paper=>{syncPapers();location.hash='paper/'+paper.id},key==='equations');
 if(view==='sample-analysis'&&trialReport.eligible(p))trialReport.mount($('#assessmentApp'),p);
 if(view==='preflight'&&p) trialPreflight.mount(p,room,copy=>{registerPaper(copy);previewClasses.carryDue(p.id,copy.id,room)});
 const assignmentForm=$('#sample-assignment');
 if(assignmentForm)previewClasses.restoreDue(assignmentForm);
 document.title=title+'｜EduFlow HK';
 document.querySelectorAll('.app-header [data-nav]').forEach(link=>{
  const active=link.dataset.nav===activeTab;
  link.classList.toggle('active',active);
  if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
}

document.addEventListener('click', event => {
 const button = event.target.closest('[data-action]');
 if (!button) return;
 if (button.dataset.action === 'jump-paper-question') {
  event.preventDefault();
  document.getElementById('preview-question-' + button.dataset.index)?.scrollIntoView({block:'start'});
 } else if (button.dataset.action === 'print-paper') {
  document.body.dataset.print = 'paper';
  window.print();
 }
});
window.addEventListener('hashchange', () => {
 render();
 window.scrollTo(0, 0);
});
window.addEventListener('afterprint', () => document.body.removeAttribute('data-print'));
render();
})();
