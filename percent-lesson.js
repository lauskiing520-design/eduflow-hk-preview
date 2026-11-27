/* One shared model for teacher previews, browser practice and school-side scoring. */
(function (root) {
  'use strict';
  const insist=(condition,message)=>{if(!condition)throw Error(message);};
  function text(value,max,field){
    insist(typeof value==='string'&&value.trim().length&&value.trim().length<=max,'請核對'+field+'內容及長度。');
    return value.trim();
  }
  function integer(n,min,max){return Number.isInteger(n)&&n>=min&&n<=max;}
  function triple(input){
    insist(input && integer(input.price,1,10000),'原價須為 1 至 10,000 港元的整數。');
    insist(integer(input.down,1,99)&&integer(input.up,1,99),'減價及加價百分率須各為 1 至 99 的整數。');
    return {price:input.price,down:input.down,up:input.up};
  }
  function same(a,b){return a.price===b.price&&a.down===b.down&&a.up===b.up;}
  function alternative(example){
    return {price:example.price<=5000?example.price*2:Math.floor(example.price/2),
            down:example.down===25?20:25,up:example.up===10?15:10};
  }
  // Capture nearby explicit price changes, never infer an amount just from numbers on a page.
  function scenario(sentence){
    const s=sentence.normalize('NFKC').replace(/\s+/g,'').replace(/[，、；]/g,',')
      .replace(/。(?=先|再|然後|然后|其後|其后|接着|接著|之後|之后|隨後|随后)/g,',');
    if(/(?:並非|并非|並無|并无|未有|沒有|没有|不會|不会|取消|毋須|无需|無需|不是|唔係|不再|不曾|並不|并不|並未|并未|而非|按原價|按原价|手續費|手续费|服務費|服务费|另收|另加|現金券|现金券|回贈|回赠|美元|人民幣|人民币|美金)/.test(s))return null;
    // A finite sentence grammar avoids interpreting a price after a discount as the starting price.
    const chinese=/(?:原[價价]|原售[價价]|原來售[價价])(?:[為为是]|[:：])?(?:港幣|港币|HKD|HK\$|\$)?(\d{1,5})(?:港元|元|蚊)?[,;]?(?:先|首先)?(?:下調|下调|減價|减价|降價|降价|減少|减少|下跌|打折減價|減|减)(\d{1,2})%[,;]?(?:然後|然后|之後|之后|其後|其后|接着|接著|隨後|随后|再)(?:再)?(?:按(?:減價後|减价后|折後|折后|當時|当时)(?:的)?[售價价]+)?(?:[調调]高|加價|加价|漲價|涨价|上升|增加|上調|上调|加)(\d{1,2})%/gi;
    const matches=Array.from(s.matchAll(chinese));
    if(matches.length!==1)return null;
    const [match,price,down,up]=matches[0];
    // Reject alternative/additional changes, qualifiers and unrelated starting-price contexts.
    if((s.match(/%/g)||[]).length!==2 || /(舊|旧)原[價价]/.test(s))return null;
    const tail=s.slice(s.indexOf(match)+match.length);
    if(!/^(?:[。.!！?？]*)$/.test(tail)&&
       !/^[,;]?(?:[。.!！?？]|(?:問|问|求|最後|最后|最終|最终|試|试|計算|计算|結果|结果|會|会|售價|售价|現價|现价|比較|比较|學生|学生))/.test(tail))return null;
    if(/(?:以|按|相對|相对|根據|根据|基於|基于)(?:貨品|商品|最初|最早)?(?:的)?原[價价]/.test(tail))return null;
    return triple({price:Number(price),down:Number(down),up:Number(up)});
  }
  function extract(source){
    source=text(source,6000,'講義（最多 6,000 字）');
    const matches=[],parts=Array.from(source.matchAll(/[^。！？!?\r\n]+[。！？!?]?/g));
    const priceWord=/原[價价]|原售[價价]|原來售[價价]/;
    for(let i=0;i<parts.length;i++){
      if(!priceWord.test(parts[i][0]))continue;
      // PDF text and pasted handouts often wrap one example across adjacent lines.
      for(let j=i;j<parts.length&&j<i+4;j++){
        if(j>i&&priceWord.test(parts[j][0]))break;
        const end=parts[j].index+parts[j][0].length;
        const quote=source.slice(parts[i].index,end).trim(),example=scenario(quote);
        if(example){matches.push({quote,example});break;}
      }
    }
    insist(matches.length, '請在同一例子寫清楚原價、先減價及再加價的百分率，例如「原價 100 元，先減價 20%，再加價 20%。」');
    insist(matches.length===1, '這段講義有多個可用例子，請選一個例句再建立。');
    return matches[0];
  }
  function parse(source){
    source=text(source,6000,'講義（最多 6,000 字）');
    const {example,quote}=extract(source);
    return {kind:'percentLesson',title:'減價後再加價，會回到原價嗎？',instructions:'先估計最後售價，再用價格條觀察兩次變價的計算基數。',
      source,quote,example,transfer:alternative(example)};
  }
  function core(raw){
    insist(raw && raw.kind==='percentLesson','互動課種類無效。');
    const example=triple(raw.example), transfer=triple(raw.transfer);
    insist(!same(example,transfer),'新題至少要更改一個數值。');
    return {kind:'percentLesson',title:text(raw.title,100,'課堂名稱'),instructions:text(raw.instructions,600,'活動指引'),example,transfer};
  }
  function validate(raw){
    const data=core(raw),source=text(raw.source,6000,'講義'),quote=text(raw.quote,6000,'講義原句');
    const found=extract(source);
    insist(found.quote===quote && same(found.example,data.example),'例題數字與講義原句不符，請重新提取。');
    return {...data,source,quote};
  }
  const initial=()=>({prediction:null,trialUp:null,exitPrice:null,reason:''});
  const choices={less:'低於原價',same:'等於原價',more:'高於原價'};
  function state(raw){
    insist(raw && typeof raw==='object'&&!Array.isArray(raw),'課堂作答格式無效。');
    const {prediction,trialUp,exitPrice,reason}=raw;
    insist(prediction===null||(typeof prediction==='string'&&Object.hasOwn(choices,prediction)),'請選擇一項原來的預測。');
    insist(trialUp===null||integer(trialUp,0,100),'請核對試驗的加價百分率。');
    insist(exitPrice===null||(Number.isFinite(exitPrice)&&exitPrice>=0&&exitPrice<=1000000 &&
      Math.abs(exitPrice*100-Math.round(exitPrice*100))<1e-7),'售價須為非負數，最多兩位小數。');
    insist(typeof reason==='string'&&reason.length<=500,'解釋最多 500 字。');
    insist((trialUp===null || prediction!==null) && ((exitPrice===null&&!reason)||trialUp!==null),'請先記下預測，並操作價格條。');
    return {prediction,trialUp,exitPrice,reason};
  }
  // Amounts are derived with safe integer arithmetic in ten-thousandths of a dollar.
  function amounts(example,up=example.up){
    const reducedCents=example.price*(100-example.down);
    const tenThousandths=reducedCents*(100+up);
    return {first:reducedCents/100,gain:reducedCents*up/10000,final:tenThousandths/10000,
      finalCents:Math.floor((tenThousandths+50)/100)};
  }
  function grade(raw,answers,requireComplete=false){
    const data=core(raw), input=state(answers);
    if(requireComplete)insist(input.prediction!==null&&input.trialUp!==null&&input.exitPrice!==null,
      '請先記下預測、操作價格條，再填寫新題的售價。');
    const score=Number(input.exitPrice!==null&&Math.round(input.exitPrice*100)===amounts(data.transfer).finalCents);
    return {answers:input,score,maximum:1,max:1};
  }

  function el(tag,content,cls){
    const n=document.createElement(tag);if(content!==null&&content!==undefined)n.textContent=content;
    if(cls)n.className=cls;return n;
  }
  function button(label,fn,cls){const b=el('button',label,cls);b.type='button';b.onclick=fn;return b;}
  const money=n=>n.toLocaleString('zh-HK',{maximumFractionDigits:4,useGrouping:true});
  function mount(host,raw,options={}){
    const data=core(raw), e=data.example, t=data.transfer, readonly=!!options.readonly;
    const a=state(options.answers??initial());
    let chapter=readonly||a.exitPrice!==null||a.reason?3:a.trialUp!==null?2:a.prediction?1:0;
    const frame=el('section',null,'pl-session'),step=el('p',null,'pl-kicker'),head=el('h3'),body=el('div',null,'pl-body');
    const reference=el('details',null,'pl-ref'),link=el('a','教育局《初中數學課程闡釋》 · 單元 5');
    link.href='https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/ma/curr/EN_KS3_tc.pdf';
    link.target='_blank';link.rel='noopener noreferrer';reference.append(el('summary','課程參考'),link);
    frame.append(step,head,body,reference);host.replaceChildren(frame);head.tabIndex=-1;
    const labels=['先作預測','第一次變價','第二次變價','換數再試'];
    function change(){options.onChange?.({...a});}
    function go(n){chapter=n;draw();head.focus({preventScroll:true});}
    function prediction(){
      body.append(el('p','一件貨品原價 '+money(e.price)+' 元，先減價 '+e.down+'%，再按減價後的售價加價 '+e.up+'%。'));
      const group=el('div',null,'pl-choices');
      for(const [key,label] of Object.entries(choices)){
        group.append(button(label,()=>{a.prediction=key;change();go(1);}));
      }
      body.append(group,el('p','選擇後會記下你的第一個想法。預測不計分。','pl-muted'));
    }
    function chart(up,showFinal){
      const box=el('figure',null,'pl-chart'),scale=Math.max(e.price,amounts(e,100).final);
      const pct=n=>(n/scale*100)+'%';
      const guide=pct(e.price);
      const row=(name,amount,base,extra,cls)=>{
        const row=el('div',null,'pl-chart-row');
        const line=el('div',null,'pl-line'), bar=el('div',null,'pl-track');
        const val=el('strong',money(amount)+' 元');
        line.append(el('span',name),val);bar.setAttribute('aria-hidden','true');
        const solid=el('i',null,'pl-solid'), delta=el('i',null,cls),mark=el('i',null,'pl-origin');
        solid.style.width=pct(base);delta.style.width=pct(extra);mark.style.left=guide;
        bar.append(solid,delta,mark);row.append(line,bar);box.append(row);
        return n=>{val.textContent=money(n.final)+' 元';delta.style.width=pct(n.gain);};
      };
      const result=amounts(e,up);
      box.append(el('figcaption','價格比較 · 虛線標示原價'));
      row('原價',e.price,e.price,0,'');
      row('減價後',result.first,result.first,e.price-result.first,'pl-drop');
      let update=()=>{};
      if(showFinal)update=row('再加價後',result.final,result.first,result.gain,'pl-rise');
      box.append(el('div',showFinal?'斜紋是減去的金額，綠色是按新基數加回的金額。':'斜紋是減去的金額，藍色是餘下的售價。','pl-key'));
      return {box,update};
    }
    function discount(){
      const {first}=amounts(e);
      body.append(chart(0,false).box,el('p','第一次以 '+money(e.price)+' 元為基數。減少 '+money(e.price-first)+' 元後，餘下 '+money(first)+' 元。','pl-caption'),
        el('p',money(e.price)+' × (1 − '+e.down+'%) = '+money(first)+' 元','pl-equation'),
        button('看第二次變價',()=>go(2),'pl-next'));
    }
    function explore(){
      const graph=chart(a.trialUp??e.up,true);
      const lab=el('label',null,'pl-slider'),slider=el('input'),val=el('strong'), caption=el('p',null,'pl-caption');
      const result=el('p',null,'pl-equation'),resultForExample=amounts(e);
      const original='講義加價 '+e.up+'% 後的售價是 '+money(resultForExample.final)+' 元。你的預測是「'+choices[a.prediction]+'」。';
      slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(a.trialUp??e.up);
      slider.setAttribute('aria-label','試改加價百分率');slider.disabled=readonly;
      lab.append(el('span','試改加價百分率'),val,slider);
      const next=button('試做新題',()=>go(3),'pl-next');
      const use=button('採用講義加幅',()=>setRate(e.up));
      function view(up){
        const n=amounts(e,up);graph.update(n);val.textContent=up+'%';
        caption.textContent='第二次以減價後的 '+money(n.first)+' 元為基數。加幅為 '+up+'% 時，增加 '+money(n.gain)+' 元。';
        result.textContent=money(n.first)+' × (1 + '+up+'%) = '+money(n.final)+' 元';
        next.disabled=a.trialUp===null;
      }
      function setRate(up){a.trialUp=up;slider.value=String(up);view(up);change();}
      slider.oninput=()=>setRate(Number(slider.value));view(Number(slider.value));
      const actions=el('div',null,'pl-actions');actions.append(use,next,button('重看第一次變價',()=>go(1)));
      body.append(el('p',original),graph.box,lab,caption,result,actions);
    }
    function transfer(){
      if(readonly){
        const n=amounts(e,a.trialUp??e.up);
        body.append(el('p','最初預測 · '+(choices[a.prediction]||'未填')),
          el('p','你的試驗 · 加價 '+(a.trialUp??e.up)+'% 時，最後售價為 '+money(n.final)+' 元。'),chart(a.trialUp??e.up,true).box);
      }
      body.append(el('p','另一件貨品原價 '+money(t.price)+' 元，先減價 '+t.down+'%，再按減價後的售價加價 '+t.up+'%。最後售價是多少？','pl-question'));
      if(readonly){
        const key=amounts(t);
        body.append(el('p','提交售價 · '+(a.exitPrice===null?'未填':money(a.exitPrice)+' 元')),
          el('p','參考計算 · '+money(t.price)+' × (1 − '+t.down+'%) × (1 + '+t.up+'%) ≈ '+money(key.finalCents/100)+' 元。','pl-equation'));
        if(a.reason)body.append(el('p',a.reason,'pl-caption'));return;
      }
      const price=el('input'),reason=el('textarea'),lab=el('label','最後售價（港元）','pl-answer'),
        explain=el('label','解釋你的算法（選填）','pl-answer');
      price.type='number';price.inputMode='decimal';price.min='0';price.step='0.01';price.max='1000000';
      price.value=a.exitPrice===null?'':String(a.exitPrice);
      price.oninput=()=>{a.exitPrice=price.value!==''&&price.validity.valid?price.valueAsNumber:null;change();};
      reason.rows=2;reason.maxLength=500;reason.value=a.reason;reason.oninput=()=>{a.reason=reason.value;change();};
      lab.append(price);explain.append(reason);
      body.append(el('p','先保留計算中所有小數，最後才四捨五入至最接近的仙。','pl-muted'),lab,explain,
        button('重看價格條',()=>go(2)));
    }
    function draw(){
      step.textContent='第 '+(chapter+1)+' / 4 節 · '+labels[chapter];
      head.textContent=['最後會高於、等於還是低於原價？','先從原價減去 '+e.down+'%','再加價時，哪個數是基數？',readonly?'你的作答紀錄':'把方法用在另一件貨品'][chapter];
      body.replaceChildren();[prediction,discount,explore,transfer][chapter]();
    }
    draw();return {read:()=>({...a}),destroy:()=>frame.remove()};
  }
  const api={parse,extract:parse,validate,project:core,grade,amounts,initial,mount};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.EduPercentLesson=api;
})(globalThis);
