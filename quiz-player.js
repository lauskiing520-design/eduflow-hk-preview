window.EduQuiz=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function localView(quiz,picks){
    let score=0;
    const questions=quiz.questions.map((q,i)=>{
      const row={prompt:q.prompt,choices:q.choices,hint:q.hint};
      if(Object.hasOwn(picks,i)){Object.assign(row,{pick:picks[i],answer:q.answer,feedback:q.feedback});score+=Number(picks[i]===q.answer);}
      return row;
    });
    const answered=questions.filter(q=>Object.hasOwn(q,'pick')).length;
    return {title:quiz.title,questions,answered,score,complete:answered===questions.length};
  }
  function player(box,view,submit){
    let index=view.questions.findIndex(q=>!Object.hasOwn(q,'pick'));
    if(index<0)index=view.questions.length;
    function show(){
      if(index>=view.questions.length){
        box.innerHTML=`<section class="play"><h2>小測已完成</h2><p><strong>${view.score} / ${view.questions.length} 題答對</strong></p>
        <div class="answers">${view.questions.map((q,i)=>`<details class="score-item"><summary>第 ${i+1} 題 · ${q.pick===q.answer?'正確':'再看看'}</summary>
          <p>${esc(q.prompt)}</p><p>我的答案　${esc(q.choices[q.pick])}</p><p>正確答案　${esc(q.choices[q.answer])}</p><p>${esc(q.feedback)}</p></details>`).join('')}</div></section>`;
        return;
      }
      const q=view.questions[index], done=Object.hasOwn(q,'pick');
      box.innerHTML=`<section class="play"><p class="kicker">第 ${index+1} / ${view.questions.length} 題</p><h2>${esc(q.prompt)}</h2>
      <form><fieldset ${done?'disabled':''} aria-label="選擇答案">${q.choices.map((o,j)=>`<label class="choice"><input type="radio" required name="choice" value="${j}" ${q.pick===j?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset>
      ${!done&&q.hint?`<details><summary>我想看提示</summary><p>${esc(q.hint)}</p></details>`:''}
      ${done?`<div class="feedback" role="status"><strong>${q.pick===q.answer?'答對了':'正確答案是「'+esc(q.choices[q.answer])+'」'}</strong><p>${esc(q.feedback)}</p></div><div class="actions"><button type="button" data-next>${index===view.questions.length-1?'查看總結':'下一題'}</button></div>`:'<div class="actions"><button type="submit">確認答案</button></div>'}
      <p role="status" class="play-status"></p></form></section>`;
      box.querySelector('[data-next]')?.addEventListener('click',()=>{index++;show();});
      box.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');
        if(!button)return;
        button.disabled=true;
        try{view=await submit(index,Number(form.elements.choice.value));show();}catch(err){form.querySelector('.play-status').textContent=err.message;button.disabled=false;}
      };
    }
    show();
  }
  return {esc,player,localView};
})();
