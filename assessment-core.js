(function(root){
function normalize(value){return String(value??'').normalize('NFKC').replace(/[−–—﹣]/g,'-').trim()}
const unitSuffixes=new Map([
 ["$", ["港元", "港幣", "元"]],
 ["%", ["%"]],
 ["°", ["度", "°"]],
 ["°C", ["°C", "°c", "℃", "攝氏度"]],
 ["cm", ["cm", "厘米", "公分"]],
 ["m", ["m", "米", "公尺"]],
 ["km", ["km", "千米", "公里"]],
 ["μm", ["μm", "µm", "微米"]],
 ["cm²", ["cm²", "cm^2", "cm2", "平方厘米", "平方公分"]],
 ["cm³", ["cm³", "cm^3", "cm3", "立方厘米", "立方公分"]],
 ["g/cm³", ["g/cm³", "g/cm^3", "g/cm3", "克/立方厘米"]],
 ["L", ["L", "l", "升", "公升"]],
 ["g", ["g", "克"]],
 ["min", ["min", "分鐘"]],
 ["h", ["h", "小時"]],
 ["s", ["s", "秒"]],
 ["ms", ["ms", "毫秒"]],
 ["年", ["年"]],
 ["m/s", ["m/s", "米/秒"]],
 ["km/h", ["km/h", "公里/小時"]],
 ["倍", ["倍", "×"]],
 ["人", ["人"]],
 ["張", ["張"]],
 ["枝", ["枝"]],
 ["袋", ["袋"]],
 ["粒", ["粒"]],
 ["冊", ["冊"]],
 ["本", ["本"]],
 ["個", ["個"]],
 ["單位", ["單位"]],
 ["平方單位", ["平方單位"]]
]);
function numberAnswer(value,q){
 const raw=String(value??'');
 if(raw.length>128)return {kind:'invalid'};
 let text=raw.normalize('NFC').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/[−–—﹣]/g,'-').trim();
 if(!text)return {kind:'blank'};
 const equals=text.indexOf('=');
 if(equals!==-1&&q.variable&&text.slice(0,equals).trim().toLowerCase()===q.variable.toLowerCase())text=text.slice(equals+1).trim();
 const currency=q.unit==='$'&&/^(?:HK\$|\$)/i.test(text);
 if(currency){
  text=text.replace(/^(?:HK\$|\$)\s*/i,'');
 }else if(q.unit){
  const suffix=(unitSuffixes.get(q.unit)||[]).find(u=>text.endsWith(u));
  if(suffix)text=text.slice(0,-suffix.length).trimEnd();
 }
 text=text.replace(/^\\(?:dfrac|tfrac|frac)\s*\{\s*([+-]?\d+)\s*\}\s*\{\s*([+-]?\d+)\s*\}$/,'$1/$2')
  .replace(/^\(\s*([+-]?\d+)\s*\)\s*\/\s*\(\s*([+-]?\d+)\s*\)$/,'$1/$2')
  .replace(/\s*\/\s*/g,'/');
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
