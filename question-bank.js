(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const variants = () => window.EduEquationVariants;
  const points = question => question.criteria.reduce((sum, criterion) => sum + criterion.max, 0);
  const kind = question => ({number:'數值題', text:'文字題', choice:'選擇題'})[question.kind] || '其他';
  const clone = value => JSON.parse(JSON.stringify(value));
  const keyOf = ref => JSON.stringify([ref.paperId, ref.questionId, ref.variant || 0]);

  function selected(papers, refs) {
    if (!Array.isArray(refs) || refs.length > 20) throw Error('每份試卷最多選 20 題。');
    const prompts = new Set();
    let first, total = 0;
    return refs.map((ref, i) => {
      const paper = papers.find(p => p.id === ref.paperId);
      const base = paper?.questions.find(q => q.id === ref.questionId);
      const question = ref.variant ? variants()?.get(ref.paperId, ref.questionId, ref.variant) : base;
      if (!base || !question) throw Error('找不到所選題目或變式。');
      if (first && (first.year !== paper.year || first.subject !== paper.subject)) throw Error('同一份卷只可選同年級、同科的題目。');
      first = paper;
      const prompt = question.prompt.trim();
      if (prompts.has(prompt)) throw Error('卷內已有相同題目。');
      prompts.add(prompt);
      total += points(question);
      if (total > 200) throw Error('每份試卷最多 200 分。');
      return {ref, paper, question, number:i+1};
    });
  }

  function assemble(papers, draft, id, revision) {
    const rows = selected(papers, draft.refs);
    if (!rows.length || !draft.title?.trim()) throw Error('請填寫試卷名稱並選取至少一題。');
    if (draft.title.length > 120 || !Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 240) throw Error('試卷名稱最多 120 字，建議時間須為 1 至 240 分鐘。');
    const {year,subject} = rows[0].paper;
    const questions = rows.map(({ref, paper, question, number}) => {
      const q = clone(question);
      q.id = 'q'+number;
      q.bankOrigin = {...ref, variant:ref.variant || 0};
      if (paper.attribution && q.source?.type === 'adapted') q.sourceNotice = paper.attribution;
      return q;
    });
    return {id,revision,title:draft.title.trim(),minutes:draft.minutes,year,subject,custom:true,bankAssembled:true,description:'老師從題庫選編',questions};
  }

  function mount(root, {papers, draft, save, finish, onCreated, savedLabel='草稿已儲存至伺服器', backHref='#papers'}) {
    const data = clone(draft);
    const all = papers.flatMap(paper => paper.questions.map(question => ({paper,question})));
    const pageSize = 8;
    const versionChoices = new Map();
    let page = 0, timer, inFlight, busy = false, dirty = false, conflict = false;
    const $ = sel => root.querySelector(sel);
    const options = (items, caption) => '<option value="">'+esc(caption)+'</option>'+[...new Set(items.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-HK')).map(t=>'<option>'+esc(t)+'</option>').join('');
    root.classList.add('question-bank');
    root.innerHTML = `<a class="sheet-back" href="${esc(backHref)}">返回試卷列表</a>
      <header class="qb-header"><h1>選題組卷</h1><p>搜尋單題，按教學進度選入試卷。確認後可列印或派給班級。</p></header>
      <div class="qb-layout"><section aria-label="題庫"><div class="qb-search"><label>搜尋題目<input type="search" data-qb="search" placeholder="輸入考點、題目或原卷名稱"></label>
      <div class="qb-filters"><label>年級<select aria-label="年級" data-qb="year">${options(papers.map(p=>p.year),'全部年級')}</select></label><label>科目<select aria-label="科目" data-qb="subject">${options(papers.map(p=>p.subject),'全部科目')}</select></label>
      <label>課題<select aria-label="課題" data-qb="topic"></select></label><label>題型<select aria-label="題型" data-qb="kind">${options(all.map(r=>kind(r.question)),'全部題型')}</select></label>
      <label>難度<select aria-label="難度" data-qb="difficulty">${options(all.map(r=>r.question.difficulty||'未標示'),'全部難度')}</select></label>
      <label>題目特色<select aria-label="題目特色" data-qb="feature"><option value="">不限</option><option value="diagram">附圖</option><option value="variants">可換變式</option></select></label></div></div>
      <div class="qb-result-head"><h2>題庫</h2><span data-qb="count" aria-live="polite"></span><button type="button" class="button qb-cart-jump" data-qb-action="cart">查看已選題目</button></div><div data-qb="rows"></div><div class="qb-pages" data-qb="paging"></div></section>
      <aside class="qb-cart"><h2>我的組卷</h2><label>試卷名稱<input data-qb="title" maxlength="120" placeholder="例如：中一方程小測"></label><label>建議時間（分鐘）<input data-qb="minutes" type="number" min="1" max="240"></label>
      <p data-qb="summary"></p><ol data-qb="chosen"></ol><button type="button" class="button primary" data-qb-action="finish">確認並預覽試卷</button>
      <p class="qb-state" role="status" data-qb="state"></p><button class="text-button" data-qb-action="retry" hidden>重試儲存</button><button class="text-button" data-qb-action="reload" hidden>讀取最新草稿</button></aside></div>`;
    const field = name => $('[data-qb="'+name+'"]');
    function status(message) { field('state').textContent = message; }
    function showRetry(show, stale=false) {
      $('[data-qb-action="retry"]').hidden = !show || stale;
      $('[data-qb-action="reload"]').hidden = !stale;
    }
    function refreshTopics() {
      const topic = field('topic'), prior = topic.value;
      const available = all.filter(({paper}) => (!field('year').value || paper.year === field('year').value) && (!field('subject').value || paper.subject === field('subject').value));
      topic.innerHTML = options(available.map(r=>r.question.topic), '全部課題');
      if ([...topic.options].some(o=>o.value===prior)) topic.value = prior;
    }
    function drawResults() {
      const terms = field('search').value.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
      const list = all.filter(({paper,question:q}) => {
        if (['year','subject'].some(k=>field(k).value && field(k).value!==paper[k])) return false;
        if (field('topic').value && field('topic').value!==q.topic) return false;
        if (field('kind').value && field('kind').value!==kind(q)) return false;
        if (field('difficulty').value && field('difficulty').value!==(q.difficulty||'未標示')) return false;
        if (field('feature').value === 'diagram' && !q.diagram) return false;
        if (field('feature').value === 'variants' && !variants()?.count(paper.id,q.id)) return false;
        const haystack = [paper.year,paper.subject,paper.title,q.topic,q.prompt].join(' ').normalize('NFKC').toLocaleLowerCase();
        return terms.every(t=>haystack.includes(t));
      });
      const pages = Math.ceil(list.length/pageSize);
      page = Math.max(0,Math.min(page,pages-1));
      field('count').textContent = list.length+' 題';
      const first = papers.find(p=>p.id===data.refs[0]?.paperId);
      field('rows').innerHTML = list.slice(page*pageSize,(page+1)*pageSize).map(({paper,question:base})=>{
        const key = keyOf({paperId:paper.id,questionId:base.id}), v = versionChoices.get(key) || 0;
        const q = v ? variants().get(paper.id,base.id,v) : base, count = variants()?.count(paper.id,base.id) || 0;
        const taken = data.refs.some(ref=>ref.paperId===paper.id && ref.questionId===base.id && (ref.variant||0)===v);
        const wrongSubject = first && (first.subject!==paper.subject || first.year!==paper.year);
        const image = /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(q.diagram||'') ? '<img loading="lazy" alt="'+esc(q.diagramAlt||'試題配圖')+'" src="'+esc(q.diagram)+'">' : '';
        return `<article class="qb-item" data-paper="${esc(paper.id)}" data-question="${esc(base.id)}"><p class="qb-meta">${esc(paper.year)} · ${esc(paper.subject)} · ${esc(q.topic||kind(q))} · ${points(q)} 分${q.difficulty?' · 教學編排：'+esc(q.difficulty):''}</p><h3>${esc(q.prompt)}</h3>
          ${q.kind==='choice'?'<ol type="A">'+q.options.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>':''}${image}
          <div class="qb-detail"><small>${esc(paper.title)} · 第 ${paper.questions.indexOf(base)+1} 題</small><details><summary>解法與評分點</summary><p>${esc(q.solution)}</p><ul>${q.criteria.map(c=>'<li>'+esc(c.label)+'（'+c.max+' 分）</li>').join('')}</ul></details></div>
          <div class="qb-tools">${count?'<label>題目版本<select aria-label="題目版本" data-qb-version><option value="0">原題</option>'+Array.from({length:count},(_,i)=>'<option value="'+(i+1)+'" '+(v===i+1?'selected':'')+'>變式 '+(i+1)+'</option>').join('')+'</select></label>':''}
          <button type="button" class="button" data-qb-action="add" ${taken||wrongSubject||busy?'disabled':''}>${taken?'已選入':wrongSubject?'不同年級或科目':'選入試卷'}</button></div></article>`;
      }).join('') || '<p class="qb-empty">找不到符合條件的題目。請更改搜尋字詞或篩選條件。</p>';
      field('paging').innerHTML = pages>1 ? `<button type="button" class="button" data-qb-action="prev" ${page===0?'disabled':''}>上一頁</button><span>第 ${page+1} / ${pages} 頁</span><button type="button" class="button" data-qb-action="next" ${page+1===pages?'disabled':''}>下一頁</button>` : '';
    }
    function drawCart() {
      const rows = selected(papers,data.refs);
      field('summary').textContent = rows.length ? rows[0].paper.year+rows[0].paper.subject+' · '+rows.length+' 題 · '+rows.reduce((sum,r)=>sum+points(r.question),0)+' 分' : '尚未選題';
      field('chosen').innerHTML = rows.map(({number,question,ref})=>`<li><div><strong>${number}.</strong> ${esc(question.prompt)}${ref.variant?'（變式 '+ref.variant+'）':''}</div><div class="qb-order">${[['up','上移',number===1],['down','下移',number===rows.length],['remove','移除',false]].map(([action,label,disabled])=>'<button type="button" data-qb-action="'+action+'" data-index="'+(number-1)+'" aria-label="'+label+'第 '+number+' 題" '+(disabled||busy?'disabled':'')+'>'+label+'</button>').join('')}</div></li>`).join('');
      $('[data-qb-action="finish"]').disabled = busy || !rows.length || !data.title.trim() || conflict;
    }
    async function persist() {
      clearTimeout(timer);
      if (inFlight) { await inFlight; if (dirty) return persist(); return; }
      if (!dirty || conflict) return;
      dirty = false;
      inFlight = (async()=>{
        try {
          const next = await save(clone(data));
          data.revision = next.revision;
          if (!dirty) { status(savedLabel); showRetry(false); }
        } catch (error) {
          dirty = true;
          conflict = /另一部|其他.*草稿|重新讀取|另一個分頁/.test(error.message) || error.code==='bank_conflict';
          status(error.message); showRetry(true,conflict); drawCart(); throw error;
        }
      })();
      try { await inFlight; } finally { inFlight = null; }
      if (dirty) await persist();
    }
    function changed() {
      dirty = true; status('正在儲存組卷草稿…'); showRetry(false,conflict); clearTimeout(timer);
      timer = setTimeout(()=>persist().catch(()=>{}),250);
    }
    const unload = e => { if (dirty || inFlight) { e.preventDefault(); e.returnValue=''; } };
    window.addEventListener('beforeunload',unload);
    const leave = () => { window.removeEventListener('beforeunload',unload); if (dirty && !conflict) persist().catch(()=>{}); };
    window.addEventListener('hashchange',leave,{once:true});
    field('title').value = data.title;
    field('minutes').value = data.minutes;
    refreshTopics(); drawResults(); drawCart();
    status(data.revision ? savedLabel : '選入第一題後會自動儲存草稿。');
    root.addEventListener('input',e=>{
      if (e.target===field('search')) { page=0; drawResults(); }
      if (e.target===field('title')) { data.title=e.target.value; drawCart(); changed(); }
    });
    root.addEventListener('change',e=>{
      if (e.target===field('minutes')) {
        if(!e.target.reportValidity() || !e.target.value){e.target.value=data.minutes;return;}
        data.minutes=Number(e.target.value); changed(); return;
      }
      if(e.target.matches('[data-qb-version]')){
        const row=e.target.closest('.qb-item');
        versionChoices.set(keyOf({paperId:row.dataset.paper,questionId:row.dataset.question}), Number(e.target.value));
        drawResults(); return;
      }
      if(e.target.closest('.qb-filters')) { page=0; if (['year','subject'].includes(e.target.dataset.qb)) refreshTopics(); drawResults(); }
    });
    root.addEventListener('click',async e=>{
      const button = e.target.closest('[data-qb-action]');
      if (!button || busy) return;
      const action=button.dataset.qbAction, i=Number(button.dataset.index);
      if (action==='prev'||action==='next') { page+=action==='prev'?-1:1; drawResults(); return; }
      if (action==='cart') { field('title').focus(); return; }
      if (action==='reload') { window.removeEventListener('beforeunload',unload); location.reload(); return; }
      if (action==='retry') { persist().catch(()=>{}); return; }
      if (conflict) { status('請先讀取最新草稿。'); return; }
      try {
        if (action==='finish') {
          busy=true; drawCart(); root.inert=true;
          try { await persist(); const paper=await finish(clone(data)); onCreated(paper); }
          finally { busy=false; root.inert=false; drawCart(); }
          return;
        }
        if (action==='add') {
          const row=button.closest('.qb-item');
          const ref={paperId:row.dataset.paper,questionId:row.dataset.question,variant:Number(row.querySelector('select')?.value||0)};
          selected(papers,[...data.refs,ref]); data.refs.push(ref);
        } else if(action==='remove') data.refs.splice(i,1);
        else if(action==='up'||action==='down'){const j=i+(action==='up'?-1:1); [data.refs[i],data.refs[j]]=[data.refs[j],data.refs[i]];}
        drawCart(); drawResults(); changed();
      } catch(error) {status(error.message); if (action==='finish' && (error.code==='bank_conflict' || /重新讀取/.test(error.message))) {conflict=true; showRetry(true,true); drawCart();}}
    });
  }
  window.EduFlowQuestionBank={mount,assemble};
})();
