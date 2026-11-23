/* The public trial stores catalogue references. A standalone paper can be rebuilt after reload. */
window.createPreviewQuestionBank = function (catalogue) {
  'use strict';
  const activeKey = 'eduflow-hk-preview:bank-draft:v1';
  const paperPrefix = 'eduflow-hk-preview:assembled:v1:';
  const validId = /^assembled-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
  const seen = new Set();
  const blank = () => ({id:'assembled-'+crypto.randomUUID(),revision:0,title:'',minutes:30,refs:[]});
  const read = key => JSON.parse(localStorage.getItem(key));
  function valid(draft) {
    return validId.test(draft?.id) && Number.isSafeInteger(draft.revision) && draft.revision >= 0 &&
      typeof draft.title === 'string' && draft.title.length<=120 && Number.isInteger(draft.minutes) &&
      draft.minutes>=1 && draft.minutes<=240 && Array.isArray(draft.refs) && draft.refs.length <= 20 &&
      draft.refs.every(r=>typeof r?.paperId==='string' && typeof r.questionId==='string' &&
        Number.isInteger(r.variant) && r.variant>=0 && r.variant<=10);
  }
  function active(key) {
    const draft = read(key);
    if (!valid(draft) || localStorage.getItem(paperPrefix+draft.id)) return null;
    if (draft.refs.length) {
      try { materialise({...draft,title:draft.title.trim() || '草稿'}); } catch { return null; }
    }
    return draft;
  }
  function checkVersion(draft,key) {
    const current = active(key);
    if (!valid(draft) || (current ? current.id !== draft.id || current.revision !== draft.revision : draft.revision !== 0) ||
        localStorage.getItem(paperPrefix+draft.id)) {
      const conflict = Error('這份草稿已在另一個分頁更新。請重新讀取題庫，再繼續選題。');
      conflict.code='bank_conflict';
      throw conflict;
    }
  }
  function write(key,value) {
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch { throw Error('瀏覽器未能儲存試卷。請檢查此網站的儲存權限或空間後重試。'); }
  }
  async function save(draft,key) {
    checkVersion(draft,key);
    const next = {...draft,revision:draft.revision+1};
    write(key,next);
    return next;
  }
  function materialise(spec) {
    if (!valid(spec)) throw Error('無法讀取這份自選試卷。');
    return EduFlowQuestionBank.assemble(catalogue,spec,spec.id,spec.revision);
  }
  async function finish(draft,key) {
    checkVersion(draft,key);
    const spec = {...draft,revision:draft.revision+1};
    const paper = materialise(spec);
    write(paperPrefix+spec.id,spec);
    return paper;
  }
  function sync(register) {
    let keys;
    try { keys = Object.keys(localStorage); } catch { return; }
    for (const key of keys) {
      if (!key.startsWith(paperPrefix)) continue;
      const id = key.slice(paperPrefix.length);
      if (!validId.test(id) || seen.has(id)) continue;
      let paper;
      try {
        const spec = read(key);
        if (spec?.id !== id) continue;
        paper = materialise(spec);
      } catch { continue; }
      register(paper);
      seen.add(id);
    }
  }
  function mount(root,onCreated,collection,questionRef) {
    const collections = new Set(['equations','percent','inquiry']);
    const sourceScopes={'s1-equations-a':'equations','s1-equations-b':'equations','s2-percent-a':'percent','s2-percent-b':'percent','s1-science-inquiry-full':'inquiry'};
    let draft, scope=collections.has(collection)?collection:Object.hasOwn(sourceScopes,collection)?sourceScopes[collection]:'';
    try {
      if (!scope) {
        const recent=read(activeKey+':last');
        if (collections.has(recent)) scope=recent;
      }
    } catch { /* The catalogue also works without saved drafts. */ }
    const key=['percent','inquiry'].includes(scope)?activeKey+':'+scope:activeKey;
    try { draft=active(key); } catch {}
    const saveHere = async next=>{
      const result=await save(next,key);
      try { write(activeKey+':last',scope); } catch { /* The subject draft was saved above. */ }
      return result;
    };
    EduFlowQuestionBank.mount(root,{papers:catalogue,draft:draft || blank(),collection,questionRef,save:saveHere,finish:next=>finish(next,key),
      onCreated,savedLabel:'選題草稿已儲存在此瀏覽器',backHref:'#papers'});
  }
  return {sync,mount};
};
