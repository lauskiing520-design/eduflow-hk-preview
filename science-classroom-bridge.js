/* Mount one local OpenMAIC classroom and carry only the student's evidence choices. */
(function (scope) {
  'use strict';
  const playerUrl=new URL('openmaic-science.html',document.currentScript.src);
  const channel='eduflow-science-v1';
  function mount(host,{data,answers,readonly=false,practice=false,onChange=()=>{}}){
    const course=scope.EduScienceInquiry.project(data);
    const questions=scope.EduScienceInquiry.questions(course);
    const initial=scope.EduScienceInquiry.initial();
    const nonce=scope.crypto.randomUUID();
    const frame=document.createElement('iframe');
    const url=new URL(playerUrl);url.searchParams.set('channel',nonce);
    frame.title='OpenMAIC 科學課堂：紙直升機的下落時間';
    frame.allow='fullscreen';frame.referrerPolicy='no-referrer';
    frame.style.cssText='display:block;width:100%;height:clamp(570px,76vh,840px);border:1px solid #cbd7d1;border-radius:6px;background:#fff';
    const cleanChoices=raw=>{
      const result={};
      for(const q of questions)if(q.options.some(o=>o.value===raw?.[q.id]))result[q.id]=raw[q.id];
      return result;
    };
    const cleanView=view=>view&&[1,2,3].includes(view.round)&&typeof view.showMeans==='boolean'
      ?{round:view.round,showMeans:view.showMeans}:null;
    let choices=cleanChoices(answers?.choices),view=cleanView(answers?.view)||initial.view,disposed=false;
    let received=false; const origin=url.origin;
    function receive(event){
      const msg=event.data;
      if(disposed||event.source!==frame.contentWindow||event.origin!==origin||
         !msg||msg.channel!==channel||msg.nonce!==nonce)return;
      if(msg.type==='ready'){
        frame.contentWindow.postMessage({channel,nonce,type:'start',course,choices,view,readonly,practice},origin);
        received=true;
      }else if(received&&!readonly&&msg.type==='choices'){
        choices=cleanChoices(msg.choices);onChange({choices:{...choices}});
      }else if(received&&!readonly&&msg.type==='view'){
        const next=cleanView(msg.view);
        if(next){view=next;onChange({view:{...next}});}
      }
    }
    scope.addEventListener('message',receive);
    let wasAttached=host.isConnected;
    const observer=new MutationObserver(()=>{
      if(frame.isConnected)wasAttached=true;
      else if(wasAttached)destroy();
    });
    observer.observe(document,{childList:true,subtree:true});
    function destroy(){
      if(disposed)return;
      disposed=true;observer.disconnect();scope.removeEventListener('message',receive);frame.remove();
    }
    frame.src=url.href;host.replaceChildren(frame);
    return {destroy};
  }
  scope.EduScienceClassroom=Object.freeze({mount});
})(window);
