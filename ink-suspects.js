/* Work on the original scan. Coordinates refer to the full, upright page. */
globalThis.EduInkSuspects = (() => {
  'use strict';
  const names = {minus:'負號', exponent:'指數', other:'符號'};
  const fieldNames = {answer:'答案', working:'步驟'};
  let instance=0;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function button(text) {
    const el = node('button', text);
    el.type = 'button';
    return el;
  }
  function validBox(box) {
    return Array.isArray(box) && box.length === 4 && box.every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
      box[2] > box[0] && box[3] > box[1];
  }
  function anchor(value, symbol) {
    const token = symbol.text, start = symbol.start;
    if (!token || !Number.isInteger(start) || start < 0) return null;
    if (typeof symbol.before === 'string' && typeof symbol.after === 'string') {
      let match = null;
      for (let pos=value.indexOf(token); pos>=0; pos=value.indexOf(token,pos+token.length)) {
        const end=pos+token.length;
        const left=symbol.before ? value.slice(0,pos).endsWith(symbol.before) : pos===0;
        const right=symbol.after ? value.startsWith(symbol.after,end) : end===value.length;
        if (!left || !right) continue;
        if (match) return null;
        match={start:pos,end};
      }
      return match;
    }
    if (value.indexOf(token)!==start || value.lastIndexOf(token)!==start) return null;
    return {start, end:start+token.length};
  }

  function paint(canvas, img, box, wider) {
    const width = img.naturalWidth, height = img.naturalHeight;
    if (!width || !height) return;
    const [left, top, right, bottom] = [box[0]*width, box[1]*height, box[2]*width, box[3]*height];
    const aspect = canvas.width / canvas.height;
    const minWidth = Math.max((right-left)*4.2, (bottom-top)*aspect*3.1, width*.075);
    const viewWidth = Math.min(Math.max(width,height*aspect), minWidth*(wider ? 2.3 : 1));
    const viewHeight = viewWidth/aspect;
    const origin = (center, span, limit) => span >= limit ? (limit-span)/2 : Math.min(limit-span, Math.max(0,center-span/2));
    const x = origin((left+right)/2,viewWidth,width), y = origin((top+bottom)/2,viewHeight,height);
    const sx = Math.max(0,x), sy = Math.max(0,y);
    const sw = Math.min(width,x+viewWidth)-sx, sh = Math.min(height,y+viewHeight)-sy;
    const scale = canvas.width/viewWidth;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f2'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx,sy,sw,sh, (sx-x)*scale,(sy-y)*scale,sw*scale,sh*scale);
    // Keep the outline outside the handwriting so even a one-stroke minus stays visible.
    ctx.lineWidth = 3; ctx.strokeStyle = '#ab5221';
    ctx.strokeRect((left-x)*scale-5,(top-y)*scale-5,(right-left)*scale+10,(bottom-top)*scale+10);
  }

  function originalView(symbol, settings) {
    const {question, pageCount, pageUrl} = settings;
    const isPage = n => Number.isInteger(n) && n > 0 && n <= pageCount;
    const mapped = [...new Set([...(Array.isArray(question.pages) ? question.pages : []),question.page].filter(isPage))];
    const page = isPage(symbol.page) && (!mapped.length || mapped.includes(symbol.page)) ? symbol.page : null;
    const pages = page ? [page] : mapped.length ? mapped : Array.from({length:pageCount},(_,i)=>i+1);
    function source(n) {
      if (!isPage(n)) return null;
      const value = pageUrl(n);
      if (typeof value !== 'string' || !value) return null;
      try {
        const url = new URL(value,document.baseURI);
        return url.origin === location.origin && /^https?:$/.test(url.protocol) ? url.href : null;
      } catch { return null; }
    }
    const view = node('div',undefined,'ink-paper');
    const caption = node('p','', 'ink-location');
    const links = node('div',undefined,'ink-original-links');
    for (const n of pages) {
      const url = source(n);
      if (!url) continue;
      const link = node('a','查看第 '+n+' 頁全頁');
      link.href = url; link.target = '_blank'; link.rel = 'noopener'; links.append(link);
    }
    if (!page || !validBox(symbol.box) || !source(page)) {
      caption.textContent = page ? '此疑點有頁碼，未能定位至符號。請對照全頁。' : '此疑點的位置未能確定，請對照原稿頁。';
      view.append(caption,links);
      return view;
    }
    caption.textContent = '正在讀取第 '+page+' 頁原稿…';
    const canvas = node('canvas');
    canvas.width=960; canvas.height=300; canvas.hidden=true; canvas.dataset.inkCrop='';
    canvas.setAttribute('role','img'); canvas.setAttribute('aria-label','第 '+page+' 頁手寫原稿局部，方框標示'+names[symbol.kind]+'疑點');
    const zoom=button('看周邊筆跡');
    zoom.hidden=true; zoom.setAttribute('aria-pressed','false'); links.prepend(zoom);
    const img = new Image();
    let wider=false;
    img.onload=()=>{
      paint(canvas,img,symbol.box,wider); canvas.hidden=false; zoom.hidden=false;
      caption.textContent='第 '+page+' 頁 · 方框內是待核對的筆跡';
    };
    img.onerror=()=>{caption.textContent='未能載入第 '+page+' 頁的局部影像。可開啟全頁核對。';};
    zoom.addEventListener('click',()=>{
      wider=!wider; paint(canvas,img,symbol.box,wider);
      zoom.setAttribute('aria-pressed',String(wider)); zoom.textContent=wider?'放大疑點':'看周邊筆跡';
    });
    view.append(caption,canvas,links);
    img.src=source(page);
    return view;
  }

  function attachPageTargets(img, {page, question, openSymbol}) {
    const located = (question.symbols || []).filter(s => s.page===page && validBox(s.box));
    if (!located.length || img.closest('.ink-page-map') || typeof openSymbol!=='function') return;
    const original = img.parentElement?.tagName==='A' ? img.parentElement : img;
    const map = node('div',undefined,'ink-page-map');
    original.replaceWith(map); map.append(original);
    located.forEach((s,i) => {
      const [left,top,right,bottom]=s.box;
      const target=button('');
      const label='放大第 '+page+' 頁的'+(names[s.kind]||'符號')+'疑點 '+(i+1);
      target.className='ink-page-target'; target.dataset.inkTarget=s.id;
      target.setAttribute('aria-label',label); target.title=label;
      target.style.left=(left+right)*50+'%'; target.style.top=(top+bottom)*50+'%';
      target.style.width=(right-left)*100+'%'; target.style.height=(bottom-top)*100+'%';
      target.hidden=!img.complete || !img.naturalWidth;
      img.addEventListener('load',()=>{target.hidden=false;});
      img.addEventListener('error',()=>{target.hidden=true;});
      target.addEventListener('click',()=>openSymbol(s.id));
      map.append(target);
    });
  }

  function mount(host, settings) {
    const {question,fields,onReview} = settings;
    const symbols = (Array.isArray(question.symbols) ? question.symbols : []).filter(s =>
      s && typeof s.id === 'string' && Object.hasOwn(names,s.kind) && Object.hasOwn(fieldNames,s.field) && fields[s.field]);
    host.replaceChildren();
    if (!symbols.length) return {refresh(){},openSymbol(){},hasPendingEdit:()=>false,applyPending:async()=>true};
    host.classList.add('ink-suspects');
    const toolbar = node('div',undefined,'ink-symbols');
    toolbar.setAttribute('role','group'); toolbar.setAttribute('aria-label','選擇手寫疑點');
    const labels = new Map();
    const panel = node('section',undefined,'ink-detail'); panel.hidden=true; panel.id='ink-location-'+(++instance);
    const result = node('p','','ink-review-status');
    result.setAttribute('role','status');
    let active = null, locked=false, editorState=null;
    const hasPendingEdit=()=>Boolean(editorState?.dirty());
    const refresh = () => {
      symbols.forEach((s,i)=>{
        const el = labels.get(s);
        const prefix = symbols.filter(x=>x.kind === s.kind).length > 1 ? '疑點 '+(i+1)+' · ' : '';
        el.textContent = prefix+names[s.kind]+' · '+fieldNames[s.field]+(s.reviewed?'（已核對）':'');
        el.setAttribute('aria-expanded',String(active===s));
      });
    };
    function close(restoreFocus) {
      const trigger = labels.get(active);
      active=null; editorState=null; panel.replaceChildren(); panel.hidden=true; refresh();
      if (restoreFocus) trigger?.focus({preventScroll:true});
    }
    function open(s) {
      if (locked) return;
      active=s; result.textContent=''; panel.hidden=false; refresh();
      const field=fields[s.field], base=field.value, range=anchor(base,s);
      const heading=node('h4','核對'+names[s.kind]);
      const formTitle=node('div',undefined,'ink-detail-title');
      const exit=button('收起'); exit.addEventListener('click',()=>{if(!locked && allowSwitch())close(true);});
      formTitle.append(heading,exit);
      const label=node('label',range?'這個符號應讀作':'核對整欄'+fieldNames[s.field]);
      const editor=node(range?'input':'textarea');
      if (range) editor.type='text'; else editor.rows=3;
      editor.dataset.inkEditor=''; editor.autocomplete='off'; editor.spellcheck=false;
      editor.maxLength = range ? 128 : 2500;
      editor.value=range?base.slice(range.start,range.end):base;
      label.append(editor);
      const preview=node('p','','ink-transcription'); preview.dataset.inkPreview='';
      const updated=()=>range ? base.slice(0,range.start)+editor.value+base.slice(range.end) : editor.value;
      const discard=button('放棄這次修改');
      discard.addEventListener('click',()=>{if(!locked)close(true);});
      const display=()=>{
        preview.textContent=range?'套用後的'+fieldNames[s.field]+'　'+(updated()||'（留白）'):'請依原稿核對整欄文字，保留其餘作答。';
        discard.hidden=updated()===base;
      };
      display(); editor.addEventListener('input',display);
      const apply=button('套用並標記已核對'); apply.className='button primary'; apply.dataset.inkApply='';
      const actions=node('div',undefined,'ink-editor-actions');
      actions.append(apply,discard);
      const error=node('p','','ink-editor-error'); error.setAttribute('role','alert');
      async function applyEdit() {
        if (locked) return false;
        if (field.value!==base) {
          open(s);
          result.textContent='這欄文字已有更改。已讀取最新內容，請重新核對。';
          return false;
        }
        const value=updated();
        if (value.length>2500) {error.textContent='每欄最多 2,500 字，請縮短後再套用。';return false;}
        const beforeReviewed=s.reviewed;
        locked=true; apply.disabled=true; exit.disabled=true; field.value=value;
        try {
          await onReview({id:s.id,field:s.field,value,reviewed:true,scope:range?'symbol':'field'});
          s.reviewed=true;
          close(true); result.textContent=names[s.kind]+'已核對。';
          return true;
        } catch(err) {
          if (field.value===value) field.value=base;
          s.reviewed=beforeReviewed;
          error.textContent=err?.message||'未能套用修改，請重試。';
          refresh();
          return false;
        } finally { locked=false; apply.disabled=false; exit.disabled=false; }
      }
      editorState={dirty:()=>updated()!==base,apply:applyEdit};
      apply.addEventListener('click',applyEdit);
      editor.addEventListener('keydown',e=>{
        if (!e.isComposing && e.key==='Enter' && (range || e.ctrlKey || e.metaKey)) {
          e.preventDefault(); applyEdit();
        }
      });
      const transcription=node('div',undefined,'ink-editor-area');
      transcription.append(label,preview,actions,error);
      panel.replaceChildren(formTitle,originalView(s,settings),transcription);
      heading.tabIndex=-1; heading.focus({preventScroll:true});
    }
    function allowSwitch() {
      if (!hasPendingEdit()) return true;
      result.textContent='這個疑點仍有修改。請套用或放棄這次修改，再切換。';
      panel.querySelector('[data-ink-editor]')?.focus();
      return false;
    }
    for (const s of symbols) {
      const el=button(''); el.dataset.inkSymbol=s.id;
      el.setAttribute('aria-controls',panel.id);
      el.addEventListener('click',()=>{if (!locked && allowSwitch()) { if(active===s) close(true); else open(s); }});
      labels.set(s,el); toolbar.append(el);
    }
    refresh(); host.append(node('h4','手寫疑點'),toolbar,panel,result);
    function openSymbol(id) {
      const symbol=symbols.find(s=>s.id===id);
      if (!symbol || locked) return;
      if (active!==symbol) {
        if (!allowSwitch()) return;
        open(symbol);
      }
      panel.scrollIntoView({block:'center'});
      panel.querySelector('h4')?.focus({preventScroll:true});
    }
    return {refresh,openSymbol,hasPendingEdit,applyPending:async()=>!locked && (!hasPendingEdit() || await editorState.apply())};
  }
  return {mount,attachPageTargets};
})();
