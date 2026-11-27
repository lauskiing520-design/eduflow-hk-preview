/* The two authored scenes are read by OpenMAIC's standalone classroom player. */
(function () {
  'use strict';

  const experiment = `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}body{font:clamp(26px,2.5vw,36px)/1.4 system-ui,sans-serif;color:#16323e;background:#f5f4e9}
main{padding:3.4vh 4.6vw;min-height:100%;display:flex;flex-direction:column;justify-content:center;gap:2vh}
h1,p{margin:0}h1{font-size:clamp(44px,4.7vw,70px);line-height:1.15;letter-spacing:-.04em}
.amounts{display:grid;grid-template-columns:1fr 1fr;gap:3vw}.quote{padding:1.9vh 2vw 2.2vh;border-block:2px solid #abbab3}.quote b{font-weight:600}.quote strong{display:block;font-size:clamp(48px,6.4vw,95px);font-variant-numeric:tabular-nums;letter-spacing:-.05em}
#a{color:#075d68}#b{color:#783f19}nav{display:flex;gap:1.6vw}button{flex:1;font:inherit;font-weight:650;border:2px solid #637c78;background:#fff;color:#16323e;padding:1.5vh 0;border-radius:8px}button[aria-pressed=true]{background:#163e48;color:white}
button:focus-visible{outline:5px solid #ce5717;outline-offset:3px}output{font-weight:700;color:#173f44}small{font:inherit;color:#425b5e}
@media (max-aspect-ratio:1/1){body{font-size:58px;line-height:1.3}main{padding:3vh 4vw;gap:1.5vh;justify-content:center}.amounts{grid-template-columns:1fr;gap:1vh}.quote{display:grid;grid-template-columns:1.15fr 1fr;align-items:center;gap:0 1vw;padding:.9vh 0}.quote strong{grid-column:2;grid-row:1/3;text-align:right;font-size:100px}.quote small{font-size:48px}h1{font-size:83px}.quote b{font-size:56px}button{padding:1.1vh 0}output{font-size:56px}}
</style>
<main><h1>每本便宜，總價也便宜？</h1><p>替編委會選一個印量，比較兩張報價。</p>
<nav aria-label="印刷數量"><button data-n="60" aria-pressed="true">60 本</button><button data-n="120" aria-pressed="false">120 本</button><button data-n="180" aria-pressed="false">180 本</button></nav>
<div class="amounts"><div class="quote"><b>甲 · 每本 $8</b><strong id="a">$600</strong><small>另付 $120 起版費</small></div><div class="quote"><b>乙 · 每本 $9</b><strong id="b">$540</strong><small>免起版費</small></div></div>
<output aria-live="polite">印 60 本，乙便宜 $60。</output></main>
<script>
const buttons = Array.from(document.querySelectorAll('button'));
for (const button of buttons) button.addEventListener('click', () => {
  const n = Number(button.dataset.n);
  const a = 120 + 8 * n;
  const b = 9 * n;
  document.querySelector('#a').textContent = '$' + a.toLocaleString('en-HK');
  document.querySelector('#b').textContent = '$' + b.toLocaleString('en-HK');
  document.querySelector('output').textContent = a === b ? '印 ' + n + ' 本，兩家同價。' : '印 ' + n + ' 本，' + (a < b ? '甲' : '乙') + '便宜 $' + Math.abs(a-b) + '。';
  for(const item of buttons) item.setAttribute('aria-pressed', String(item === button));
});
<\/script></html>`;

  const questions = [
    { id:'counterexample',type:'single',question:'同學說：「甲每本較便宜，所以任何印量都應選甲。」哪一項足以推翻這個說法？',
      options:[{value:'A',label:'只比較折扣後的單價：甲 8 元、乙 9 元。'},{value:'B',label:'印 60 本，甲共 600 元，乙只收 540 元。'},{value:'C',label:'印 180 本，甲比乙便宜 60 元。'}],
      answer:['B'],analysis:'一句「任何印量」只需一個反例就能推翻。印 60 本時，甲每本省下的 1 元合共只省了 60 元，仍未抵銷 120 元起版費。',hasAnswer:true,points:1 },
    { id:'changed-fee',type:'single',question:'若甲的起版費升至 180 元，其他條件照舊。印量最少要有多少本，甲才會比乙便宜？',
      options:[{value:'A',label:'179 本'},{value:'B',label:'180 本'},{value:'C',label:'181 本'}],
      answer:['C'],analysis:'每本相差 1 元，印 180 本時剛好抵銷起版費，只是同價。要甲嚴格便宜，最少要印 181 本。',hasAnswer:true,points:1 }
  ];
  const stageId = 'eduflow-print-counterexample';
  const stage = {id:stageId,name:'校刊印刷報價 · 反例研討',style:'professional',createdAt:0,updatedAt:0};
  function scene(id, type, title, order, content) {
    return {id,stageId,type,title,order,content,actions:[],createdAt:0,updatedAt:0};
  }
  const manifest = {formatVersion:1,stage,assets:[],scenes:[
    scene('experiment','interactive','比較三個印量',0,{type:'interactive',html:experiment}),
    scene('reasoning','quiz','檢驗推論與變式',1,{type:'quiz',questions})
  ]};
  const strings = {
    previous:'上一節',next:'下一節',scenes:'課堂目錄',fullscreen:'全螢幕',exitFullscreen:'退出全螢幕',
    emptyClassroom:'未有課堂內容',unsupportedScene:'未能顯示這個場景',interactiveTitle:'比較印刷報價',interactiveMoreBelow:'向下閱讀',
    videoUnavailable:'未能播放影片',quizSubmit:'核對推論',quizRetry:'再做一次',quizScore:'得分',quizCorrect:'正確',quizIncorrect:'再想想',
    quizCorrectAnswer:'參考選項',quizExplanation:'理由',quizReferenceAnswer:'參考答案',quizNoReferenceAnswer:'未設定參考答案',
    quizAnswerPlaceholder:'寫下你的答案',quizMultipleHint:'可選多項',pblScenario:'情境',pblGoal:'目標',pblYourRole:'你的角色',
    pblCharacters:'角色',pblLearningObjective:'學習目標',pblMilestones:'進度',pblOnlineOnly:'須於網上課堂開啟',pblContinueOnline:'回到網上課堂',
    play:'播放',pause:'暫停',playbackStart:'開始課堂',playbackContinue:'繼續',captions:'字幕',discussionTitle:'討論',
    discussionContinueOnline:'回到網上討論',discussionDismiss:'關閉',linkedFilesUnavailable:'未能載入課堂檔案',scriptRequired:'請啟用 JavaScript',startFailed:'未能載入課堂'
  };
  function embed(id, data) {
    const element = document.createElement('script');
    element.type = 'application/json';
    element.id = id;
    element.textContent = JSON.stringify(data);
    document.body.append(element);
  }
  embed('openmaic-classroom',manifest);
  embed('openmaic-player-config',{strings});
})();
