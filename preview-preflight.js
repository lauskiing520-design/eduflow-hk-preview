/* Public trial keeps only references to catalogue questions, never student work. */
function createPreviewPreflight(catalogue, esc) {
  'use strict';
  const prefix = 'eduflow-hk-preview:paper-copy:v1:';
  const sources = new Map(catalogue.map(p => [p.id, p]));
  const copies = new Map();
  const copyId = /^trial-[a-f0-9-]{36}$/;
  const refs = p => p.questions.map(q => [p.id, q.id]);
  function materialise(spec) {
    const original = sources.get(spec?.base);
    if (!copyId.test(spec?.id) || !original || !Array.isArray(spec.refs) ||
        spec.refs.length !== original.questions.length) return null;
    const questions = [];
    for (const [i, ref] of spec.refs.entries()) {
      if (!Array.isArray(ref)) return null;
      const paper = sources.get(ref[0]), q = paper?.questions.find(item => item.id === ref[1]);
      if (!q || paper.subject !== original.subject || paper.year !== original.year ||
          (q.source?.type === 'adapted' && paper !== original)) return null;
      questions.push({...q, id:original.questions[i].id});
    }
    return {...original,id:spec.id,title:original.title + '（試改本 ' + spec.id.slice(6,12) + '）',questions};
  }
  function sync(register) {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (copies.has(id)) continue;
        let spec;
        try { spec = JSON.parse(localStorage.getItem(key)); } catch { continue; }
        if (spec?.id !== id) continue;
        const p = materialise(spec);
        if (p) { copies.set(id,spec); register(p); }
      }
    } catch { /* The original catalogue is always available. */ }
  }
  function base(p) { return sources.get(copies.get(p.id)?.base || p.id); }
  function companion(p) { return PaperPreflight.findCompanion(base(p),catalogue); }
  function choices(p, index) {
    const candidates = [];
    const prompts = new Set(p.questions.map(q => q.prompt));
    const max = q => q.criteria.reduce((sum,c) => sum+c.max,0);
    for (const source of catalogue) {
      if (source.subject !== p.subject || source.year !== p.year) continue;
      for (const q of source.questions) {
        if (prompts.has(q.prompt) || q.source?.type === 'adapted') continue;
        const target = p.questions[index];
        const rank = (q.topic === target.topic ? 4 : 0) + (max(q) === max(target) ? 2 : 0) + (q.kind === target.kind ? 1 : 0);
        candidates.push({source,q,rank});
      }
    }
    return candidates.sort((a,b) => b.rank-a.rank);
  }
  function report(p, original = p) {
    const other = companion(original);
    const audit = PaperPreflight.analyze(p,other);
    return window.EduFlowPreflightReport.renderReport(audit);
  }
  function page(p,room) {
    const suffix = room ? '/'+room : '';
    return '<section class="preview-preflight"><a class="back-link" href="#paper/'+esc(p.id)+suffix+'">返回試卷預覽</a>'+
      '<header class="page-heading"><h1>出卷前檢查</h1><p>'+esc(p.title)+'</p><div class="actions"><button class="button" type="button" id="pf-edit">從題庫換一題</button><button class="button primary" type="button" id="pf-save-top" hidden>另存並預覽試改本</button></div></header>'+
      '<div id="pf-report">'+report(p)+'</div>'+
      '<section class="pf-trial-edit"><h2>從題庫換一題</h2><p>先看換題後的檢查結果，再另存試改本。試改本可在這個瀏覽器預覽、列印及派給示例班級。</p>'+
      '<label>要替換的題目<select id="pf-index">'+p.questions.map((q,i)=>'<option value="'+i+'">第 '+(i+1)+' 題 · '+esc(q.topic || q.prompt.slice(0,20))+'</option>').join('')+'</select></label>'+
      '<p id="pf-old"></p><label>替換題目<select id="pf-candidate"></select></label><p id="pf-new"></p>'+
      '<div class="actions"><button class="button" type="button" id="pf-try">試換並重新檢查</button><button class="button primary" type="button" id="pf-save" hidden>另存並預覽試改本</button></div>'+
      '<p role="status" id="pf-status"></p></section>'+
      '<a class="button" id="pf-dispatch" href="#assign/'+esc(p.id)+suffix+'">繼續派發目前試卷</a></section>';
  }
  function mount(p,room,register) {
    const byId = id => document.getElementById(id);
    const select = byId('pf-index'), picker = byId('pf-candidate');
    let candidates, proposal;
    byId('pf-edit').addEventListener('click',() => {select.focus();select.scrollIntoView({block:'center'});});
    byId('pf-report').addEventListener('click',event => {
      const button = event.target.closest('[data-pf-ref]');
      if (button) window.EduFlowPreflightReport.jump(byId('pf-report'),button.dataset.pfRef);
    });
    function reset() {
      if (proposal) byId('pf-report').innerHTML = report(p);
      proposal = null;
      byId('pf-dispatch').hidden = false;
      byId('pf-save').hidden = byId('pf-save-top').hidden = true;
      byId('pf-status').textContent = '';
      byId('pf-new').textContent = candidates[Number(picker.value)]?.q.prompt || '此科及年級暫無其他可替換題目。';
      byId('pf-try').disabled = !candidates.length;
    }
    function list() {
      const index = Number(select.value);
      byId('pf-old').textContent = p.questions[index].prompt;
      candidates = choices(p,index);
      picker.replaceChildren(...candidates.map(({source,q},i) =>
        new Option(source.title+' · 第 '+(source.questions.indexOf(q)+1)+' 題 · '+(q.topic||'短答'),String(i))));
      picker.disabled = !candidates.length; reset();
    }
    select.addEventListener('change',list); picker.addEventListener('change',reset); list();
    byId('pf-try').addEventListener('click',() => {
      const index = Number(select.value), item = candidates[Number(picker.value)];
      if (!item) return;
      const refsNow = [...(copies.get(p.id)?.refs || refs(p))];
      refsNow[index] = [item.source.id,item.q.id];
      proposal = {id:'trial-'+crypto.randomUUID(),base:base(p).id,refs:refsNow};
      const trial = materialise(proposal);
      byId('pf-report').innerHTML = report(trial,p);
      byId('pf-save').hidden = byId('pf-save-top').hidden = false;
      byId('pf-dispatch').hidden = true;
      byId('pf-status').textContent = '已按替換後的第 '+(index+1)+' 題重新檢查。請查看上方報告，再決定是否另存。';
      byId('pf-save-top').focus();
      byId('pf-save-top').scrollIntoView({block:'center'});
    });
    function save() {
      if (!proposal) return;
      try { localStorage.setItem(prefix+proposal.id, JSON.stringify(proposal)); }
      catch { byId('pf-status').textContent = '瀏覽器未能儲存試改本，請檢查網站儲存空間後重試。'; return; }
      const next = materialise(proposal);
      copies.set(next.id,proposal); register(next);
      location.hash = 'paper/'+next.id+(room?'/'+room:'');
    }
    byId('pf-save').addEventListener('click',save);
    byId('pf-save-top').addEventListener('click',save);
  }
  return {sync, page, mount, addSource(paper) { sources.set(paper.id,paper); }};
}
