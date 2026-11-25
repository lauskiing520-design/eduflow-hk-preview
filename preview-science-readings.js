(() => {
  'use strict';
  const draftKey='eduflow-hk-preview:science-readings:draft-v1';
  const prefix='eduflow-hk-preview:science-readings:paper-v1:';
  const engine=window.EduScienceReadings;
  const load=()=>({draft:JSON.parse(localStorage.getItem(draftKey))||{...engine.blank(),revision:0}});
  function store(data) {
    const write=()=>{
      if(load().draft.revision!==data.revision){
        const error=Error('另一個分頁已修改草稿，請讀取最新版本。');error.code='science_draft_conflict';throw error;
      }
      const draft={...data,revision:data.revision+1};
      localStorage.setItem(draftKey,JSON.stringify(draft));return {draft};
    };
    return navigator.locks?navigator.locks.request(draftKey,write):write();
  }
  function paper(spec,id) {
    return {...engine.build(spec),id:'readings-'+id,revision:id};
  }
  function finish({requestId,title,source,readings}){
    const spec={title,source,readings}, result=paper(spec,requestId);
    localStorage.setItem(prefix+requestId,JSON.stringify(spec));
    return {paper:result};
  }
  function saved(visit,known) {
    for(const key of Object.keys(localStorage)){
      if(!key.startsWith(prefix))continue;
      const id=key.slice(prefix.length);
      if(!/^[a-f\d-]{36}$/.test(id) || known.has('readings-'+id))continue;
      try{visit(paper(JSON.parse(localStorage.getItem(key)),id));}catch{/* A damaged draft does not hide the other papers. */}
    }
  }
  window.EduPreviewScienceReadings={load,store,finish,saved};
})();
