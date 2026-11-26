/* The teacher and student here are two views of a fictional paper on this browser. */
(() => {
  'use strict';
  const papers = {
    expand: {
      question:'解方程 2(x − 3) = 10，並寫出步驟。',
      working:['2x − 3 = 10','2x = 13'], answer:'x = 6.5',
      prompts:[
        '試下代 x = 5 入原本嘅 2(x − 3)，再代入你寫嘅 2x − 3。兩個值一唔一樣？你會點解釋？',
        '由上一行去到呢一行，你喺等式兩邊分別做咗咩？',
        '將你嘅答案代返入原本有括號嗰條式，你會點樣核對左右兩邊？'
      ]
    },
    marked: {
      question:'解方程 3(x − 2) = 12，寫出步驟。',
      working:['3x − 6 = 12','3x = 12 + 6 = 18'], answer:'x = 9',
      prompts:[
        '你可唔可以指住括號入面兩項，講下個 3 同佢哋各自有咩關係？',
        '由 3x − 6 = 12 去到你寫嘅呢一步，你喺左右兩邊做咗咩？',
        '你由 3x = 18 得到 x = 9。可唔可以將 9 代返入上一行，講下你點核對？'
      ]
    }
  };
  const paperId = new URLSearchParams(location.search).get('paper') === 'marked' ? 'marked' : 'expand';
  const paper = papers[paperId];
  const lines = [...paper.working.map((text,index)=>({field:'working',index,text})),
                 {field:'answer',index:0,text:paper.answer}];
  const emptyDraft = () => ({revision:0,text:'',hasAudio:false,duration:0});
  const one = request => new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  let opened;
  function database() {
    if (!opened) opened=new Promise((resolve,reject)=>{
      const request=indexedDB.open('eduflow:voice-trial:v1',1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        db.createObjectStore('turns',{keyPath:'id'}).createIndex('paper','paper');
        db.createObjectStore('audio');
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('此瀏覽器未能儲存試用紀錄。請檢查網站的儲存權限後重試。'));
    }).catch(error=>{opened=null;throw error;});
    return opened;
  }
  async function transaction(mode,operation) {
    const db=await database(), tx=db.transaction(['turns','audio'],mode);
    const done=new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onabort=()=>reject(Error('未能儲存，請檢查瀏覽器空間後重試。'));
    });
    try {
      const value=await operation(tx.objectStore('turns'),tx.objectStore('audio'));
      await done;return value;
    } catch (error) {
      try{tx.abort();}catch{}
      await done.catch(()=>{});
      throw error;
    }
  }
  function check(ok,message){if(!ok)throw Error(message);}
  function short(value,max){return typeof value==='string' && value.trim().length<=max ? value.trim() : '';}
  function selected(payload){
    const line=lines.find(row=>row.field===payload.field && row.index===payload.index && row.text===payload.quote);
    check(line,'所選作答已更改，請重新選擇。');return line;
  }
  function makeTurn(line,prompt,id,parentId=null){
    return {id,paper:paperId,attempt:'demo-'+paperId,question:'q1',number:1,title:'中一數學 · 一元一次方程',
      questionText:paper.question,field:line.field,index:line.index,quote:line.text,prompt,status:'asked',
      revision:1,answerText:'',hasAudio:false,duration:0,feedback:'',parentId,created:Date.now()};
  }
  function visible(row,role){
    const {draft,lastReply,lastReview,paper:unused,...turn}=row;
    if(role==='student' && turn.status==='asked')turn.draft=draft||emptyDraft();
    return turn;
  }
  async function recording(blob){
    if(!blob)return null;
    check(blob instanceof Blob && blob.size>0 && blob.size<=12*1024*1024,'請選擇 12 MB 以內的錄音。');
    const Decoder=window.OfflineAudioContext || window.webkitOfflineAudioContext;
    check(Decoder,'此瀏覽器未能讀取錄音長度，可改用文字回應。');
    const bytes=await blob.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    let decoded;
    try { decoded=await new Decoder(1,1,16000).decodeAudioData(bytes); }
    catch { throw Error('未能讀取這段錄音。請試用 WAV、MP3 或重新錄音。'); }
    const duration=decoded.duration;
    check(duration>=.25 && duration<=120,'錄音須介乎 0.25 至 120 秒。');
    return {duration,key:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')};
  }
  function adapter(role){
    function handoff(turns){
      if(role!==(location.hash==='#student'?'student':'teacher'))return;
      $('student-empty').hidden=role!=='student'||turns.length>0;
      const link=$('role-next').firstElementChild;
      const next=turns.length && (role==='teacher'&&turns.at(-1).status==='asked'?'student':
        role==='student'&&turns.at(-1).status!=='asked'?'teacher':'');
      $('role-next').hidden=!next;
      if(next){link.href='#'+next;link.textContent=next==='student'?'切換到學生視角回答':'切換到教師視角跟進';}
    }
    function response(row){return {turn:visible(row,role)};}
    async function load(){
      const rows=await transaction('readonly',store=>one(store.index('paper').getAll(paperId)));
      const turns=rows.sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id)).map(row=>visible(row,role));
      handoff(turns);
      return role==='teacher'?{released:true,lines,turns}:{turns};
    }
    async function send(body){
      const line=selected(body),prompt=short(body.prompt,400);
      check(prompt && /^[0-9a-f-]{32,36}$/i.test(body.requestId),'請先填寫追問。');
      return transaction('readwrite',async store=>{
        const before=await one(store.get(body.requestId));
        if(before){
          check(before.paper===paperId && before.quote===line.text && before.prompt===prompt,'這次發送的內容已更改。');
          return response(before);
        }
        const existing=await one(store.index('paper').getAll(paperId));
        check(!existing.some(turn=>turn.status!=='reviewed'),'這道題已有待處理的追問，請先跟進該輪。');
        const row=makeTurn(line,prompt,body.requestId);
        await one(store.add(row));return response(row);
      });
    }
    async function studentWrite(body,submit){
      const text=typeof body.text==='string'?body.text.trim():'';
      check(text.length<=2000,'文字回應最多 2,000 字。');
      const media=await recording(body.audio);
      const signature=JSON.stringify([body.revision,body.draftRevision??0,text,media?.key||'',!!body.removeAudio]);
      return transaction('readwrite',async(store,audio)=>{
        const row=await one(store.get(body.id));
        check(row?.paper===paperId,'找不到這個追問。');
        if(submit && row.lastReply===signature)return response(row);
        const draft=row.draft||emptyDraft();
        check(row.status==='asked' && row.revision===body.revision,'這輪追問已更新，請重新載入。');
        check((body.draftRevision??0)===draft.revision,'草稿已在另一分頁更新，請重新載入。');
        const hasAudio=!!media||(!body.removeAudio&&draft.hasAudio);
        const duration=media?.duration||(hasAudio?draft.duration:0);
        const draftKey='draft:'+row.id;
        if(submit){
          check(text||hasAudio,'請先錄音或輸入你的解釋。');
          if(hasAudio){
            const file=body.audio||await one(audio.get(draftKey));
            check(file instanceof Blob,'未能載入草稿錄音，請重新錄音。');await one(audio.put(file,row.id));
          }
          row.revision++;row.status='answered';row.answerText=text;row.hasAudio=hasAudio;
          row.duration=duration;row.lastReply=signature;delete row.draft;await one(audio.delete(draftKey));
        }else{
          if(media)await one(audio.put(body.audio,draftKey));
          else if(body.removeAudio)await one(audio.delete(draftKey));
          row.draft={revision:draft.revision+1,text,hasAudio,duration};
        }
        await one(store.put(row));return response(row);
      });
    }
    async function review(body){
      const feedback=short(body.feedback,1000), nextPrompt=short(body.nextPrompt,400);
      const signature=JSON.stringify([body.revision,feedback,nextPrompt]);
      return transaction('readwrite',async store=>{
        const row=await one(store.get(body.id));
        check(row?.paper===paperId,'找不到這個追問。');
        if(row.lastReview?.signature===signature){
          const next=row.lastReview.next?await one(store.get(row.lastReview.next)):null;
          return {...response(row),next:next&&visible(next,role)};
        }
        check(row.status==='answered'&&row.revision===body.revision,'這輪追問已更新，請重新載入。');
        row.revision++;row.status='reviewed';row.feedback=feedback;
        const next=nextPrompt?makeTurn({field:row.field,index:row.index,text:row.quote},nextPrompt,crypto.randomUUID().replaceAll('-',''),row.id):null;
        row.lastReview={signature,next:next?.id||null};
        await one(store.put(row));if(next)await one(store.add(next));
        return {...response(row),next:next&&visible(next,role)};
      });
    }
    async function audio(id,options={}){
      return transaction('readonly',async (store,files)=>{
        const row=await one(store.get(id));
        const draft=options.draft===true;
        check(row?.paper===paperId&&(draft?role==='student'&&row.draft?.hasAudio:row.hasAudio),'找不到這段錄音。');
        const blob=await one(files.get(draft?'draft:'+id:id));check(blob instanceof Blob,'找不到這段錄音。');return blob;
      });
    }
    const after=fn=>async body=>{
      const result=await fn(body);handoff([result.next||result.turn]);return result;
    };
    if(role==='student')return {load,audio,respond:after(body=>studentWrite(body,body.action!=='draft'))};
    return {load,audio,send:after(send),review:after(review),suggest:async body=>{
      const line=selected(body);return {prompt:paper.prompts[lines.indexOf(line)],source:'guided'};
    }};
  }

  const $=id=>document.getElementById(id);
  $('question').textContent=paper.question;
  for(const {text} of lines){const item=document.createElement('li');item.textContent=text;$('workings').append(item);}
  if(paperId==='marked'){$('back-link').href='marking-demo.html';$('back-link').textContent='返回這份示例答卷';}
  let role,instance;
  function show(){
    const next=location.hash==='#student'?'student':'teacher';
    if(next===role)return;
    if(instance?.isDirty?.()&&!confirm('有未儲存的內容。要捨棄並切換身分嗎？')){
      history.replaceState(null,'','#'+role);return;
    }
    instance?.destroy();role=next;$('student-empty').hidden=$('role-next').hidden=true;
    for(const name of ['student','teacher']){
      const link=$(name+'-role');
      if(role===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    if(paperId==='marked')$('back-link').href='marking-demo.html#'+(next==='student'?'student-review':'teacher-marking');
    instance=EduVoiceFollowup.mount($('voice-panel'),{role,adapter:adapter(role)});
  }
  window.addEventListener('hashchange',show);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && instance && !instance.isDirty())instance.refresh();
  });
  window.addEventListener('pagehide',()=>instance?.destroy());
  window.addEventListener('pageshow',event=>{if(event.persisted){role=null;instance=null;show();}});
  show();
})();
