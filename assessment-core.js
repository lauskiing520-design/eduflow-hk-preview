(function(root){
function normalize(value){return String(value??'').normalize('NFKC').replace(/[−–—﹣]/g,'-').trim()}
function numberAnswer(value,q){
 let text=normalize(value).replace(/\s+/g,'');
 if(!text)return {kind:'blank'};
 text=text.replace(/\\(?:dfrac|tfrac|frac)\{([+-]?\d+)\}\{([+-]?\d+)\}/g,'$1/$2').replace(/^\(([+-]?\d+)\)\/\(([+-]?\d+)\)$/,'$1/$2');
 if(q.variable){const prefix=new RegExp('^'+q.variable+'=','i');text=text.replace(prefix,'')}
 if(q.unit==='$')text=text.replace(/^(?:HK\$|\$)/i,'').replace(/(?:港元|元)$/,'');
 if(q.unit==='%')text=text.replace(/%$/,'');
 if(q.unit==='cm')text=text.replace(/(?:cm|厘米)$/i,'');
 if(q.unit==='s')text=text.replace(/(?:s|秒)$/i,'');
 if(q.unit==='°C')text=text.replace(/(?:°C|攝氏度)$/i,'');
 if(q.unit==='g/cm³')text=text.replace(/(?:g\/cm(?:\^?3)|克\/立方厘米)$/i,'');
 if(text.length>40)return {kind:'invalid'};
 let n;
 if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))n=Number(text);
 else if(/^[+-]?\d+\/[+-]?\d+$/.test(text)){const [a,b]=text.split('/').map(Number);if(!b)return {kind:'invalid'};n=a/b}
 else return {kind:'invalid'};
 return Number.isFinite(n)?{kind:'number',value:n}:{kind:'invalid'};
}
function markQuestion(q,response={}){
 const answer=String(response.answer??'');let score=null,reason='計算過程或文字答案，待教師按評分點覆核。';
 if(q.kind==='choice'){
  if(!answer.trim()){score=0;reason='未作答。'}
  else if(!q.options.includes(answer)){score=null;reason='選項格式需教師核對。'}
  else{score=answer===q.expected?1:0;reason=score?'所選答案與參考答案一致。':'所選答案與參考答案不一致。'}
 }else if(q.kind==='number'){
  const parsed=numberAnswer(answer,q);
  if(parsed.kind==='blank'){score=0;reason='答案欄未作答；如計算過程已有答案，可由教師調整。'}
  else if(parsed.kind==='invalid'){score=null;reason='答案格式未能按規則判定，請教師核對。'}
  else{score=Math.abs(parsed.value-q.expected)<=1e-9*Math.max(1,Math.abs(q.expected))?1:0;reason=score?'數值與參考答案一致。':'數值與參考答案不一致。'}
 }
 return q.criteria.map(c=>({id:c.id,max:c.max,mode:c.mode,score:c.mode==='auto'?(score===null?null:score*c.max):null,suggested:c.mode==='auto'?(score===null?null:score*c.max):null,reason:c.mode==='auto'?reason:'此評分點須由教師閱讀作答後評分。'}));
}
function totalMax(paper){return paper.questions.reduce((sum,q)=>sum+q.criteria.reduce((a,c)=>a+c.max,0),0)}
function createAttempt(paper,answers,meta={}){return {id:meta.id||String(Date.now()),paperId:paper.id,paperRevision:meta.revision||null,label:String(meta.label||'試用學生').slice(0,30),submittedAt:meta.submittedAt||new Date().toISOString(),answers:JSON.parse(JSON.stringify(answers)),marks:Object.fromEntries(paper.questions.map(q=>[q.id,markQuestion(q,answers[q.id])])),comments:{},confirmed:false}}
function stats(paper,attempt){let earned=0,gradedMax=0,pendingMax=0;for(const q of paper.questions)for(const c of q.criteria){const value=attempt.marks[q.id]?.find(m=>m.id===c.id)?.score;if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=c.max){earned+=value;gradedMax+=c.max}else pendingMax+=c.max}return {earned,gradedMax,pendingMax,total:totalMax(paper),complete:pendingMax===0}}
function reviewMark(paper,attempt,qid,cid,value){const q=paper.questions.find(q=>q.id===qid),c=q?.criteria.find(c=>c.id===cid),m=attempt.marks[qid]?.find(m=>m.id===cid);if(!c||!m)throw new Error('找不到評分點');if(value!==null&&(!Number.isInteger(value)||value<0||value>c.max))throw new Error('分數超出範圍');m.score=value;attempt.confirmed=false;delete attempt.confirmedAt;return stats(paper,attempt)}
function confirm(paper,attempt){const s=stats(paper,attempt);if(!s.complete)throw new Error('仍有待評項目，請先完成評分。');attempt.confirmed=true;attempt.confirmedAt=new Date().toISOString();return s}
function adoptSuggestions(paper,attempt,qid,result){const q=paper.questions.find(q=>q.id===qid);if(!q||!result||!Array.isArray(result.marks))return {changed:0,commentFilled:false};let changed=0;for(const suggestion of result.marks){const c=q.criteria.find(c=>c.id===suggestion.id&&c.mode==='manual'),m=attempt.marks[qid]?.find(m=>m.id===suggestion.id);if(c&&m?.score===null&&suggestion.needs_review!==true&&Number.isInteger(suggestion.score)&&suggestion.score>=0&&suggestion.score<=c.max){reviewMark(paper,attempt,qid,suggestion.id,suggestion.score);m.aiAcceptedAt=new Date().toISOString();changed++}}let commentFilled=false;if(typeof result.feedback==='string'&&result.feedback&&!String(attempt.comments?.[qid]||'').trim()){attempt.comments=attempt.comments||{};attempt.comments[qid]=result.feedback.slice(0,800);attempt.confirmed=false;delete attempt.confirmedAt;commentFilled=true}return {changed,commentFilled}}
function csvCell(value){let s=String(value??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
const api={normalize,numberAnswer,markQuestion,totalMax,createAttempt,stats,reviewMark,confirm,adoptSuggestions,csvCell};if(typeof module==='object'&&module.exports)module.exports=api;else root.AssessmentCore=api;
})(typeof window==='object'?window:globalThis);
