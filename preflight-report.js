(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric = value => value == null ? '未能判定' : esc(value);
  const side = i => i === 0 ? 'A' : 'B';

  function renderReport(report) {
    const compared = report.papers.length === 2;
    const role = i => i === 0 ? '本卷' : '對照卷';
    const questionName = ref => (compared ? role(ref.side==='A'?0:1)+'・' : '')+'第 '+ref.number+' 題';
    function summary(p, i) {
      const label = compared ? '<span class="pf-side">'+role(i)+'</span>' : '';
      return '<article>'+label+'<h3>'+esc(p.title || '未命名試卷')+'</h3><dl>'+
        [['題數',p.questionCount],['總分',p.marks],['方法評分點',p.steps]].map(([k,v]) =>
          '<div><dt>'+k+'</dt><dd>'+metric(v)+'</dd></div>').join('')+'</dl></article>';
    }
    function topicCell(t) {
      if (!t) return '<td>0 題</td>';
      return '<td>'+metric(t.questions)+' 題 · '+metric(t.marks)+' 分<br><small>方法評分點 '+metric(t.steps)+'</small></td>';
    }
    const topics = compared ? report.comparison.topics : report.papers[0].topics.map(t => ({topic:t.topic,a:t}));
    const warnings = report.warnings.map(w => '<li><strong>'+esc(w.message)+'</strong>'+
      (w.refs?.length ? '<div>'+w.refs.map(ref => '<button type="button" class="pf-ref" data-pf-ref="'+esc(ref.side)+'-'+esc(ref.number)+'">'+esc(questionName(ref))+'</button>').join(' ')+'</div>' : '')+'</li>').join('');
    const ledger = report.papers.map((p,i) => '<div>'+(compared?'<h3>'+esc(role(i)+' · '+p.title)+'</h3>':'')+
      p.questions.map(q => '<details data-pf-question="'+side(i)+'-'+esc(q.number)+'"><summary><b>第 '+esc(q.number)+' 題</b> '+esc(q.topic || '未標示考點')+' · '+metric(q.marks)+' 分</summary><p>'+esc(q.prompt)+'</p><p>方法評分點 '+metric(q.steps)+'</p>'+
        (q.geometry?.status && q.geometry.status!=='none' ? '<p>'+esc(q.geometry.note)+'</p>' : '')+'</details>').join('')+'</div>').join('');
    return '<div class="pf-report"><div class="pf-stats">'+report.papers.map(summary).join('')+'</div>'+
      '<section class="pf-section"><h2>待核對項目 <small>'+report.warnings.length+'</small></h2>'+
      (warnings ? '<ul class="pf-warnings">'+warnings+'</ul>' : '<p>目前的規則檢查未發現差異。</p>')+'</section>'+
      '<section class="pf-section"><h2>考點與配分</h2><p>方法評分點按評分準則列明的推理、列式或探究項目計算。</p>'+
      '<div class="pf-table"><table><thead><tr><th scope="col">考點</th><th scope="col">本卷</th>'+(compared?'<th scope="col">對照卷</th>':'')+'</tr></thead><tbody>'+
      topics.map(t=>'<tr><th scope="row">'+esc(t.topic || '未標示考點')+'</th>'+topicCell(t.a)+(compared?topicCell(t.b):'')+'</tr>').join('')+'</tbody></table></div></section>'+
      '<section class="pf-section"><h2>逐題核對</h2><div class="pf-ledger">'+ledger+'</div></section></div>';
  }

  function jump(root, ref) {
    const target = [...root.querySelectorAll('[data-pf-question]')].find(e => e.dataset.pfQuestion === ref);
    if (!target) return;
    target.open = true;
    target.querySelector('summary')?.focus();
  }

  window.EduFlowPreflightReport={renderReport,jump};
})();
