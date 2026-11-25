/* Teacher dispatch form shared by the workspace and the fictional preview. */
(() => {
  'use strict';
  function fields(members, esc, saved = null) {
    if (!members.length) return '<p class="field-note">選擇班級後即可指定收件學生。</p>';
    const individual = Array.isArray(saved) && saved.length < members.length;
    const pupils = members.map(s => `<label><input type="checkbox" name="recipient" value="${esc(s.id)}" ${individual && saved.includes(s.id) ? 'checked' : ''}> ${esc(s.label)}</label>`).join('');
    return `<fieldset class="dispatch-recipients"><legend>派發對象</legend>
      <label class="answer-label">範圍<select name="recipientScope"><option value="all">全班（${members.length} 人）</option><option value="selected" ${individual ? 'selected' : ''}>指定學生</option></select></label>
      <div data-recipient-picker ${individual ? '' : 'hidden'}><div class="class-member-list">${pupils}</div><p aria-live="polite" data-recipient-count>已選 ${individual ? saved.length : 0} 人</p></div></fieldset>`;
  }
  function sync(form) {
    const scope = form.elements.recipientScope;
    if (!scope) return;
    const selected = scope.value === 'selected';
    const count = form.querySelectorAll('[name="recipient"]:checked').length;
    form.querySelector('[data-recipient-picker]').hidden = !selected;
    form.querySelector('[data-recipient-count]').textContent = '已選 ' + count + ' 人';
    scope.setCustomValidity(selected && !count ? '請最少選一名收件學生。' : '');
  }
  function selected(form) {
    return form.elements.recipientScope?.value === 'selected'
      ? Array.from(form.querySelectorAll('[name="recipient"]:checked'), el => el.value)
      : null;
  }
  document.addEventListener('change', e => {
    if (e.target.matches('[name="recipientScope"], [name="recipient"]')) sync(e.target.form);
  });
  window.EduFlowClassRecipients = {fields, sync, selected};
})();
