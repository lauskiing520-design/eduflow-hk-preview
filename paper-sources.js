(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function link(url, label) {
    if (typeof url !== 'string' || !url.startsWith('https://')) return esc(label);
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  }
  function credit(paper) {
    if (paper.variantOf || paper.bankAssembled) {
      const notices = new Map();
      for (const q of paper.questions) {
        const source = q.source;
        if (source?.type !== 'adapted') continue;
        const notice = q.sourceNotice || source.rights || `${source.author}，《${source.title}》。EduFlow HK 選譯並另編解法與評分點。`;
        const license = source.license ? ' '+link(source.licenseUrl, source.license) : '';
        notices.set(notice + license, `<p class="field-note paper-credit">${esc(notice)}${license}</p>`);
      }
      return [...notices.values()].join('');
    }
    const source = paper.questions.find(q => q.source?.type === 'adapted')?.source;
    if (!source) return '';
    const notice = paper.attribution || source.rights ||
      `${source.author}，《${source.title}》。EduFlow HK 選譯並另編解法與評分點。`;
    const license = source.license ? ' '+link(source.licenseUrl, source.license) : '';
    return `<p class="field-note paper-credit">${esc(notice)}${license}</p>`;
  }
  function locator(question) {
    const source = question.source;
    if (source?.type === 'original' && source.dataReference) {
      return '<small class="field-note">'+link(source.dataReference, '數據來源 · '+source.dataTitle)+'</small>';
    }
    if (source?.type !== 'adapted' || !source.reference) return '';
    const parts = [source.book ? '冊 '+source.book : '', source.exercise ? '練習 '+source.exercise : '',
                   source.item ? (typeof source.item === 'number' ? '第 '+source.item+' 題' : source.item) : ''].filter(Boolean);
    const license = source.license ? ' · '+link(source.licenseUrl, source.license) : '';
    return '<small class="field-note">'+link(source.reference, '原題出處 · '+(parts.join(' · ') || source.title))+
      (source.author ? ' · '+esc(source.author) : '')+license+'</small>';
  }
  window.EduFlowSources = {credit, locator};
})();
