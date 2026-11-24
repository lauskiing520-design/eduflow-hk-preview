(() => {
  'use strict';
  const sheet = 'handwriting-sample.webp';
  const pageWidth = 1448, pageHeight = 1086;
  const box = (x, y, right, bottom) => [x/pageWidth, y/pageHeight, right/pageWidth, bottom/pageHeight];
  const questions = [
    {
      id:'q1', title:'解方程 2x + 5 = −3。', initial:'x = +4', reference:'x = −4',
      symbol:{id:'minus-1', kind:'minus', field:'answer', page:1, text:'+', start:4, box:box(396,410,463,435)},
      accepts(value) {
        const parsed = AssessmentCore.numberAnswer(value,{variable:'x'});
        return parsed.kind === 'number' && parsed.value === -4;
      }
    },
    {
      id:'q2', title:'把 3 × 3 寫成冪式。', initial:'3^7', reference:'3²',
      symbol:{id:'exponent-1', kind:'exponent', field:'answer', page:1, text:'7', start:2, box:box(288,759,347,820)},
      accepts(value) {
        const power = value.trim().replace(/\s+/g,'').replace(/\^?²/g,'^2').normalize('NFKC');
        return /^(?:3\^2|3\^\{2\}|3\^\(2\)|3\*\*2)$/.test(power);
      }
    }
  ];
  const names={minus:'負號',exponent:'指數'};
  const storageKey='eduflow-hk-preview:handwriting-review:v1';
  const byId=id=>document.getElementById(id);
  const make=(tag,text,css)=>{
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(css)node.className=css;
    return node;
  };
  const defaults=()=>({edition:'', answers:questions.map(q=>q.initial), reviewed:[false,false],
    marks:null, confirmed:false, stage:'review', current:0});
  let persistent=true;
  function read() {
    try {
      const d=JSON.parse(localStorage.getItem(storageKey));
      if(!d || typeof d.edition!=='string' || !Array.isArray(d.answers) || d.answers.length!==2 ||
        !d.answers.every(a=>typeof a==='string' && a.length<=2500) ||
        !Array.isArray(d.reviewed) || d.reviewed.length!==2 || !d.reviewed.every(r=>typeof r==='boolean')) return defaults();
      if(!Array.isArray(d.marks) || d.marks.length!==2 || !d.marks.every(n=>n===0 || n===1)){
        d.marks=null;d.confirmed=false;
      }
      if(d.stage!=='mark' || !d.marks || !d.reviewed.every(Boolean))d.stage='review';
      d.current=d.current===1?1:0;
      return d;
    } catch {persistent=false;return defaults();}
  }
  let state=read(), current=state.current, editor=null;
  function announce(text) {
    byId('ink-trial-status').textContent=text+(persistent?'':' 此瀏覽器未能保存，離開頁面後需重新開始。');
  }
  function save(patch) {
    if(persistent && read().edition!==state.edition) throw Error('示例已在另一分頁更新。請重新載入，再核對最新作答。');
    const next={...state,...patch,current,edition:crypto.randomUUID()};
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{persistent=false;}
    state=next;
  }
  function safely(action) {
    return async () => {try{await action();}catch(error){announce(error.message);}};
  }
  function progress() {
    const count=state.reviewed.filter(Boolean).length;
    byId('ink-progress').textContent='已核對 '+count+' / 2 個疑點';
    byId('ink-next').textContent=count<2?'繼續核對':'確認辨識，開始批改';
    document.querySelectorAll('[data-question]').forEach((b,i)=>{
      b.setAttribute('aria-pressed',String(i===current));
      b.textContent='第 '+(i+1)+' 題 · '+names[questions[i].symbol.kind]+(state.reviewed[i]?' ✓':'');
    });
  }
  function question() {
    const q=questions[current], i=current;
    const detail=byId('ink-detail');
    const heading=make('p','第 '+(i+1)+' 題　'+q.title,'ink-question-prompt');
    const label=make('label','已識別答案','ink-read-answer');
    const answer=make('input');
    answer.id='ink-recognised';answer.readOnly=true;answer.value=state.answers[i];
    const host=make('div');
    label.append(answer);
    detail.replaceChildren(heading,label,host);
    const symbol={...q.symbol,reviewed:state.reviewed[i]};
    editor=EduInkSuspects.mount(host,{
      question:{id:q.id,answer:answer.value,working:'',page:1,pages:[1],symbols:[symbol]},
      pageCount:1, pageUrl:()=>sheet, fields:{answer},
      onReview({value}){
        const answers=state.answers.slice(), reviewed=state.reviewed.slice();
        const changed=answers[i]!==value;
        answers[i]=value;reviewed[i]=true;
        save({answers,reviewed,stage:'review',...(changed?{marks:null,confirmed:false}:{})});
        progress();
        announce('第 '+(i+1)+' 題的核對結果已套用。');
      }
    });
    progress();
  }
  async function applyTyped(){
    return !editor?.hasPendingEdit() || await editor.applyPending();
  }
  async function inspect(i,open=true){
    if(!await applyTyped())return;
    current=i;
    if(state.stage!=='review' || state.current!==i)save({stage:'review'});
    byId('ink-marking').hidden=true;byId('ink-review').hidden=false;
    question();
    if(open)editor.openSymbol(questions[i].symbol.id);
  }
  function grades(focus=false) {
    const place=byId('ink-grade-rows');
    place.replaceChildren();
    questions.forEach((q,i)=>{
      const row=make('div',undefined,'ink-grade-row');
      const copy=make('div');copy.append(make('strong','第 '+(i+1)+' 題　'+q.title));
      const lines=make('p','核對後的作答　');
      lines.append(make('code',state.answers[i] || '（留白）'));copy.append(lines);
      const suggested=Number(q.accepts(state.answers[i]));
      copy.append(make('p','參考答案 '+q.reference+' · 示例建議 '+suggested+' / 1 分'));
      const label=make('label','老師評分'), select=make('select');
      select.id='ink-mark-'+(i+1);select.setAttribute('aria-label','第 '+(i+1)+' 題老師評分');
      select.add(new Option('0 分','0'));select.add(new Option('1 分','1'));select.value=String(state.marks[i]);
      select.addEventListener('change',safely(()=>{
        const marks=state.marks.slice();marks[i]=Number(select.value);
        save({marks,confirmed:false});grades();
        byId('ink-mark-'+(i+1)).focus({preventScroll:true});
      }));
      label.append(select);row.append(copy,label);place.append(row);
    });
    byId('ink-review').hidden=true;byId('ink-marking').hidden=false;
    const total=state.marks.reduce((a,b)=>a+b,0);
    byId('ink-total').textContent=total+' / 2 分';
    byId('ink-done').textContent=state.confirmed?'示例評分已確認，共 '+total+' / 2 分。':'';
    byId('ink-restart').hidden=!state.confirmed;
    byId('ink-grade-form').querySelector('[type=submit]').disabled=state.confirmed;
    if(focus)byId('ink-mark-title').focus();
  }
  questions.forEach((q,i)=>{
    const pin=make('button',undefined,'ink-pin');
    pin.type='button';pin.dataset.inkPin=q.symbol.id;
    pin.setAttribute('aria-label','放大第 '+(i+1)+' 題'+names[q.symbol.kind]+'筆跡');
    const [x,y,right,bottom]=q.symbol.box;
    Object.assign(pin.style,{left:(100*x)+'%',top:(100*y)+'%',width:100*(right-x)+'%',height:100*(bottom-y)+'%'});
    pin.addEventListener('click',safely(()=>inspect(i)));
    byId('ink-hotspots').append(pin);
  });
  document.querySelectorAll('[data-question]').forEach((b,i)=>b.addEventListener('click',safely(()=>inspect(i))));
  byId('ink-next').addEventListener('click',safely(async()=>{
    if(!await applyTyped())return;
    const missing=state.reviewed.findIndex(done=>!done);
    if(missing>=0){await inspect(missing);announce('請對照原稿，再點「套用並標記已核對」。');return;}
    save({stage:'mark',marks:state.marks || questions.map((q,i)=>Number(q.accepts(state.answers[i])))});
    editor=null;announce('');grades(true);
  }));
  byId('ink-return').addEventListener('click',safely(()=>inspect(current)));
  byId('ink-grade-form').addEventListener('submit',event=>{
    event.preventDefault();
    safely(()=>{save({confirmed:true});grades();announce('已確認這份示例答卷的評分。');})();
  });
  byId('ink-restart').addEventListener('click',safely(()=>{
    if(!confirm('重新試用會清除這份示例的核對及評分紀錄。繼續嗎？'))return;
    current=0;save({...defaults()});render();announce('已重新載入示例識別文字。');
  }));
  function render(){
    current=state.current;
    if(state.stage==='mark'){editor=null;grades();}
    else{byId('ink-marking').hidden=true;byId('ink-review').hidden=false;question();}
  }
  window.addEventListener('storage',event=>{
    if(event.key!==storageKey)return;
    if(editor?.hasPendingEdit()){announce('另一分頁已修改示例。請先記下未套用的文字，再重新載入。');return;}
    state=read();render();announce('已讀取另一分頁保存的示例進度。');
  });
  render();
  if(!persistent)announce('');
})();
