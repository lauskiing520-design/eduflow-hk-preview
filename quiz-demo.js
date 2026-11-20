(()=>{
  const quiz={title:'校園義賣百分法',questions:[
    {prompt:'班會用 240 元買了 30 個環保袋。要按每個袋的成本賺取 25%，每個應售多少元？',choices:['6 元','8 元','10 元','12 元'],answer:2,hint:'先找每個袋的成本，再辨認百分率的基數。',feedback:'每個袋成本是 240 ÷ 30 = 8 元。25% 盈利以成本為基數，所以每個售 8 × 1.25 = 10 元。'},
    {prompt:'筆記簿先加價 20%，再給八折。與原價相比，最後的售價怎樣改變？',choices:['相同','低 4%','高 4%','低 16%'],answer:1,hint:'可假設原價是 100 元，折扣按加價後的金額計算。',feedback:'100 × 1.20 × 0.80 = 96。售價是原價的 96%，即下跌 4%。兩個百分率的基數不同。'},
    {prompt:'去年有 40% 的同學參與義賣，今年有 50%。若說參與率「較去年上升了幾個百分比」，答案是哪個？',choices:['10%','20%','25%','50%'],answer:2,hint:'先計算參與率的差，再除以上年的參與率。',feedback:'參與率增加 10 個百分點；相對去年的增幅是 (50 − 40) ÷ 40 × 100% = 25%。'}
  ]};
  const key='eduflow:quiz-demo:fair:v1',restart=document.getElementById('restart'),box=document.getElementById('workspace');
  let picks={};
  try{const stored=JSON.parse(localStorage.getItem(key)||'{}');
    quiz.questions.forEach((q,i)=>{if(stored&&Number.isInteger(stored[i])&&stored[i]>=0&&stored[i]<q.choices.length)picks[i]=stored[i];});
  }catch{}
  function view(){const v=EduQuiz.localView(quiz,picks);restart.hidden=!v.complete;return v;}
  function save(){try{localStorage.setItem(key,JSON.stringify(picks));}catch{document.getElementById('notice').textContent='目前只能在這一頁體驗，重新載入後答案可能重設。';}}
  function mount(){EduQuiz.player(box,view(),async(i,c)=>{picks[i]=c;save();return view();});}
  restart.onclick=()=>{picks={};save();mount();};mount();
})();
