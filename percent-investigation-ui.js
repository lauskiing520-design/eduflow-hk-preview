/* Student workbench for the school magazine quotation investigation. */
(function (root) {
  'use strict';
  const steps = [
    {id:'quote', tab:'拆解報價', title:'印 80 本或 180 本，應選同一家嗎？',
      lead:'編委會有兩個印量方案。先根據報價還原每本實付印費，再用 x 表示本數，草擬兩廠的總收費算式。'},
    {id:'model', tab:'找臨界點', title:'印多少本，兩廠總價會相同？',
      lead:'以 x 表示印量（本），把兩家印刷廠的總收費寫成代數式，再找兩條報價線的交點。'},
    {id:'budget', tab:'核算預算', title:'用盡預算，最多可印多少本？',
      lead:'只能訂購整本。得出兩個答案後，在計價台各加一本，看有沒有超支。'},
    {id:'advice', tab:'採購建議', title:'「每本便宜，就一定應選甲」？',
      lead:'編委想直接選單價較低的甲廠。舉一個乙廠總價嚴格低於甲廠的印量，再說明何時應改選另一家。'}
  ];
  const names = {unitA:'甲廠折後每本',unitB:'乙廠折後每本',formulaA:'甲廠總收費',formulaB:'乙廠總收費',
    cross:'兩廠同價的印量',maxA:'甲廠最多可印',maxB:'乙廠最多可印',counter:'乙廠較便宜的印量',reason:'給編委的建議'};
  const num = new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2});
  const fmt = v => num.format(v);
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(title, cls, action) {
    const node=el('button',cls,title);
    node.type='button'; node.addEventListener('click',action); return node;
  }
  const tickStep = (hi, count) => {
    const ideal=Math.max(.01,hi/count), magnitude=10**Math.floor(Math.log10(ideal));
    return [1,2,5,10].find(n=>n*magnitude>=ideal)*magnitude;
  };
  function plot(svg, E, trial, extent, type, budget) {
    const ns='http://www.w3.org/2000/svg';
    function s(tag,attrs,text) {
      const node=document.createElementNS(ns,tag);
      Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));
      if(text!==undefined)node.textContent=text;
      svg.append(node);return node;
    }
    svg.replaceChildren();
    const {quantity:q,payA,payB}=trial;
    const base=E.cost(0,payA,payB),end=E.cost(extent,payA,payB),now=E.cost(q,payA,payB);
    const delta=v=>Number((v.a-v.b).toFixed(2));
    const values=type==='total'?[0,base.a,base.b,end.a,end.b]:[0,delta(base),delta(end)];
    if(type==='total' && budget!==null)values.push(budget);
    const step=tickStep(Math.max(...values)-Math.min(...values),4);
    const min=Math.floor(Math.min(...values)/step)*step, max=Math.max(min+step,Math.ceil(Math.max(...values)/step)*step);
    const L=47,R=421,T=18,B=156;
    const x=v=>L+(R-L)*v/extent, y=v=>B-(B-T)*(v-min)/(max-min);
    const line=(ax,ay,bx,by,cls)=>s('line',{x1:ax,y1:ay,x2:bx,y2:by,class:cls});
    for(let v=min;v<=max+0.001;v+=step) {
      line(L,y(v),R,y(v),v===0?'iv-axis':'iv-grid');
      s('text',{x:L-6,y:y(v)+4,'text-anchor':'end'},fmt(v));
    }
    for(let i=0;i<=4;i++){
      const v=Math.round(extent*i/4);
      line(x(v),T,x(v),B,'iv-grid iv-vgrid');
      s('text',{x:x(v),y:B+19,'text-anchor':'middle'},fmt(v));
    }
    s('title',{},type==='total'?'兩間印刷廠的總收費隨印量而變化':'甲廠總價減乙廠總價，正值代表乙廠較便宜');
    if(type==='total' && budget!==null){
      line(L,y(budget),R,y(budget),'iv-budget-line');
      s('text',{x:R-2,y:y(budget)-5,'text-anchor':'end',class:'iv-budget-label'},'預算 $'+fmt(budget));
    }
    line(x(q),T,x(q),B,'iv-cursor');
    const tracks=type==='total'?[
      [base.a,end.a,now.a,'iv-line-a'],[base.b,end.b,now.b,'iv-line-b']
    ]:[[delta(base),delta(end),delta(now),'iv-line-d']];
    for(const [v0,v1,v,cls] of tracks){
      line(L,y(v0),R,y(v1),cls);
      s('circle',{cx:x(q),cy:y(v),r:4.8,class:cls+' iv-point'});
    }
  }
  function mount(host,options={}) {
    const E=root.EduInvestigation;
    const spec=options.data||E.create(), readonly=Boolean(options.readonly);
    let a=options.answers?E.state(options.answers):E.initial();
    const frame=el('section','iv-workbench');
    const unitFor=k=>k.startsWith('unit')?'元':(k.startsWith('formula')||k==='reason'?'':'本');
    let current=0, graphMode='difference', activeFeedback=null, nativePlayer=null, pendingNative=0;
    const filled=(key)=>a[key]!==null&&a[key]!==undefined&&String(a[key]).trim()!=='';
    const fieldsByStep=[['unitA','unitB'],['formulaA','formulaB','cross'],['maxA','maxB'],['counter','reason']];
    const doneAt=i=>fieldsByStep[i].every(filled);
    if(options.answers&&!readonly) {
      const last=steps.findIndex(s=>s.id===a.focus);
      const next=steps.findIndex((_,i)=>!doneAt(i));
      current=last>=0?last:(next<0?steps.length-1:next);
    }
    const notify=()=>{syncNav();if(options.onChange)options.onChange(E.state(a));};
    const terms=E.terms;
    const brief=el('div','iv-quotes');
    function quotation(key,label) {
      const term=terms[key],node=el('article','iv-quote iv-vendor-'+key);
      const cap=el('div','iv-quote-head');
      cap.append(el('i','iv-swatch'),el('h3',null,label+'廠報價'));
      const line=el('p','iv-offer');
      line.append('每本 ',el('strong',null,'$'+fmt(term.price)),'，',
        el('strong',null,key==='a'?'八折':'七五折'));
      node.append(cap,line,el('p','iv-fee',term.fee?'每張訂單另收起版費 HK$'+fmt(term.fee):'免起版費'));
      return node;
    }
    const assignment=el('article','iv-budget');
    assignment.append(el('h3',null,'校刊印刷預算'),el('p','iv-budget-sum','HK$'+fmt(spec.budget)),el('p','iv-fee','同一規格 · 港元報價'));
    brief.append(assignment,quotation('a','甲'),quotation('b','乙'));
    const nav=el('nav','iv-nav');nav.setAttribute('aria-label','探究進度');
    const jump=[],notes=[];
    steps.forEach((stage,i)=>{
      const b=button(stage.tab,'iv-tab',()=>openStep(i));
      b.prepend(el('span','iv-tab-index',String(i+1).padStart(2,'0')));
      const state=el('span','iv-tab-note'); b.append(state);nav.append(b);jump.push(b);notes.push(state);
    });
    function syncNav() {
      jump.forEach((b,i)=>{
        if(current===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
        const answered=doneAt(i);
        notes[i].textContent=answered?'已填':'';
        b.classList.toggle('iv-filled',answered);
      });
    }
    const columns=el('div','iv-columns'),task=el('section','iv-task'),bench=el('section','iv-bench'),nativeSlot=el('div','iv-native-slot');
    columns.append(task,bench);frame.append(brief,nativeSlot,nav,columns);host.replaceChildren(frame);
    const labHeader=el('div','iv-bench-header');
    labHeader.append(el('h3',null,'印量計價台'));
    const toggles=el('div','iv-graph-toggle');toggles.setAttribute('aria-label','圖表讀數');
    const totalBtn=button('總價','',()=>{graphMode='total';updateLab();});
    const gapBtn=button('差額','',()=>{graphMode='difference';updateLab();});
    toggles.append(totalBtn,gapBtn);labHeader.append(toggles);
    const chart=el('figure','iv-figure'),cap=el('figcaption','iv-chart-label'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 440 188'); svg.setAttribute('role','img');
    const axis=el('div','iv-axis-caption','印量（本）');
    chart.append(cap,svg,axis);
    const chooser=el('div','iv-quantity'), sliderLabel=el('label','iv-range-label');
    const range=el('input'); range.type='range';range.min='1';range.step='1';range.setAttribute('aria-label','拖動試算印量');
    const copies=el('input');copies.type='number';copies.min='1';copies.max='10000';copies.step='1';copies.inputMode='numeric';copies.setAttribute('aria-label','試算印量（本）');
    const quantityHead=el('div','iv-qty-head'),qtyField=el('div','iv-qty-value');qtyField.append(copies,el('span',null,'本'));
    quantityHead.append(el('span',null,'試算印量'),qtyField);sliderLabel.append(range);
    const presets=el('div','iv-presets');
    const shortcuts=[
      button('試印 80 本','',()=>setTrial(80)),
      button('試印 180 本','',()=>setTrial(180)),
      button('少印一本','',()=>setTrial(a.trial.quantity-1)),
      button('多印一本','',()=>setTrial(a.trial.quantity+1))
    ];
    presets.append(...shortcuts);chooser.append(quantityHead,sliderLabel,presets);
    const results=el('div','iv-results');
    const amountsOut=['a','b'].map((k,i)=>{
      const band=el('div','iv-result iv-vendor-'+k),name=el('span','iv-caption');
      name.append(el('i','iv-swatch'),i===0?'甲廠總價':'乙廠總價');const val=el('output');
      band.append(name,val);results.append(band);return val;
    });
    const summary=el('p','iv-live');summary.setAttribute('aria-live','polite');
    const adjustments=el('details','iv-adjustments'), adjHead=el('summary',null,'改折扣做假設');
    const adjGrid=el('div','iv-pair'),warning=el('p','iv-lab-note','折扣只在計價台變更。各節答案按原報價核對。');
    const rateFields=[];
    for(const [rate,name] of [['payA','甲'],['payB','乙']]) {
      const label=el('label','iv-field',name+'廠實付（%）'),inp=el('input');
      inp.type='number';inp.min='0';inp.max='100';inp.step='1';inp.inputMode='numeric';
      inp.value=String(a.trial[rate]);inp.disabled=readonly;rateFields.push(inp);label.append(inp);adjGrid.append(label);
      inp.addEventListener('input',()=>{
        if(inp.value!==''&&inp.validity.valid){
          a.trial[rate]=inp.valueAsNumber;updateLab();notify();
        }
      });
      inp.onblur=()=>{inp.value=String(a.trial[rate]);};
    }
    const restore=button('還原兩廠報價','iv-quiet',()=>{
      a.trial.payA=terms.a.pay;a.trial.payB=terms.b.pay;
      rateFields[0].value=String(terms.a.pay);rateFields[1].value=String(terms.b.pay);
      updateLab();notify();
    });
    restore.disabled=readonly;adjustments.append(adjHead,warning,adjGrid,restore);
    bench.append(labHeader,chart,chooser,results,summary,adjustments);
    function updateLab() {
      const {quantity:q,payA,payB}=a.trial;
      const suggested=Math.max(240,Math.ceil(spec.budget/terms.a.price/60)*80);
      const extent=Math.min(10000,Math.max(suggested,Math.ceil(q/40)*40));
      range.max=String(extent);range.value=String(q);
      if(document.activeElement!==copies)copies.value=String(q);
      const {a:ca,b:cb,cheaper}=E.cost(q,payA,payB);
      amountsOut[0].textContent='$'+fmt(ca);amountsOut[1].textContent='$'+fmt(cb);
      summary.textContent=cheaper==='equal'?'兩家總價相同。':(cheaper==='a'?'甲':'乙')+'廠少收 HK$'+fmt(Math.abs(ca-cb))+'。';
      cap.textContent=graphMode==='total'?'總收費（港元）':'甲廠總價 − 乙廠總價（港元）';
      svg.setAttribute('aria-label',cap.textContent+'，印 '+q+' 本時，甲廠 '+fmt(ca)+' 元，乙廠 '+fmt(cb)+' 元。');
      totalBtn.setAttribute('aria-pressed',String(graphMode==='total'));gapBtn.setAttribute('aria-pressed',String(graphMode==='difference'));
      shortcuts.forEach((b,i)=>{
        b.hidden=current===2?i<2:i>=2;
        b.disabled=readonly||(i===2&&q<=1)||(i===3&&q>=10000);
        if(i<2)b.setAttribute('aria-pressed',String(q===(i===0?80:180)));
      });
      plot(svg,E,a.trial,extent,graphMode,current===2?spec.budget:null);
      adjHead.textContent=payA===terms.a.pay&&payB===terms.b.pay?'改折扣做假設':'假設報價 · 甲付 '+payA+'% ／ 乙付 '+payB+'%';
    }
    function setTrial(q){a.trial.quantity=q;updateLab();notify();}
    if(!readonly)svg.onclick=e=>{
      const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
      const transform=svg.getScreenCTM();if(!transform)return;
      const local=point.matrixTransform(transform.inverse());
      if(local.y<18||local.y>156||local.x<47||local.x>421)return;
      setTrial(Math.min(Number(range.max),Math.max(1,Math.round((local.x-47)/(421-47)*Number(range.max)))));
    };
    range.addEventListener('input',()=>setTrial(range.valueAsNumber));range.disabled=readonly;
    copies.addEventListener('input',()=>{if(copies.value!==''&&copies.validity.valid)setTrial(copies.valueAsNumber);});
    copies.onblur=()=>{copies.value=String(a.trial.quantity);};copies.disabled=readonly;
    function field(key) {
      const isText=key==='reason', isFormula=key.startsWith('formula');
      const lab=el('label','iv-field'),unit=unitFor(key),suffix=unit?'（'+unit+'）':'';
      const name=names[key]+suffix;lab.append(el('span',null,name));
      const inp=el(isText?'textarea':'input');
      if(isText){inp.rows=3;inp.maxLength=500;inp.placeholder='列出你試過的印量與報價，再說明改選另一家的條件。';}
      else if(isFormula){inp.type='text';inp.maxLength=96;inp.autocomplete='off';inp.spellcheck=false;}
      else {inp.type='number';inp.inputMode='decimal';inp.step='any';inp.min='-1000000';inp.max='1000000';}
      inp.value=a[key]??'';inp.readOnly=readonly;
      inp.addEventListener('input',()=>{
        a[key]=isText||isFormula?inp.value:(inp.value!==''&&inp.validity.valid?inp.valueAsNumber:null);
        a.focus=steps[current].id;
        if(activeFeedback){activeFeedback.replaceChildren();activeFeedback.hidden=true;}
        notify();
      });
      lab.append(inp);return lab;
    }
    function feedback(result,box){
      box.replaceChildren();box.hidden=false;
      box.classList.toggle('iv-correct',result.correct);
      box.append(el('strong',null,!result.complete?'還有項目未填':(result.correct?'數值核對通過':'再檢查一次')));
      const list=el('ul');
      for(const item of result.feedback||[])list.append(el('li',null,item));
      if(list.children.length)box.append(list);
    }
    function nativeLesson() {
      const toggle=el('details','iv-openclass');
      toggle.append(el('summary',null,'OpenMAIC 互動課堂：單價低，總價就低？'));
      const playerHost=el('div','iv-openclass-host');toggle.append(playerHost);
      toggle.ontoggle=async()=>{
        if(!toggle.open||nativePlayer||!frame.contains(toggle))return;
        const attempt=++pendingNative;
        try{
          const next=await root.EduOpenClass.mount(playerHost,{budget:spec.budget});
          if(attempt!==pendingNative||!frame.contains(toggle)){next?.destroy?.();return;}
          nativePlayer=next||true;
        }catch(error){
          if(attempt===pendingNative)playerHost.textContent='小課堂暫時未能載入。請重新打開，或在計價台比較兩個不同印量。';
        }
      };
      return toggle;
    }
    const nativeView=root.EduOpenClass?nativeLesson():null;
    if(nativeView)nativeSlot.append(nativeView);
    function drawTask(){
      const stage=steps[current];
      task.replaceChildren();
      const h=el('h3','iv-task-heading',stage.title);h.tabIndex=-1;
      task.append(h,el('p','iv-lead',stage.lead));
      if(current===2)task.append(el('p','iv-callout','本次印刷預算　HK$'+fmt(spec.budget)));
      const fs=fieldsByStep[current],pairs=el('div','iv-fields'+(current===3?' iv-single':''));
      for(const key of fs)pairs.append(field(key));
      task.append(pairs);
      if(current===0&&!readonly){
        const formulas=el('div','iv-fields iv-model-draft');
        formulas.append(field('formulaA'),field('formulaB'));task.append(formulas,
          el('p','iv-review-note','本節核對兩個單價。兩條算式會帶到下一節，求兩廠的分界印量。'));
      }
      if(current===3)task.append(el('p','iv-review-note','數值由系統核對，書面理據交由老師閱讀。'));
      const fb=el('div','iv-feedback');fb.setAttribute('role','status');fb.hidden=true;activeFeedback=fb;
      const actions=el('div','iv-task-actions');
      if(!readonly)actions.append(button('核對本節','iv-check',()=>{
        a.focus=stage.id;
        const outcome=E.check(spec,a,stage.id);
        a=outcome.answers;feedback(outcome,fb);notify();
      }));
      if(current<3)actions.append(button('下一節','iv-next',()=>openStep(current+1)));
      if(actions.children.length)task.append(actions);
      task.append(fb);
      if(readonly||a.checks[stage.id])feedback(E.diagnose(spec,a,stage.id),fb);
      if(readonly&&a.first[stage.id]){
        const first=el('details','iv-history');first.append(el('summary',null,'首次核對的作答'));
        const dl=el('dl');for(const k of fs){
          const val=a.first[stage.id][k];dl.append(el('dt',null,names[k]),el('dd',null,val==null||val===''?'未填':String(val)));
        }
        first.append(dl);task.append(first);
      }
      if(current===3&&nativeView){
        task.append(button('用 OpenMAIC 檢驗反例','iv-native-jump',()=>{
          nativeView.open=true;nativeView.querySelector('summary').focus({preventScroll:true});
          nativeView.scrollIntoView({block:'start'});
        }));
      }
    }
    function openStep(i){
      if(i===current)return;current=i;graphMode=i===1||i===2?'total':'difference';
      if(!readonly){a.focus=steps[i].id;notify();}else syncNav();
      drawTask();updateLab();
      const head=task.querySelector('h3');head.focus({preventScroll:true});
    }
    syncNav();updateLab();drawTask();
    return {read:()=>E.state(a),destroy:()=>{pendingNative++;nativePlayer?.destroy?.();frame.remove();}};
  }
  root.EduInvestigationUI={mount};
})(globalThis);
