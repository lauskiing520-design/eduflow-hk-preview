/* Adapt the native OpenMAIC v1.5.0 InteractiveScene and QuizScene without replacing their renderer. */
(function(){
  'use strict';
  const engine=window.EduScienceInquiry,origin=location.origin;
  const channel='eduflow-science-v1',nonce=new URL(location.href).searchParams.get('channel');
  const root=document.getElementById('openmaic-player');
  let started=false;
  function strings(practice,readonly){
    return {
      previous:'上一節',next:'下一節',scenes:'課堂目錄',fullscreen:'全螢幕',exitFullscreen:'退出全螢幕',
      emptyClassroom:'未有課堂內容',unsupportedScene:'無法顯示這個場景',interactiveTitle:'比較各翼長的下落時間',interactiveMoreBelow:'向下閱讀',
      videoUnavailable:'未能播放影片',quizSubmit:practice||readonly?'核對數據題':'記錄這節的選項',quizRetry:'再做一次',quizScore:'得分',quizCorrect:'正確',quizIncorrect:'再想想',
      quizCorrectAnswer:'參考選項',quizExplanation:'數據依據',quizReferenceAnswer:'參考答案',quizNoReferenceAnswer:'未設定參考答案',
      quizAnswerPlaceholder:'寫下你的答案',quizMultipleHint:'可選多項',pblScenario:'情境',pblGoal:'目標',pblYourRole:'你的角色',
      pblCharacters:'角色',pblLearningObjective:'學習目標',pblMilestones:'進度',pblOnlineOnly:'須在網上課堂開啟',pblContinueOnline:'回到課堂',
      play:'播放',pause:'暫停',playbackStart:'進入實驗',playbackContinue:'繼續',captions:'字幕',discussionTitle:'討論',
      discussionContinueOnline:'回到網上討論',discussionDismiss:'關閉',linkedFilesUnavailable:'未能載入課堂檔案',scriptRequired:'請啟用 JavaScript',startFailed:'未能載入課堂'
    };
  }
  // This function is serialized into the player's opaque, sandboxed srcdoc.
  // Only checked numerical readings enter the document. Its port carries view controls.
  function setupLab(rows,sourceName,focus,firstView,hostOrigin,token){
    const $=id=>document.getElementById(id),format=value=>value.toFixed(2);
    let view={...firstView},start=0;
    const scale=rows.flatMap(r=>r.times),lo=Math.min(...scale),hi=Math.max(...scale);
    const gap=Math.max((hi-lo)*.12,.02),min=Math.max(0,lo-gap),max=hi+gap;
    const coordinate=value=>(4+92*(value-min)/(max-min))+'%';
    const port=new MessageChannel();
    port.port1.onmessage=event=>{if(event.data?.view){view=event.data.view;draw();}};
    window.parent.postMessage({channel:'eduflow-science-v1',nonce:token,type:'lab'},hostOrigin,[port.port2]);
    $('provenance').textContent=sourceName;
    $('focusCopy').textContent=focus;
    function tag(type,text,cls){
      const e=document.createElement(type);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;
    }
    function draw(){
      const count=view.round,chart=$('observations');
      chart.replaceChildren();
      for(const row of rows.slice(start,start+3)){
        const times=row.times.slice(0,count);
        const line=tag('div',null,'observation'),rowhead=tag('div',null,'rowhead');
        rowhead.append(tag('b',row.length+' cm'),tag('span',times.map(format).join('　')+' 秒'));
        line.append(rowhead);
        const graph=tag('div',null,'track');
        graph.setAttribute('aria-hidden','true');
        const range=tag('i',null,'range');
        const left=Math.min(...times),right=Math.max(...times);
        range.style.left=coordinate(left);range.style.width=(92*(right-left)/(max-min))+'%';
        graph.append(range);
        times.forEach((n,i)=>{
          const mark=tag('i',null,'mark mark'+i);mark.style.left=coordinate(n);graph.append(mark);
        });
        line.append(graph);
        if(view.showMeans){
          const cents=times.reduce((sum,n)=>sum+Math.round(100*n),0);
          const mean=Math.round(cents/count)/100;
          const diamond=tag('i',null,'mean');diamond.style.left=coordinate(cents/count/100);graph.append(diamond);
          line.append(tag('div','平均 '+format(mean)+' 秒','avg'));
        }
        chart.append(line);
      }
      const axis=$('ticks');axis.replaceChildren();
      for(let i=0;i<=4;i++){
        const tick=tag('span',format(min+(max-min)*i/4));
        tick.style.left=(4+92*i/4)+'%';axis.append(tick);
      }
      $('summary').textContent='每組顯示 '+count+' 次讀數'+(view.showMeans?'，◆ 是這些讀數的平均值。':'。');
      $('average').setAttribute('aria-pressed',String(view.showMeans));
      for(const b of document.querySelectorAll('[data-round]'))b.setAttribute('aria-pressed',String(Number(b.dataset.round)===count));
      $('more').hidden=rows.length<=3;$('prev').disabled=start===0;$('next').disabled=start+3>=rows.length;
      $('pages').textContent=(start+1)+'–'+Math.min(start+3,rows.length)+'／'+rows.length+' 組';
    }
    function change(next){view=next;draw();port.port1.postMessage({view});}
    document.querySelectorAll('[data-round]').forEach(b=>{b.onclick=()=>change({...view,round:Number(b.dataset.round)});});
    $('average').onclick=()=>change({...view,showMeans:!view.showMeans});
    $('prev').onclick=()=>{start=Math.max(0,start-3);draw();};
    $('next').onclick=()=>{if(start+3<rows.length)start+=3;draw();};
    draw();
  }
  function labHtml(course,view,token){
    const args=[course.rows,course.origin==='teacher'?'教師提供讀數':'示例讀數',engine.guidance(course),view,origin,token];
    const boot='('+setupLab.toString()+')(...'+JSON.stringify(args).replace(/</g,'\\u003c')+');';
    return `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
    *{box-sizing:border-box}body{margin:0;background:#faf8ee;color:#172d34;font:clamp(21px,2vw,34px)/1.36 system-ui,sans-serif}
    main{padding:2.8vh 4vw;max-width:1600px;margin:auto}header{display:flex;align-items:center;gap:3vw;border-bottom:3px solid #24454d;padding-bottom:1.6vh}
    h1{font-size:clamp(38px,4vw,70px);line-height:1.12;letter-spacing:-.04em;margin:.1em 0}p{margin:.2em 0}
    header svg{width:8vw;max-height:12vh;flex:none}#provenance,#span,.avg,#summary{color:#35565b}
    nav{display:flex;align-items:center;gap:1vw;flex-wrap:wrap;margin:1.6vh 0}button{font:inherit;font-weight:630;color:#183e45;background:#fff;border:2px solid #879e96;border-radius:5px;padding:.25em .7em}
    [aria-pressed=true]{background:#164d51;color:white;border-color:#164d51}button:focus-visible{outline:4px solid #b84915;outline-offset:2px}
    .observation{margin:.7vh 0;padding-bottom:.7vh;border-bottom:1px solid #d3dbd4}.rowhead{display:flex;justify-content:space-between;align-items:baseline;gap:1vw}
    .rowhead b{color:#164d51;font-size:1.14em}.rowhead span,.avg{font-variant-numeric:tabular-nums}
    .track{position:relative;height:1.32em;margin:.28em 0;background:repeating-linear-gradient(to right,#dee4db 0 1px,transparent 1px 10%);border-bottom:2px solid #a3b1a5}
    .mark,.range,.mean{position:absolute;top:57%}.mark{width:.52em;height:.52em;border-radius:50%;background:#176964;transform:translate(-50%,-50%);outline:2px solid #faf8ee}
    .mark1{top:42%;background:#4f7d45}.mark2{top:69%;background:#284e74}.mean{width:.46em;height:.46em;top:12%;background:#a05222;transform:translate(-50%,-50%)rotate(45deg)}
    .range{height:2px;background:#4b685b}.avg{font-size:.85em;text-align:right;line-height:1}
    .caption{display:flex;gap:1em;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:.22em 0;font-size:.82em}#more{margin:0}#more[hidden]{display:none}
    #ticks{position:relative;color:#33535b;height:1.4em;font:700 .78em/1.2 system-ui}#ticks span{position:absolute;transform:translateX(-50%)}
    details{font-size:.85em;color:#274d50}summary{width:fit-content;cursor:pointer;text-decoration:underline;text-underline-offset:.18em}
    @media(min-aspect-ratio:1/1){body{font-size:clamp(20px,1.7vw,28px)}main{padding:1.6vh 4vw}header{padding-bottom:.7vh}
    h1{font-size:clamp(34px,3.3vw,54px)}nav{margin:1.1vh 0}.observation{position:relative;margin:.3vh 0;padding:.25vh 0}
    .track{margin:.3em 0 .2em}.avg{position:absolute;right:0;top:0}.rowhead{justify-content:flex-start;gap:2.5vw}.rowhead b{min-width:4.6em}}
    @media(max-aspect-ratio:1/1){body{font-size:clamp(43px,4.3vw,62px)}main{padding:1.5vh 4vw}h1{font-size:1.3em}header svg{width:12vw}button{padding:.3em .45em}.observation{margin:.4vh 0}.track{height:.85em}nav{gap:1.2vw}.caption{font-size:.79em}}
    </style><main><header>
    <svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="#245958" stroke-width="3"><path fill="#d0e6da" d="M49 44 L10 15 L18 9 L58 35 Z"/><path fill="#eeb574" d="M53 39 L83 9 L92 15 L63 48 Z"/><path d="M52 43 L64 47 L55 86 L46 82 Z"/><path stroke-dasharray="4 5" d="M20 39 C1 60 28 75 53 69 M76 62 L76 86 M70 78 L76 87 L82 78"/></svg>
    <div><span id="provenance"></span><h1>哪一組留在空中較久？</h1><details><summary>老師的探究提示</summary><p id="focusCopy"></p></details></div></header>
    <nav aria-label="顯示讀數"><button data-round="1">第 1 次</button><button data-round="2">首 2 次</button><button data-round="3">全部 3 次</button><button id="average">顯示平均</button></nav>
    <p id="summary" aria-live="polite"></p><div class="caption"><strong>下落時間（秒）</strong>
    <nav id="more" aria-label="其他翼長"><button id="prev">上一組</button><span id="pages"></span><button id="next">下一組</button></nav></div>
    <div id="ticks" aria-hidden="true"></div><div id="observations"></div>
    </main><script>${boot}<\/script></html>`;
  }
  function embed(id,data){
    const node=document.createElement('script');node.type='application/json';node.id=id;node.textContent=JSON.stringify(data);document.body.append(node);
  }
  function launch(config){
    const course=engine.project(config.course),questions=engine.questions(course),key=config.key;
    const practice=Boolean(config.practice),readonly=Boolean(config.readonly),sandboxed=Boolean(nonce);
    const ids=new Map(questions.map(q=>[q.id,new Set(q.options.map(o=>o.value))]));
    const choices={...config.choices},initialView=engine.initial().view;
    const validView=v=>v&&[1,2,3].includes(v.round)&&typeof v.showMeans==='boolean';
    let view=validView(config.view)?config.view:initialView;
    function post(type,payload){if(sandboxed&&!readonly)parent.postMessage({channel,nonce,type,...payload},origin);}
    let port;
    window.addEventListener('message',event=>{
      const frame=root.querySelector('iframe[sandbox]');
      if(!frame||event.source!==frame.contentWindow||event.origin!=='null'||event.data?.channel!==channel||
        event.data.nonce!==key||event.data.type!=='lab'||event.ports.length!==1)return;
      port?.close();port=event.ports[0];port.postMessage({view});
      const source=frame.contentWindow;
      port.onmessage=e=>{
        if(root.querySelector('iframe[sandbox]')?.contentWindow!==source||!validView(e.data?.view))return;
        view={round:e.data.view.round,showMeans:e.data.view.showMeans};
        post('view',{view});
      };
    });
    const stageId='eduflow-paper-rotor';
    const scene=(id,type,title,order,content)=>({id,stageId,type,title,order,content,actions:[],createdAt:0,updatedAt:0});
    embed('openmaic-classroom',{formatVersion:1,stage:{id:stageId,name:course.title,style:'professional',createdAt:0,updatedAt:0},assets:[],scenes:[
      scene('science-readings','interactive','查看實驗記錄',0,{type:'interactive',html:labHtml(course,view,key)}),
      scene('science-evidence','quiz','用讀數判斷證據',1,{type:'quiz',questions})
    ]});
    embed('openmaic-player-config',{strings:strings(practice,readonly)});
    if(readonly||Object.keys(choices).length)history.replaceState(null,'','#scene-2');

    // The upstream QuizScene exposes React radio inputs and no persistence callback.
    // Capture their native choice events and replay the same clicks once per mounted scene.
    let restoring=false,lastQuiz=null;
    function restore(){
      const quiz=root.querySelector('[data-testid="quiz"]');
      if(!quiz){lastQuiz=null;return;}
      if(quiz===lastQuiz)return;
      lastQuiz=quiz;restoring=true;
      try{
        for(const input of quiz.querySelectorAll('input[type=radio]')){
          if(choices[input.name]===input.value&&!input.checked)input.click();
        }
        if(readonly)quiz.querySelector('[data-testid="quiz-submit"]')?.click();
      }finally{restoring=false;}
    }
    new MutationObserver(restore).observe(root,{childList:true,subtree:true});
    root.addEventListener('change',e=>{
      const x=e.target;
      if(!restoring&&!readonly&&x.matches?.('[data-testid="quiz"] input[type=radio]')&&ids.get(x.name)?.has(x.value)){
        choices[x.name]=x.value;post('choices',{choices:{...choices}});
      }
    },true);
    root.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button||restoring||!button.closest('[data-testid="quiz"]'))return;
      if(readonly){e.preventDefault();e.stopImmediatePropagation();return;}
      if(!practice&&button.dataset.testid==='quiz-submit'){
        e.preventDefault();e.stopImmediatePropagation();
        let note=document.getElementById('evidence-note');
        if(!note){note=document.createElement('p');note.id='evidence-note';note.setAttribute('role','status');button.parentElement.after(note);}
        note.textContent=Object.keys(choices).length===questions.length?'已記錄本節全部選項。回到課堂下方交回作答。':'已記錄目前選項，尚有題目未作答。';
      }else if(practice&&button.textContent.trim()==='再做一次'){
        Object.keys(choices).forEach(k=>delete choices[k]);post('choices',{choices:{}});
      }
    },true);
    if(readonly){
      const css=document.createElement('style');
      css.textContent='[data-testid="quiz"] button{display:none}';
      document.head.append(css);
    }
    const bundle=document.createElement('script');
    bundle.src='vendor/openmaic/player.v1.5.0.min.js';
    bundle.onerror=()=>{root.textContent='課堂播放器未能載入，請重新開啟活動。';};document.body.append(bundle);
  }
  if(parent===window){
    launch({course:engine.create(),view:engine.initial().view,choices:{},practice:true,readonly:false,key:crypto.randomUUID()});
  }else if(/^[\da-f-]{36}$/i.test(nonce||'')){
    window.addEventListener('message',function initialize(e){
      const m=e.data;
      if(started||e.source!==parent||e.origin!==origin||m?.channel!==channel||m.nonce!==nonce||m.type!=='start')return;
      started=true;window.removeEventListener('message',initialize);
      try{launch({...m,key:crypto.randomUUID()});}catch(_){root.textContent='未能讀取這節課的實驗資料，請重新開啟。';}
    });
    parent.postMessage({channel,nonce,type:'ready'},origin);
  }else root.textContent='請從學生課室開啟這節課。';
})();
