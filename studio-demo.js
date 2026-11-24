/* Offline transport for GitHub Pages. All fixtures and interactions live in this browser. */
(() => {
  'use strict';
  const storage='eduflow:classroom-studio:v1';
  const rooms=[{id:'a'.repeat(32),name:'中一甲班'},{id:'b'.repeat(32),name:'中一乙班'}];
  const a0='1'.repeat(32), t0='2'.repeat(32), p0='3'.repeat(32);
  const activityPath='/api/eduflow/ai/studio/activities', tutorPath='/api/eduflow/ai/studio/tutors';
  const examples={
    match:{kind:'match',title:'辨認移項後的方程',instructions:'把每條方程與正確的第一步配對。',pairs:[
      {left:'x + 7 = 12',right:'x = 12 − 7'},{left:'x − 3 = 5',right:'x = 5 + 3'},{left:'4x = 20',right:'x = 20 ÷ 4'}]},
    balance:{kind:'balance',title:'令等式兩邊平衡',instructions:'改變 x，觀察左方的值，找出兩邊相等的位置。',a:2,b:3,target:13,min:-6,max:10}
  };
  const initialTutor={id:t0,revision:1,title:'方程小導師',rules:'先請學生說出要消去的項，每次只問一個問題。',sourceName:'中一方程課堂筆記',
    material:'等式兩邊同時加上或減去同一個數，等式仍然成立。\n處理 2x + 3 = 13 時，先思考怎樣消去左邊的常數項。\n驗算時，把求得的 x 代入原方程，再比較兩邊的值。'};
  const clone=o=>structuredClone(o);
  function seed(){
    const activities={},pins={};
    for(const [item,pin,data] of [[a0,p0,examples.match],['4'.repeat(32),'5'.repeat(32),examples.balance]]){
      activities[item]={id:item,revision:1,data:clone(data)};
      pins[pin]={id:pin,item,room:rooms[0].id,revision:1,active:true,data:clone(data)};
    }
    return {rev:0,activities,pins,receipts:{},drafts:{},pinRequests:{},tutors:{[t0]:clone(initialTutor)},
      published:{[rooms[0].id+':'+t0]:clone(initialTutor)},chats:{},requests:{}};
  }
  function read(){const value=localStorage.getItem(storage);return value?JSON.parse(value):seed();}
  const room=id=>rooms.find(x=>x.id===id);
  const arr=Object.values;
  const ident=s=>typeof s==='string'&&/^[0-9a-f]{32}$/i.test(s);
  const clean=(v,max)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():'';
  function fail(message,code=400){const e=new Error(message);e.status=code;throw e;}
  function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});}
  function save(s){
    if(read().rev!==s.rev)fail('另一分頁剛更新了資料，請重新載入再試。',409);
    s.rev++;localStorage.setItem(storage,JSON.stringify(s));
  }
  function validate(d){
    if(!d||!clean(d.title,100)||!clean(d.instructions,600))fail('請填寫活動名稱（最多 100 字）和說明（最多 600 字）。');
    if(d.kind==='match'){
      if(!Array.isArray(d.pairs)||d.pairs.length<2||d.pairs.length>8||
        d.pairs.some(p=>!clean(p?.left,160)||!clean(p?.right,160)))fail('請提供 2 至 8 組完整配對，每項最多 160 字。');
      const normalize=s=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
      for(const col of ['left','right'])if(new Set(d.pairs.map(p=>normalize(p[col]))).size!==d.pairs.length)fail('配對選項需要能夠區分，請修改重複選項。');
    }else if(d.kind==='balance'){
      if(!['a','b','target','min','max'].every(k=>Number.isSafeInteger(d[k]))||d.a===0||Math.abs(d.a)>20||Math.abs(d.b)>100||Math.abs(d.target)>2100||d.min< -100||d.max>100||d.min>=d.max||
        !Number.isInteger((d.target-d.b)/d.a)||(d.target-d.b)/d.a<d.min||(d.target-d.b)/d.a>d.max)fail('請設定範圍內有整數解的方程。');
    }else fail('請選擇配對或方程實驗。');
    return clone(d);
  }
  function draft(kind,brief){
    if(!clean(brief,2000)||!Object.hasOwn(examples,kind))fail('請輸入活動要求。');
    const d=clone(examples[kind]);
    if(kind==='balance'){
      const f=brief.normalize('NFKC').replace(/[−–]/g,'-').replace(/\s+/g,'').match(/([+-]?\d*)[xX]([+-]\d+)?=(-?\d+)/);
      if(f){d.a=f[1]==='-'?-1:f[1]==='+'?1:Number(f[1]||1);d.b=Number(f[2]||0);d.target=Number(f[3]);const sol=(d.target-d.b)/d.a;d.min=Math.max(-100,Math.min(-5,sol-3));d.max=Math.min(100,Math.max(8,sol+3));}
      else if(!/方程|天平|平衡|等式|equation|balance/i.test(brief))fail('展示站可從例如「2x + 3 = 13」建立方程草稿；你也可以直接填活動內容。');
    }else{
      const parsed=brief.split(/[\n;；]/).map(line=>line.trim().split(/\s*(?:→|↔|=>|｜|\|)\s*/)).filter(bits=>bits.length===2&&bits.every(Boolean));
      if(parsed.length>=2)d.pairs=parsed.map(([left,right])=>({left,right}));
      else if(/百分|折扣|percent/i.test(brief)){
        d.title='百分比與小數配對';d.pairs=[{left:'25%',right:'0.25'},{left:'80%',right:'0.8'},{left:'150%',right:'1.5'}];d.instructions='為每個百分比選擇相同數值的小數。';
      }else if(/密度|浮沉|科學/.test(brief)){
        d.title='量度與單位';d.instructions='為每個物理量選擇相應單位。';d.pairs=[{left:'密度',right:'g/cm³'},{left:'體積',right:'cm³'},{left:'質量',right:'g'}];
      }else if(!/方程|移項|equation/i.test(brief))fail('展示站支援方程、百分比、密度示例。其他主題請每行寫「詞語 → 解釋」，至少兩行，或直接編寫配對。');
      if(parsed.length>=2){d.title='自訂配對練習';d.instructions='為左方每個項目選出相應選項。';}
    }
    return validate(d);
  }
  function shuffledChoices(d){
    if(d.kind!=='match')return null;
    const options=d.pairs.map(p=>p.right);
    for(let i=options.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [options[i],options[j]]=[options[j],options[i]];
    }
    return options;
  }
  function publicData(d,options){
    if(d.kind!=='match')return clone(d);
    // Keep the order used by the introductory example and earlier saved attempts.
    const original=d.pairs.map(p=>p.right);
    return {kind:d.kind,title:d.title,instructions:d.instructions,lefts:d.pairs.map(p=>p.left),choices:options??original.slice(1).concat(original[0])};
  }
  function activityListing(s){
    return arr(s.pins).filter(p=>p.active).map(p=>({id:p.id,title:p.data.title,kind:p.data.kind,
      className:room(p.room).name,classId:p.room,revision:p.revision,submitted:!!s.receipts[p.id]}));
  }
  function activity(s,url,b){
    if(!b){
      if(url.searchParams.has('item')){
        const item=s.activities[url.searchParams.get('item')];if(!item)fail('找不到這個活動。',404);
        return {...item,pins:arr(s.pins).filter(p=>p.item===item.id).map(({id,room:r,revision,active})=>({id,room:r,className:room(r).name,revision,active}))};
      }
      if(url.searchParams.has('pin')){
        const p=s.pins[url.searchParams.get('pin')];if(!p)fail('找不到派發記錄。',404);
        const r=s.receipts[p.id];return {title:p.data.title,className:room(p.room).name,students:[{label:'示例學生 01',submitted:!!r,score:r?.score??null,max:r?.max??(p.data.kind==='match'?p.data.pairs.length:1)}]};
      }
      return {rooms,items:arr(s.activities).map(x=>({id:x.id,title:x.data.title,kind:x.data.kind,revision:x.revision}))};
    }
    if(b.action==='generate')return {data:draft(b.kind,b.brief)};
    if(b.action==='unpin'){
      const p=s.pins[b.pin];if(!p)fail('找不到派發記錄。',404);p.active=false;save(s);return {removed:true};
    }
    if(!ident(b.id))fail('活動識別碼無效。');
    const old=s.activities[b.id];
    if(b.action==='save'){
      if(old&&JSON.stringify(old.data)===JSON.stringify(b.data))return {id:old.id,revision:old.revision};
      if((old?.revision||0)!==b.revision)fail('草稿已更新，請重新載入。',409);
      const item={id:b.id,revision:b.revision+1,data:validate(b.data)};s.activities[item.id]=item;save(s);
      return {id:item.id,revision:item.revision};
    }
    if(b.action==='pin'&&old&&room(b.room)){
      if(!ident(b.requestId))fail('派發編號無效，請重試。');
      const done=s.pinRequests[b.requestId];
      if(done){
        const published=s.pins[done.pin];
        if(published?.item!==b.id||published?.room!==b.room||published?.revision!==b.revision)fail('派發資料已變更，請重新派發。',409);
        return done;
      }
      if(old.revision!==b.revision)fail('請先讀取最新版本。',409);
      let existing=arr(s.pins).find(p=>p.active&&p.room===b.room&&p.item===b.id);
      if(existing&&existing.revision!==b.revision){existing.active=false;existing=null;}
      const id=existing?.id||crypto.randomUUID().replaceAll('-','');
      if(!existing)s.pins[id]={id,item:b.id,room:b.room,revision:b.revision,data:clone(old.data),options:shuffledChoices(old.data),active:true};
      const result={pin:id,revision:b.revision};s.pinRequests[b.requestId]=result;save(s);return result;
    }
    fail('找不到指定的活動或班級。',404);
  }
  function studentActivity(s,b){
    const p=s.pins[b?.pin];if(!p?.active)fail('這個活動已收起，請返回課室。',404);
    const d=p.data,data=publicData(d,p.options),empty={revision:0,answers:null};
    s.drafts??={};let draft=s.drafts[p.id]||empty;
    if(!s.receipts[p.id]&&['submit','draft'].includes(b.action)){
      const a=b.answers,max=d.kind==='match'?d.pairs.length:1;
      if(!Array.isArray(a)||a.length!==max||a.some(v=>v!==null&&(!Number.isInteger(v)||(d.kind==='match'?(v<0||v>=max):(v<d.min||v>d.max)))))fail('請核對活動作答。');
      if((b.revision??0)!==draft.revision&&!(b.action==='draft'&&JSON.stringify(a)===JSON.stringify(draft.answers)))fail('進度已在另一分頁更新，請重新載入。',409);
      if(b.action==='draft'&&JSON.stringify(a)!==JSON.stringify(draft.answers)){
        draft={revision:draft.revision+1,answers:a.slice()};s.drafts[p.id]=draft;save(s);
      }
    }
    if(b.action==='submit'&&!s.receipts[p.id]){
      const a=b.answers;if(!Array.isArray(a)||!a.every(Number.isInteger))fail('請完成活動再提交。');
      let score,max;
      if(d.kind==='match'){
        max=d.pairs.length;if(a.length!==max||new Set(a).size!==max||a.some(n=>n<0||n>=max))fail('尚有項目未配對，或有重複配對。');
        score=d.pairs.filter((pair,i)=>data.choices[a[i]]===pair.right).length;
      }else{if(a.length!==1||a[0]<d.min||a[0]>d.max)fail('請選擇範圍內的 x。');max=1;score=Number(d.a*a[0]+d.b===d.target);}
      s.receipts[p.id]={score,max,answers:a.slice()};delete s.drafts[p.id];draft=empty;save(s);
    }else if(!['read','draft','submit'].includes(b.action))fail('未支援這個操作。');
    return {id:p.id,data,receipt:s.receipts[p.id]||null,draft};
  }
  function demoReply(t,message){
    const msg=clean(message,600);if(!msg)fail('請輸入 600 字以內的問題。');
    const split=t.material.split(/[\n。！？!?]+/).map(x=>x.trim()).filter(Boolean);
    if(!split.length)return '這位導師尚未附上教材。請說明你想核對的步驟，再請老師補充資料。';
    const grams=text=>[...new Set((text.toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/g)||[]).flatMap(word=>
      /^[\u3400-\u9fff]/.test(word)?[...word].slice(1).map((c,i)=>word[i]+c):[word]))];
    const words=grams(msg);
    const ranked=split.map((line,i)=>({line,i,score:words.reduce((n,w)=>n+Number(line.toLowerCase().includes(w)),0)})).sort((a,b)=>b.score-a.score||a.i-b.i);
    const cite=ranked[0];if(!cite.score)return '在現有教材內找不到這個問題的對應段落。可用一個教材內的詞語再問，或請老師補充內容。';
    const question=/例子|舉例/.test(t.rules)?'你能用自己的例子說明這一點嗎？':/驗算|代入/.test(t.rules)?'請試把你的結果代入，兩邊各得到甚麼？':'對照這一段，你會先做哪一步？';
    return '教材摘句（'+(t.sourceName||'老師提供的材料')+'）：「'+cite.line+'」。\n'+question;
  }
  const keyFor=(c,id)=>c+':'+id;
  function tutorList(s){return Object.entries(s.published).map(([key,t])=>({id:t.id,title:t.title,revision:t.revision,classId:key.split(':')[0],className:room(key.split(':')[0]).name}));}
  function tutor(s,url,b){
    const c=url.searchParams.get('classId'),validRoom=room(c);
    if(c&&!validRoom)fail('找不到班級。',404);
    if(!b)return {tutors:arr(s.tutors).map(t=>{
      const k=keyFor(c,t.id), turns=Object.entries(s.chats).filter(([n])=>c?n.startsWith(k+':'):n.split(':')[1]===t.id).reduce((n,[,v])=>n+v.length,0);
      return {...t,pinnedRevision:s.published[k]?.revision??null,usage:{students:Number(turns>0),turns}};
    })};
    if(!ident(b.id))fail('導師識別碼無效。');
    const old=s.tutors[b.id],key=keyFor(c,b.id);
    if(b.action==='save'){
      if(!clean(b.title,80)||!clean(b.rules,2000))fail('請填寫導師名稱（最多 80 字）和引導規則（最多 2,000 字）。');
      if((b.material&& !clean(b.material,12000))||(b.sourceName&& !clean(b.sourceName,140)))fail('請縮短教材或來源名稱。');
      const t={id:b.id,revision:b.revision+1,title:b.title.trim(),rules:b.rules.trim(),material:b.material||'',sourceName:b.sourceName||''};
      const unchanged=old&&['title','rules','material','sourceName'].every(k=>t[k]===old[k]);
      if(!unchanged){
        if((old?.revision||0)!==b.revision)fail('導師已改版，請重新載入再試。',409);
        s.tutors[b.id]=t;save(s);
      }
      return {tutor:tutor(s,url,null).tutors.find(v=>v.id===b.id)};
    }
    if(!old)fail('找不到導師。',404);
    if(old.revision!==b.revision)fail('導師已改版，請重新載入再試。',409);
    if(b.action==='preview')return {reply:demoReply(old,b.message)};
    if(validRoom&&['pin','unpin'].includes(b.action)){
      if((s.published[key]?.revision??null)!==b.pinnedRevision)fail('班級版本已更新，請重新讀取。',409);
      if(b.action==='pin')s.published[key]=clone(old);else delete s.published[key];
      save(s);return {ok:true};
    }
    fail('請選擇要使用導師的課室。');
  }
  function studentTutor(s,url,b){
    const c=url.searchParams.get('classId'),id=url.searchParams.get('id');
    if(!c&&!id&&!b)return {tutors:tutorList(s)};
    const t=s.published[keyFor(c,id)];if(!t)fail('這位導師已由老師收起。',404);
    const k=keyFor(c,id)+':'+t.revision,turns=s.chats[k]||[];
    if(b){
      if(t.revision!==b.revision)fail('導師已更新，請重新載入。',409);
      if(!ident(b.requestId))fail('提問編號無效，請重試。');
      const saved=s.requests[k+':'+b.requestId];
      if(saved){
        if(typeof saved==='object'&&saved.message!==b.message)fail('提問已變更，請重新送出。',409);
        return {reply:typeof saved==='string'?saved:saved.reply,turns};
      }
      const reply=demoReply(t,b.message);turns.push({message:b.message,reply});s.chats[k]=turns;
      s.requests[k+':'+b.requestId]={message:b.message,reply};save(s);return {reply,turns};
    }
    return {tutor:{id,title:t.title,revision:t.revision,classId:c,className:room(c).name},turns};
  }
  async function readMaterial(f){
    if(!f||f.size>12*1024*1024)fail('請選擇 12 MB 以內的示例文件。');
    let text;
    if(/\.txt$/i.test(f.name)){text=new TextDecoder().decode(await f.arrayBuffer());}
    else if(/\.docx$/i.test(f.name)){
      const bytes=new Uint8Array(await f.arrayBuffer()),v=new DataView(bytes.buffer),textDecoder=new TextDecoder();
      const u16=n=>v.getUint16(n,true),u32=n=>v.getUint32(n,true);
      let end=bytes.length-22;
      for(;end>=Math.max(0,bytes.length-65557);end--)if(u32(end)===0x06054b50&&end+22+u16(end+20)===bytes.length)break;
      if(end<0||end<bytes.length-65557)fail('未能讀取 Word 文件目錄。');
      let offset=u32(end+16),found=false;
      for(let i=0;i<Math.min(u16(end+10),4096)&&offset+46<=end;i++){
        if(u32(offset)!==0x02014b50)break;
        const nameLen=u16(offset+28),next=offset+46+nameLen+u16(offset+30)+u16(offset+32);
        if(next>end)break;
        if(textDecoder.decode(bytes.subarray(offset+46,offset+46+nameLen))==='word/document.xml'){found=true;break;}
        offset=next;
      }
      if(!found||u32(offset+24)>4*1024*1024||(u16(offset+8)&1))fail('請選擇含可讀文字的 Word 教材。');
      const local=u32(offset+42);if(local+30>bytes.length||u32(local)!==0x04034b50)fail('未能讀取 Word 正文。');
      const start=local+30+u16(local+26)+u16(local+28),endData=start+u32(offset+20),method=u16(offset+10);
      if(endData>bytes.length||![0,8].includes(method))fail('未能讀取 Word 正文。');
      let stream=new Blob([bytes.subarray(start,endData)]).stream();
      if(method===8)stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));
      const reader=stream.getReader(),chunks=[];let size=0;
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
        if(size>4*1024*1024){await reader.cancel();fail('教材文字太長。請選取相關段落貼上。');}chunks.push(part.value);}
      const xml=await new Blob(chunks).text();
      if(/<!DOCTYPE/i.test(xml))fail('這份文件未能讀取。');
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      if(doc.querySelector('parsererror'))fail('未能讀取 Word 文字。');
      const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      text=Array.from(doc.getElementsByTagNameNS(ns,'p'),p=>Array.from(p.getElementsByTagNameNS(ns,'t'),n=>n.textContent).join('')).join('\n');
    }else fail('展示站可讀取 DOCX 或 TXT，亦可貼上教材文字。');
    text=text.trim();if(!text)fail('檔案內沒有可用的文字。');if(text.length>12000)fail('請選取不多於 12,000 字的教材節錄。');
    return {material:text,sourceName:f.name};
  }
  async function request(input,init={}){
    try{
      const url=new URL(input,location.href),p=url.pathname;
      if(url.origin!==location.origin)fail('此示例只使用本頁資料。');
      if(p==='/api/eduflow/ai/session')return reply({account_id:'studio-demo',csrf_token:'local-demo',available:true});
      if(p===tutorPath+'/import'){
        const f=init.body?.get?.('file');
        return reply(await readMaterial(f));
      }
      const s=read(),b=typeof init.body==='string'?JSON.parse(init.body):null;
      if(p===activityPath)return reply(activity(s,url,b));
      if(p===tutorPath)return reply(tutor(s,url,b));
      if(p==='/api/eduflow/student/session')return reply({label:'示例學生 01',studioActivities:activityListing(s),studioTutors:tutorList(s)});
      if(p==='/api/eduflow/student/studio-activity')return reply(studentActivity(s,b));
      if(p==='/api/eduflow/student/studio-tutors')return reply(studentTutor(s,url,b));
      fail('找不到這項示例操作。',404);
    }catch(e){return reply({error:e.message||'未能保存，請重新載入。'},e.status||400);}
  }
  window.EduStudioDemo={request};
})();
