/* Hallmark component integration: hero and public navigation only. */
(function(){
const arrow='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
const chevron='<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>';
const groupLinks={platform:['platform','product-prep','product-classroom','product-grading','product-insights'],resources:['resource-center','maths','unit','question-library','teaching-library'],guide:['help','teacher-guide','student-guide','faq']};
function shortcut(path,label){return `<a href="#${path}"><span>${label}</span>${arrow}</a>`}
function productSection(path,title,description,extra=''){return `<section class="hf-product-section"><a class="hf-product-link" href="#${path}"><h3>${title}</h3><p>${description}</p>${extra?'':arrow}</a>${extra}</section>`}
function menuContent(kind){
 if(kind==='platform')return productSection('platform','EduFlow 教學','從你熟悉的校本教材開始。',`<div class="hf-shortcuts">${shortcut('product-prep','教材與備課')}${shortcut('product-classroom','互動課堂')}</div>`)+productSection('product-grading','作業與評改','並排核對原卷、評分點與學習回饋。')+productSection('product-insights','學情與跟進','從學生作答，找到需要重溫的內容。');
 if(kind==='resources')return productSection('maths','數學課程','小五分數與分數除法。',`<div class="hf-shortcuts">${shortcut('unit','學習單元')}${shortcut('resource-center','全部資源')}</div>`)+productSection('question-library','題庫與工作紙','挑選題目，預覽課堂工作紙。')+productSection('teaching-library','教材與活動','教案、圖像探索與單元練習。');
 return [['help','幫助中心'],['teacher-guide','教師入門'],['student-guide','學生入門'],['faq','常見問題']].map(([path,label])=>`<a class="hf-simple-link" href="#${path}">${label}</a>`).join('');
}
function navMenu(kind,label,view){return `<div class="hf-menu ${kind==='guide'?'hf-menu-compact':''}" data-menu="${kind}"><button class="hf-nav-trigger ${groupLinks[kind].includes(view)?'hf-selected':''}" type="button" aria-expanded="false" aria-controls="hf-panel-${kind}">${label}${chevron}</button><div id="hf-panel-${kind}" class="hf-panel" hidden>${menuContent(kind)}</div></div>`}
function header(view='landing'){return `<div class="hf-header-inner"><a class="hf-brand" href="#landing" aria-label="EduFlow HK 首頁"><span class="hf-logo-letter" aria-hidden="true">e</span><span class="hf-wordmark">EduFlow <small>HK</small></span></a><button type="button" class="hf-mobile-toggle" aria-label="開啟選單" aria-expanded="false" aria-controls="hf-main-nav"><span>選單</span><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div id="hf-main-nav" class="hf-nav" role="navigation" aria-label="網站導覽"><a class="hf-nav-link ${view==='landing'?'hf-selected':''}" href="#landing">首頁</a>${navMenu('platform','教學平台',view)}${navMenu('resources','教學資源',view)}<a class="hf-nav-link ${['schools','for-teachers','for-students','implementation','data-safety'].includes(view)?'hf-selected':''}" href="#schools">學校方案</a>${navMenu('guide','使用指南',view)}<a class="hf-nav-link ${view==='about'?'hf-selected':''}" href="#about">關於平台</a><a class="hf-enter" href="assessment.html">進入平台</a></div></div>`}
function hero(){return `<section class="hf-hero" aria-labelledby="hf-hero-title"><div class="hf-hero-copy"><h1 id="hf-hero-title">香港校本<br>AI 教與學平台</h1><p class="hf-hero-lead">從教材、課堂到作業評改，<br>由教師掌握每一步。</p><div class="hf-hero-actions"><a class="hf-primary" href="assessment.html">試用試題及改卷</a><a class="hf-secondary" href="#platform">了解平台</a></div><p class="hf-hero-note">首期示範為小五數學分數單元。</p></div><figure class="hf-hero-visual"><img src="classroom-hero.png?v=hallmark-first-screen" alt="老師與兩位學生使用分數材料學習的課堂情境示意圖" width="1448" height="1086" fetchpriority="high"><figcaption>AI 生成課堂示意圖</figcaption></figure></section>`}
let closeTimer;
function closeMenus(except){document.querySelectorAll('.hf-menu').forEach(menu=>{if(menu===except)return;menu.querySelector('button').setAttribute('aria-expanded','false');menu.querySelector('.hf-panel').hidden=true;menu.dataset.hover='false'})}
function openMenu(menu,hover=false){clearTimeout(closeTimer);closeMenus(menu);menu.querySelector('button').setAttribute('aria-expanded','true');menu.querySelector('.hf-panel').hidden=false;menu.dataset.hover=String(hover)}
function bind(root){
 clearTimeout(closeTimer);
 const toggle=root.querySelector('.hf-mobile-toggle');
 toggle.onclick=()=>{const opened=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',opened?'關閉選單':'開啟選單');root.classList.toggle('hf-mobile-open',opened);if(!opened)closeMenus()};
 root.querySelectorAll('.hf-menu').forEach(menu=>{
  const button=menu.querySelector('.hf-nav-trigger');
  button.onclick=event=>{clearTimeout(closeTimer);if(event.detail>0&&menu.dataset.hover==='true'){menu.dataset.hover='false';return}if(button.getAttribute('aria-expanded')==='true')closeMenus();else openMenu(menu)};
  button.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();openMenu(menu);menu.querySelector('.hf-panel a').focus()}};
  menu.onpointerenter=event=>{clearTimeout(closeTimer);if(event.pointerType==='mouse'&&matchMedia('(min-width:1001px)').matches&&button.getAttribute('aria-expanded')!=='true')openMenu(menu,true)};
  menu.onpointerleave=()=>{if(!matchMedia('(min-width:1001px)').matches)return;closeTimer=setTimeout(()=>{if(!menu.contains(document.activeElement))closeMenus()},180)};
 });
}
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.hf-menu'))closeMenus()});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const current=document.querySelector('.hf-nav-trigger[aria-expanded="true"]');if(current){closeMenus();current.focus()}else{const toggle=document.querySelector('.hf-mobile-toggle[aria-expanded="true"]');if(toggle){toggle.click();toggle.focus()}}});
window.HallmarkFirstScreen={header,hero,bind};
if(typeof views!=='undefined'&&typeof siteHeader==='function'){
 const previousHeader=siteHeader;
 siteHeader=function(view){previousHeader(view);const element=document.querySelector('.sidebar');element.classList.toggle('hf-header',publicViews.has(view));if(publicViews.has(view)){element.innerHTML=header(view);bind(element)}};
 const previousLanding=views.landing;
 views.landing=function(){const template=document.createElement('template');template.innerHTML=previousLanding();const oldHero=template.content.querySelector('.ed-hero');if(oldHero)oldHero.outerHTML=hero();return template.innerHTML};
 render();
}else{const element=document.querySelector('.hf-header');if(element)bind(element)}
})();
