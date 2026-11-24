(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));

  function edit(root, paper, changes, save) {
    const q = paper.questions[changes.index];
    if (!q || !['text', 'number'].includes(q.kind)) throw new Error('這題請在建卷編輯器核對。');
    const dialog = document.createElement('dialog');
    dialog.className = 'verify-edit-dialog';
    dialog.setAttribute('aria-labelledby', 'verify-edit-title');
    const field = (name, label, value, max, rows) =>
      '<label>'+esc(label)+'<textarea name="'+name+'" required rows="'+rows+'" maxlength="'+max+'">'+esc(value)+'</textarea></label>';
    dialog.innerHTML = '<form><h2 id="verify-edit-title">修訂第 '+(changes.index+1)+' 題</h2>'+
      field('prompt','題目',changes.prompt,2500,2)+field('reference','參考答案',changes.referenceAnswer,3500,2)+
      (q.kind==='number'?'<label>答案單位<input name="unit" maxlength="16" value="'+esc(q.unit)+'" placeholder="無單位可留空"></label>':'')+
      '<div class="verify-edit-actions"><button class="button" type="button" data-edit-check>重新驗算</button></div>'+
      '<div data-edit-result role="status"></div>'+
      field('solution','參考解法',q.solution,3500,2)+
      '<fieldset><legend>評分準則</legend>'+q.criteria.map((c,i)=>
        field('criterion-'+i,'評分點 '+(i+1)+'（'+c.max+' 分）',c.label,500,2)).join('')+'</fieldset>'+
      '<p class="field-note">核對解法和評分點後保存。數值題會以這裏的答案作正式評分。</p>'+
      '<p role="status" data-edit-status></p><div class="verify-edit-actions"><button class="button" type="button" data-edit-close>取消</button>'+
      '<button class="button primary" type="submit">保存本題到修訂卷</button></div></form>';
    root.append(dialog);
    const form=dialog.querySelector('form'), fields=form.elements;
    const result=dialog.querySelector('[data-edit-result]'), status=dialog.querySelector('[data-edit-status]');
    const value = name => fields.namedItem(name).value.trim();
    let confirmedDifference='';
    const check = () => {
      const current = {...q, prompt:value('prompt'), referenceAnswer:value('reference'), solution:value('solution')};
      if(q.kind==='number') current.unit=value('unit');
      const calculation=EduAnswerVerification.check(current,paper);
      result.innerHTML=EduAnswerVerification.resultHTML(calculation);
      return calculation;
    };
    form.addEventListener('input', e => {
      if(['prompt','reference','solution','unit'].includes(e.target.name)) {
        result.textContent='內容已更改，可重新驗算。';
        confirmedDifference='';
        status.textContent='';
        form.querySelector('[type=submit]').textContent='保存本題到修訂卷';
      }
    });
    dialog.querySelector('[data-edit-check]').addEventListener('click',check);
    check();
    let saving=false, saved=false, complete;
    const completion=new Promise(resolve=>{complete=resolve;});
    dialog.addEventListener('cancel', e=>{if(saving)e.preventDefault();});
    dialog.querySelector('[data-edit-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{dialog.remove();complete(saved);},{once:true});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(saving)return;
      const calculation=check();
      const signature=JSON.stringify([value('prompt'),value('reference'),value('solution'),fields.unit?.value]);
      if(['mismatch','invalid'].includes(calculation.status) && confirmedDifference!==signature){
        confirmedDifference=signature;
        status.textContent='這次驗算需要核對。你可以修改答案再驗算，或保留自己的答案繼續。';
        form.querySelector('[type=submit]').textContent='仍保存這次修訂';
        result.tabIndex=-1;
        result.focus();
        return;
      }
      const update={slot:changes.index+1,prompt:value('prompt'),referenceAnswer:value('reference'),
        solution:value('solution'),labels:q.criteria.map((_,i)=>value('criterion-'+i))};
      if(q.kind==='number') update.unit=value('unit');
      saving=true;
      for(const input of form.elements)input.disabled=true;
      status.textContent='正在保存本題…';
      try {
        await save(update);
        saved=true;
        if(dialog.open)dialog.close();
      } catch(error) {
        status.textContent=error.message;
      } finally {
        saving=false;
        for(const input of form.elements)input.disabled=false;
      }
    });
    dialog.showModal();
    return completion;
  }

  function builderCheck(button, form) {
    const section=button.closest('.custom-question');
    const get=k=>section.querySelector('[data-field="'+k+'"]').value;
    const paper={year:form.elements.year.value.trim(),subject:form.elements.subject.value.trim()};
    const question={prompt:get('prompt'),solution:get('solution'),topic:get('topic'),kind:'text'};
    if(get('reference').trim())question.referenceAnswer=get('reference').trim();
    section.querySelector('[data-builder-answer-result]').innerHTML=
      EduAnswerVerification.resultHTML(EduAnswerVerification.check(question,paper));
  }

  window.EduVerificationEditor={edit,builderCheck};
})();
