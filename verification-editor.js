(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));

  function edit(root, paper, changes, save, suggestEnglish) {
    const q = paper.questions[changes.index];
    if (!q || !['text', 'number'].includes(q.kind)) throw new Error('這題請在建卷編輯器核對。');
    const dialog = document.createElement('dialog');
    dialog.className = 'verify-edit-dialog';
    dialog.setAttribute('aria-labelledby', 'verify-edit-title');
    const field = (name, label, value, max, rows, required=true) =>
      '<label>'+esc(label)+'<textarea name="'+name+'"'+(required?' required':'')+' rows="'+rows+'" maxlength="'+max+'">'+esc(value)+'</textarea></label>';
    const language = window.EduFlowMathsLanguage;
    const reviewed = language.entry(paper,q);
    const previous = q.teacherEnglish || reviewed;
    const showEnglish = changes.editEnglish || (previous && (q.prompt!==changes.prompt || !reviewed));
    dialog.innerHTML = '<form><h2 id="verify-edit-title">修訂第 '+(changes.index+1)+' 題</h2>'+
      field('prompt','題目',changes.prompt,2500,2)+field('reference','參考答案',changes.referenceAnswer,3500,2)+
      (q.kind==='number'?'<label>答案單位<input name="unit" maxlength="16" value="'+esc(q.unit)+'" placeholder="無單位可留空"></label>':'')+
      '<div class="verify-edit-actions"><button class="button" type="button" data-edit-check>重新驗算</button></div>'+
      '<div data-edit-result role="status"></div>'+
      field('solution','參考解法',q.solution,3500,2)+
      '<fieldset><legend>評分準則</legend>'+q.criteria.map((c,i)=>
        field('criterion-'+i,'評分點 '+(i+1)+'（'+c.max+' 分）',c.label,500,2)).join('')+'</fieldset>'+
      '<details data-edit-english'+(showEnglish?' open':'')+'><summary>英文題面、解法及評分點<span data-english-pending></span></summary>'+
      (suggestEnglish?'<button type="button" class="button" data-suggest-english>AI 擬英文草稿</button><p role="status" data-suggest-status></p>':'')+
      field('en-prompt','英文題目（學生可見）',previous?.prompt,2500,2,false)+
      field('en-solution','英文解法（教師用）',previous?.solution,3500,2,false)+
      q.criteria.map((c,i)=>field('en-criterion-'+i,'英文評分點 '+(i+1)+'（'+c.max+' 分）',previous?.criteria?.[c.id],500,2,false)).join('')+
      '<label class="translation-confirm"><input type="checkbox" name="englishReviewed">英譯已核對，可供學生作答</label>'+
      '<p class="field-note" data-english-status role="status"></p></details>'+
      '<p class="field-note">核對解法和評分點後保存。數值題會以這裏的答案作正式評分。</p>'+
      '<p role="status" data-edit-status></p><div class="verify-edit-actions"><button class="button" type="button" data-edit-close>取消</button>'+
      '<button class="button primary" type="submit">保存本題到修訂卷</button></div></form>';
    root.append(dialog);
    const form=dialog.querySelector('form'), fields=form.elements;
    const result=dialog.querySelector('[data-edit-result]'), status=dialog.querySelector('[data-edit-status]');
    const value = name => fields.namedItem(name).value.trim();
    const englishFields = Array.from(form.querySelectorAll('textarea[name^="en-"]'));
    const approved = fields.namedItem('englishReviewed');
    approved.checked = Boolean(reviewed && changes.prompt===q.prompt && changes.referenceAnswer===EduAnswerVerification.reference(q));
    const updateEnglishStatus = () => {
      dialog.querySelector('[data-english-pending]').textContent =
        !approved.checked && (previous || englishFields.some(input=>input.value.trim())) ? '（待核對）' : '';
      dialog.querySelector('[data-english-status]').textContent = approved.checked ?
        '保存後可切換英文題面。' : '待核對的英譯可隨修訂卷保存，學生會看到中文題面。';
      for (const input of englishFields) input.required=approved.checked;
    };
    updateEnglishStatus();
    const suggestButton=dialog.querySelector('[data-suggest-english]');
    let editVersion=0;
    if(suggestButton) suggestButton.addEventListener('click',async()=>{
      const version=editVersion, feedback=dialog.querySelector('[data-suggest-status]');
      suggestButton.disabled=true;
      feedback.textContent='正在草擬英譯…';
      try {
        const proposal=await suggestEnglish({requestId:crypto.randomUUID(),prompt:value('prompt'),solution:value('solution'),
          labels:q.criteria.map((_,i)=>value('criterion-'+i))});
        if(!dialog.open || form.querySelector('[type=submit]').disabled)return;
        if(version!==editVersion){feedback.textContent='你已修改內容。如需根據最新內容草擬，請再按一次。';return;}
        const en=proposal?.english;
        if(typeof en?.prompt!=='string' || typeof en.solution!=='string' || !Array.isArray(en.labels) ||
          en.labels.length!==q.criteria.length || !en.labels.every(label=>typeof label==='string'))throw Error('英譯未齊，請重試或手動填寫。');
        englishFields.forEach((input,i)=>{input.value=[en.prompt,en.solution,...en.labels][i]});
        approved.checked=false;
        updateEnglishStatus();
        feedback.textContent='英文草稿已填入，請對照中文逐項核對。';
      } catch(error) {feedback.textContent=error.message || '未能取得英譯，仍可手動填寫。';}
      finally {suggestButton.disabled=false;}
    });
    if(changes.editEnglish) queueMicrotask(()=>fields.namedItem('en-prompt').focus());
    let confirmedDifference='';
    const check = () => {
      const current = {...q, prompt:value('prompt'), referenceAnswer:value('reference'), solution:value('solution')};
      if(q.kind==='number') current.unit=value('unit');
      const calculation=EduAnswerVerification.check(current,paper);
      result.innerHTML=EduAnswerVerification.resultHTML(calculation);
      return calculation;
    };
    form.addEventListener('input', e => {
      editVersion++;
      if (e.target.name && e.target!==approved) approved.checked=false;
      updateEnglishStatus();
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
      if(previous || englishFields.some(input=>input.value.trim()) || approved.checked) {
        update.english = {reviewed:approved.checked,prompt:value('en-prompt'),solution:value('en-solution'),
          labels:q.criteria.map((_,i)=>value('en-criterion-'+i))};
      }
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
