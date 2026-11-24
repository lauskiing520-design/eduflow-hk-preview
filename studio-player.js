window.EduStudioPlayer=(()=>{
  'use strict';
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function matchPreview(data){
    if(data.kind!=='match')return {...data};
    // Rotate the choices so reading down the page does not give away the order.
    return {kind:data.kind,title:data.title,instructions:data.instructions,lefts:data.pairs.map(p=>p.left),
      choices:[...data.pairs.slice(1),data.pairs[0]].map(p=>p.right)};
  }
  function scorePreview(data,view,answers){
    const score=data.kind==='match'?answers.filter((v,i)=>view.choices[v]===data.pairs[i].right).length:
      Number(data.a*answers[0]+data.b===data.target);
    return {score,max:data.kind==='match'?data.pairs.length:1,answers};
  }
  function mount(host,data,receipt,submit,draft=null,saveDraft=null){
    const form=el('form'),instruction=el('p',data.instructions),fields=el('fieldset'),legend=el('legend','我的作答');
    fields.className='studio-player-fields';fields.append(legend);
    const message=el('p');message.setAttribute('role','status');
    const previous=receipt?.answers||draft?.answers;
    let read;
    if(data.kind==='match'){
      const selects=data.lefts.map((left,i)=>{
        const label=el('label',left),s=el('select');label.className='match-line';s.required=true;
        s.add(new Option('選擇配對',''));data.choices.forEach((v,j)=>s.add(new Option(v,String(j))));
        if(Number.isInteger(previous?.[i]))s.value=String(previous[i]);label.append(s);fields.append(label);return s;
      });
      read=()=>selects.map(s=>s.value===''?null:Number(s.value));
    }else{
      const lab=el('div');lab.className='lab';
      const x=el('input');x.type='range';x.step='1';x.min=data.min;x.max=data.max;x.value=String(previous?.[0]??Math.max(data.min,Math.min(0,data.max)));
      const variable=el('span'),label=el('label');label.append(variable,x);
      const formula=(data.a===1?'x':data.a===-1?'−x':data.a+'x')+
        (data.b>0?' + '+data.b:data.b<0?' − '+(-data.b):'');
      const formulaLine=el('p',formula+' = '+data.target),output=el('output');
      const balance=el('div');balance.className='studio-balance';balance.setAttribute('aria-hidden','true');
      const beam=el('div');beam.className='studio-beam';
      const left=el('span'),right=el('span');left.className='studio-pan left';right.className='studio-pan right';
      beam.append(left,right);balance.append(beam);
      const redraw=()=>{variable.textContent='調整 x　'+x.value;const value=data.a*Number(x.value)+data.b;
        const diff=data.target-value;
        // In screen coordinates a positive rotation lowers the right-hand pan.
        const tilt=diff===0?0:Math.sign(diff)*Math.min(13,3+Math.sqrt(Math.abs(diff))*1.3);
        beam.style.setProperty('--studio-tilt',tilt+'deg');left.textContent=value;right.textContent=data.target;
        x.setAttribute('aria-valuetext','x 等於 '+x.value+'，左邊 '+value+'，右邊 '+data.target);
        output.textContent='左邊 '+value+(value===data.target?' ＝ ':value<data.target?' ＜ ':' ＞ ')+'右邊 '+data.target+(value===data.target?' · 平衡':'');};
      redraw();x.addEventListener('input',redraw);lab.append(formulaLine,balance,label,output);fields.append(lab);read=()=>[Number(x.value)];
    }
    const button=el('button','提交作答');button.type='submit';button.className='primary';
    const save=el('button','保存進度');save.type='button';save.hidden=!saveDraft;
    const bar=el('div');bar.className='actions';bar.append(button,save);
    const report=r=>{fields.disabled=true;bar.hidden=true;message.textContent='已完成，得分 '+r.score+' / '+r.max+'。';};
    form.append(instruction,fields,bar,message);host.replaceChildren(form);
    if(receipt){report(receipt);return;}
    if(draft?.revision)message.textContent='已讀取上次保存的進度。';
    save.onclick=async()=>{
      if(!saveDraft||save.disabled)return;const answers=read();
      button.disabled=save.disabled=fields.disabled=true;
      try{await saveDraft(answers);message.textContent='進度已保存，可從學生入口繼續。';}
      catch(err){message.textContent=err.message;}
      finally{button.disabled=save.disabled=fields.disabled=false;}
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(button.disabled)return;
      const answers=read();
      if(data.kind==='match'&&new Set(answers).size!==answers.length){message.textContent='每個選項只可配對一次，請檢查重複的選項。';return;}
      button.disabled=save.disabled=true;fields.disabled=true;message.textContent='正在提交…';
      try{const r=await submit(answers);report(r);}
      catch(error){message.textContent=error.message;button.disabled=save.disabled=false;fields.disabled=false;}
    };
  }
  return {matchPreview,scorePreview,mount};
})();
