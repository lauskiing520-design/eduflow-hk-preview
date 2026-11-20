(async ()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const demo=document.body.dataset.demo==='true';
  const params=new URLSearchParams(location.search);
  const room=!demo&&params.get('room'), activity=!demo&&params.get('activity');
  const portal=!demo&&location.hash.startsWith('#portal/')?decodeURIComponent(location.hash.slice(8)):'';
  const materials={wood:['木塊',.60],ice:['冰塊',.92],plastic:['塑膠樣本',1.00],aluminium:['鋁塊',2.70]};
  const liquids={water:['水',1],oil:['油',.90],brine:['鹽水',1.20]};
  const actionNames={float:'上浮',suspend:'懸浮',sink:'下沉'};
  const format=new Intl.NumberFormat('zh-HK',{maximumFractionDigits:2});
  const setStatus=s=>$('#status').textContent=s;
  const initial={material:'wood',liquid:'water',volume:40,prediction:''};
  function measured(t){
    const density=materials[t.material][1], rho=liquids[t.liquid][1];
    return {...t,mass:t.volume*density,displaced:Math.round(100*t.volume*Math.min(1,density/rho))/100,
      result:density<rho?'float':density>rho?'sink':'suspend'};
  }
  function table(trials){
    if(!trials.length)return '<p>還沒有觀察記錄。</p>';
    const rows=trials.map((t,i)=>`<tr><td>${i+1}</td><td>${materials[t.material][0]}</td><td>${liquids[t.liquid][0]}</td><td>${t.volume}</td><td>${format.format(t.mass)}</td><td>${actionNames[t.prediction]}</td><td>${actionNames[t.result]}</td><td>${format.format(t.displaced)}</td></tr>`).join('');
    return '<div class="scroll" tabindex="0" role="region" aria-label="試驗記錄"><table><thead><tr><th>次序</th><th>材料</th><th>液體</th><th>體積 cm³</th><th>質量 g</th><th>預測</th><th>結果</th><th>排液 cm³</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  async function api(url,options={}){
    const res=await fetch(url,{cache:'no-store',...options});
    const json=await res.json().catch(()=>null);
    if(!res.ok||!json){const e=new Error(json?.error||'未能連接工作台，請稍後重試。');e.code=json?.code;throw e;}
    return json;
  }
  async function teacher(){
    const url='/api/eduflow/ai/classrooms/'+encodeURIComponent(room)+'/density';
    $('#back').href='assessment.html#classes/rooms/'+encodeURIComponent(room);$('#back').textContent='返回班級';
    const session=await api('/api/eduflow/ai/session');const box=$('#desk');box.hidden=false;
    async function listing(){
      const data=await api(url);$('#context').textContent=data.className+' · 實驗作業';
      box.innerHTML='<section class="teacher-block"><h2>派發活動</h2><p>學生先作預測，改變試樣材料、體積或液體，記錄兩次可比較的試驗，再提交結論。</p><a href="density-lab.html" target="_blank" rel="noopener">預覽學生實驗</a><form><label>活動名稱<input name="title" maxlength="100" required value="密度與浮沉探究"></label><button>派給本班學生</button></form></section><section class="teacher-block"><h2>已派活動</h2>'+data.activities.map(a=>`<article><h3>${esc(a.title)}</h3><p>${a.submitted} / ${a.total} 人已提交</p><button class="secondary" data-report="${esc(a.id)}">查看觀察與結論</button></article>`).join('')+(data.activities.length?'':'<p>這班尚未派發實驗。</p>')+'</section><div id="report" aria-live="polite"></div>';
      const form=box.querySelector('form');let requestId,titleSent;
      form.onsubmit=async e=>{
        e.preventDefault();const button=form.querySelector('button');button.disabled=true;
        try{
          const title=form.elements.title.value;
          if(titleSent!==title){requestId=crypto.randomUUID();titleSent=title;}
          await api(url,{method:'POST',headers:{'Content-Type':'application/json','X-Eduflow-CSRF':session.csrf_token},body:JSON.stringify({title,requestId})});
          await listing();setStatus('已派給本次班級名單中的學生。');
        }catch(err){setStatus(err.message);}finally{button.disabled=false;}
      };
      box.querySelectorAll('[data-report]').forEach(b=>b.onclick=async()=>{
        const target=$('#report');target.textContent='正在讀取…';
        try{
          const report=await api(url+'?activity='+encodeURIComponent(b.dataset.report));
          target.innerHTML=`<section class="teacher-block"><h2>${esc(report.title)}</h2>`+report.students.map(s=>`<article><h3>${esc(s.label)}</h3>${s.submitted?table(s.state.trials)+'<p><strong>結論</strong>　'+esc(s.state.conclusion)+'</p>':'<p>尚未提交</p>'}</article>`).join('')+'</section>';
          target.scrollIntoView({block:'nearest'});
        }catch(err){target.textContent=err.message;}
      });
    }
    await listing();
  }
  let state={trials:[],conclusion:'',setup:{...initial}},revision=0,submitted=false,dirty=false;
  let timer,queue=Promise.resolve(),blocked=false;
  const localKey='eduflow:density-lab:v1';
  const student=Boolean(activity&&portal);
  const studentCall=(action,extra={})=>api('/api/eduflow/student/density',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+portal},body:JSON.stringify({activity,action,...extra})});
  function readSetup(){
    const f=$('#setup').elements;
    return {material:f.material.value,liquid:f.liquid.value,volume:Number(f.volume.value),prediction:f.prediction.value};
  }
  function place(t,show){
    const sample=$('#sample');const size=30*Math.cbrt(t.volume/20);
    sample.style.width=size+'px';sample.style.height=size+'px';sample.dataset.m=t.material;
    $('#beaker').dataset.liquid=t.liquid;$('#liquidLabel').textContent=liquids[t.liquid][0]+' · '+liquids[t.liquid][1].toFixed(2)+' g/cm³';
    sample.classList.remove('releasing');sample.style.transform='translateY(74px)';
    if(show){
      sample.getBoundingClientRect();sample.classList.add('releasing');
      const top=t.result==='float'?58-size*(1-materials[t.material][1]/liquids[t.liquid][1]):t.result==='sink'?210-size:74;
      sample.style.transform='translateY('+top+'px)';
      $('#result').textContent='模擬觀察：'+actionNames[t.result]+'。你的預測是'+actionNames[t.prediction]+'。';
      $('#v').textContent=t.volume+' cm³';$('#m').textContent=format.format(t.mass)+' g';$('#disp').textContent=format.format(t.displaced)+' cm³';
    }else{
      $('#result').textContent='試樣已放在液面下。先作預測，再放手觀察。';$('#v').textContent=t.volume+' cm³';$('#m').textContent='—';$('#disp').textContent='—';
    }
  }
  function redraw(){
    const f=$('#setup').elements,s=state.setup||initial;
    for(const k of Object.keys(initial))f[k].value=s[k]??initial[k];
    $('#rows').innerHTML=table(state.trials);$('#conclusion').value=state.conclusion;
    const last=state.trials.at(-1);place(s, false);
    if(last && ['material','volume','liquid','prediction'].every(k=>s[k]===last[k]))place(last,true);
    Array.from(f).forEach(el=>el.disabled=submitted);
    $('#undoTrial').hidden=submitted||!state.trials.length;
    $('#conclusion').readOnly=submitted;$('#save').hidden=submitted;$('#submit').hidden=!student||submitted;
  }
  function save(send=false){
    clearTimeout(timer);
    const snapshot=JSON.stringify(state);
    queue=queue.catch(()=>{}).then(async()=>{
      if(blocked||submitted)return;
      if(student){
        const r=await studentCall(send?'submit':'save',{revision,state:JSON.parse(snapshot)});revision=r.revision;submitted=r.submitted;
      }else localStorage.setItem(localKey,snapshot);
      if(JSON.stringify(state)===snapshot)dirty=false;
      setStatus(submitted?'已提交給老師，可以重看你的觀察記錄。':student?'草稿已保存到學校工作台。':'記錄已保存到這個瀏覽器。');
      if(submitted)redraw();
    }).catch(err=>{
      if(err.code==='conflict'||err.code==='submitted'){blocked=true;$('#reload').hidden=false;}
      setStatus(err.message||'未能保存，請保留此頁重試。');
    });
    return queue;
  }
  function changed(){dirty=true;clearTimeout(timer);timer=setTimeout(()=>save(),400);}
  async function lab(){
    if(activity&&!portal)throw new Error('請從學生固定入口開啟這份活動。');
    if(student){
      $('#back').href='student.html#portal/'+encodeURIComponent(portal);$('#back').textContent='返回我的作業';
      const r=await studentCall('read');state=r.state;revision=r.revision;submitted=r.submitted;
      $('#context').textContent=r.className+' · '+r.title;
      setStatus(submitted?'這份實驗已提交。':'實驗草稿保存在學校工作台。');
    }else{
      $('#context').textContent='中一科學探究 · 自主模擬';
      try{const raw=localStorage.getItem(localKey);if(raw){const saved=JSON.parse(raw);if(Array.isArray(saved.trials)&&typeof saved.conclusion==='string'){state={...saved,trials:saved.trials.filter(t=>materials[t.material]&&liquids[t.liquid]&&[20,40,60,80,100].includes(t.volume)&&actionNames[t.prediction]).slice(0,20).map(measured)};if(!materials[state.setup?.material]||!liquids[state.setup?.liquid])state.setup={...initial};}}}catch{}
      setStatus('這次模擬的觀察記錄只保存在目前瀏覽器。');
    }
    $('#lab').hidden=false;redraw();
    const f=$('#setup');
    f.onchange=e=>{
      if(e.target.name!=='prediction')f.elements.prediction.value='';
      state.setup=readSetup();place(state.setup,false);changed();
    };
    f.onsubmit=e=>{
      e.preventDefault();if(state.trials.length>=20){setStatus('已達本次活動的 20 次記錄上限。');return;}
      state.setup=readSetup();const t=measured(state.setup);state.trials.push(t);place(t,true);$('#rows').innerHTML=table(state.trials);$('#undoTrial').hidden=false;changed();
    };
    $('#undoTrial').onclick=()=>{state.trials.pop();redraw();changed();};
    $('#conclusion').oninput=e=>{state.conclusion=e.target.value;changed();};
    $('#save').onclick=()=>save();
    $('#submit').onclick=async()=>{
      const button=$('#submit');button.disabled=true;
      // Lock the complete state while handing it in, so edits after submission cannot appear saved.
      Array.from(f.elements).forEach(el=>el.disabled=true);$('#conclusion').readOnly=true;
      const undo=$('#undoTrial');undo.disabled=true;try{await save(true);}finally{button.disabled=false;undo.disabled=false;if(!submitted)redraw();}
    };
    $('#reload').onclick=()=>{dirty=false;location.reload();};
    addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  }
  try{if(room)await teacher();else await lab();}catch(err){setStatus(err.message);}
})();
