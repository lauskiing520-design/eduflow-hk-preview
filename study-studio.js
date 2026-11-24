(async (fetch)=>{
  'use strict';
  const $=id=>document.getElementById(id),work=$('work'),status=$('status'),params=new URLSearchParams(location.search);
  const token='demo';
  const url='/api/eduflow/student/',enc=encodeURIComponent;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const notice=(s,err=false)=>{status.textContent=s;status.classList.toggle('error',err);};
  async function api(path,body){
    const response=await fetch(url+path,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',
      headers:{'Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>null);if(!response.ok||!data)throw Error(data?.error||'未能讀取，請重新開啟老師提供的入口。');
    return data;
  }
  function list(items,type){
    const box=el('section',undefined,'panel');box.append(el('h2',type==='activity'?'互動活動':'班級導師'));
    if(!items.length)box.append(el('p','目前未有指派。','muted'));
    for(const x of items){
      const row=el('div',undefined,'line'),copy=el('div'),go=el('a',type==='activity'?(x.submitted?'查看作答':'開啟活動'):'向導師提問','button');
      const query=new URLSearchParams({[type]:x.id});if(type==='tutor')query.set('class',x.classId);
      go.href='study-studio.html?'+query+'#portal/'+enc(token);
      copy.append(el('strong',x.title),el('p',x.className+(type==='activity'?(x.submitted?' · 已完成':' · 待完成'):''),'muted'));row.append(copy,go);box.append(row);
    }return box;
  }
  function renderMessages(host,turns){
    const items=turns.map(t=>{const li=el('li');li.append(el('strong','我'),el('p',t.message),el('strong','導師'),el('p',t.reply));return li;});
    host.replaceChildren(...items);
  }
  async function tutor(id,room){
    const path='studio-tutors?'+new URLSearchParams({classId:room,id}),d=await api(path);
    $('heading').textContent=d.tutor.title;$('scope').textContent=d.tutor.className||'班級導師';
    const box=el('section',undefined,'panel'),log=el('ol',undefined,'dialogue'),form=el('form');
    const label=el('label','我的問題'),input=el('textarea');input.required=true;input.maxLength=600;input.rows=3;label.append(input);
    const submit=el('button','傳送問題','primary');submit.type='submit';
    let requestId=crypto.randomUUID().replaceAll('-','');input.oninput=()=>{requestId=crypto.randomUUID().replaceAll('-','');};
    form.append(label,submit);box.append(el('h2','與導師對話'),log,form);work.replaceChildren(box);renderMessages(log,d.turns);
    form.onsubmit=async e=>{
      e.preventDefault();if(!input.value.trim()||submit.disabled)return;
      submit.disabled=true;input.readOnly=true;notice('導師正在回應…');
      try{
        const r=await api(path,{message:input.value.trim(),requestId,revision:d.tutor.revision});
        renderMessages(log,r.turns);input.value='';requestId=crypto.randomUUID().replaceAll('-','');notice('對話已保存。');
      }catch(err){notice(err.message,true);}finally{input.readOnly=false;submit.disabled=false;}
    };
  }
  async function activity(pin){
    const post=(action,extra)=>api('studio-activity',{action,pin,...extra});
    const d=await post('read');$('heading').textContent=d.data.title;$('scope').textContent='課堂互動活動';
    const box=el('section',undefined,'panel');work.replaceChildren(box);
    let revision=d.draft?.revision||0;
    EduStudioPlayer.mount(box,d.data,d.receipt,async answers=>(await post('submit',{answers,revision})).receipt,
      d.draft,async answers=>{
        const result=await post('draft',{answers,revision});revision=result.draft.revision;
      });
  }
  try{
    if(!token)throw Error('請從老師提供的學生固定入口開啟這項活動或導師。');
    $('back').href=params.has('activity')||params.has('tutor')?'study-studio.html':'schools.html';$('back').textContent=params.has('activity')||params.has('tutor')?'返回學生課室':'返回學校試用';
    if(params.get('activity'))await activity(params.get('activity'));
    else if(params.get('tutor')&&params.get('class'))await tutor(params.get('tutor'),params.get('class'));
    else{const r=await api('session');work.replaceChildren(list(r.studioActivities||[],'activity'),list(r.studioTutors||[],'tutor'));}
    notice('');
  }catch(err){notice(err.message,true);}
})(window.EduStudioDemo.request);
