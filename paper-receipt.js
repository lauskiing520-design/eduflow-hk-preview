(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const students = ['示例學生 A', '示例學生 B'];
  const groups = {'1a':'中一 A 班','1b':'中一 B 班','2a':'中二 A 班','2b':'中二 B 班'};
  const params = new URLSearchParams(location.search);
  const catalogue = [...AssessmentData.papers];
  const preflight = createPreviewPreflight(AssessmentData.papers);
  window.syncPreviewSources(createPreviewQuestionBank(AssessmentData.papers),preflight,p=>catalogue.push(p));
  const paper = catalogue.find(p => p.id === (params.get('paper') || 's1-equations-a'));
  const group = params.get('room') || (paper?.year === '中二' ? '2a' : '1a');
  const pupilNumbers=params.has('pupils')?params.get('pupils').split(','):null;
  const sheets = [], byMarker = new Map();
  const rowsPerPage = 6;
  let batches = [], busy = false, pageCount, storageKey, savedText, previousValues = null, photoSession = null;
  const current = () => batches.at(-1);
  const sampleOnly = () => batches.length > 0 && batches.every(b => b.example);

  function sheetLabel(s) { return students[s.student]+' · 第 '+s.page+' 頁'; }
  function msg(text) { $('message').textContent = text; }
  function setBusy(value) {
    busy = value;
    for (const id of ['example','choose','confirm','revise','cancel','skip-unknown','photo-topup','resume-photos']) $(id).disabled = busy;
    $('bundles').querySelectorAll('button').forEach(button=>button.disabled=busy);
  }
  function drawCode(ctx,s,x,y) {
    const qr = qrcode(0,'M'); qr.addData(s.marker); qr.make();
    const count = qr.getModuleCount(), step = 6;
    ctx.fillStyle = '#fff'; ctx.fillRect(x-4*step,y-4*step,(count+8)*step,(count+8)*step);
    ctx.fillStyle = '#101010';
    for (let i=0; i<count; i++) for (let j=0; j<count; j++) {
      if (qr.isDark(i,j)) ctx.fillRect(x+j*step,y+i*step,step,step);
    }
  }
  function drawSheet(s, returned=false, obscured=false) {
    const c=document.createElement('canvas'); c.width=1190; c.height=1684;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
    function line(text,x,y,size,bold=false,maxWidth=1020) {
      ctx.fillStyle='#172e40';
      ctx.font=(bold?'bold ':'')+size+'px "Microsoft JhengHei", sans-serif';
      ctx.fillText(text,x,y,maxWidth);
    }
    line('EduFlow HK  /  答題紙',70,97,28,true);
    line(paper.title,70,166,42,true,776);
    line(groups[group]+'   '+students[s.student],70,235,33);
    line('第 '+s.page+' / '+pageCount+' 頁    ·    第 '+s.first+' 至 '+s.last+' 題',70,286,27);
    drawCode(ctx,s,935,86);
    if (obscured) {
      ctx.fillStyle='#e8e6da';ctx.fillRect(902,74,240,208);
      line('標籤遮擋',944,180,29);
    }
    ctx.strokeStyle='#b8c6d0'; ctx.lineWidth=2;
    for(let q=s.first;q<=s.last;q++) {
      const top=332+(q-s.first)*206;
      line('第 '+q+' 題',70,top+38,27,true);
      ctx.beginPath(); ctx.moveTo(70,top+100);ctx.lineTo(1110,top+100);
      ctx.moveTo(70,top+167);ctx.lineTo(1110,top+167);ctx.stroke();
    }
    if(returned) line('示例回收頁',830,1599,25);
    line('EduFlow HK  ·  學校試用',70,1599,24);
    return c;
  }
  function updatePrint() {
    const choice=$('pupil').value;
    const selected=sheets.filter(s => choice==='all'||s.student===Number(choice)||s.marker===choice);
    const images=selected.map(s=>{
      const img=new Image();img.alt=sheetLabel(s);img.src=s.printImage;return img;
    });
    $('print-sheets').replaceChildren(...images);
    $('print-count').textContent=selected.length+' 張 A4 · 建議單面列印';
    $('preview').src=selected[0].printImage;
    $('caption').textContent=sheetLabel(selected[0]);
  }
  async function printSheets(){
    const images=[...$('print-sheets').children];
    try {await Promise.all(images.map(img=>img.decode()));window.print();}
    catch {msg('未能載入列印頁面，請重新選擇答題紙。');}
  }
  function pageImage(img) {
    const scale=Math.min(1,1700/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.naturalWidth*scale)); c.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0,c.width,c.height);return c;
  }
  function decode(canvas) {
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    // First read the printed header, then the whole photo for rotated or cropped sheets.
    for(const height of [Math.ceil(canvas.height*.34),canvas.height]){
      const data=ctx.getImageData(0,0,canvas.width,height);
      const code=jsQR(data.data,data.width,data.height,{inversionAttempts:'attemptBoth'});
      if(code) return code.data;
    }
    return '';
  }
  function makeRow(canvas,name,hint='') {
    const code=decode(canvas), matched=byMarker.get(code);
    const thumb=document.createElement('canvas');
    const scale=Math.min(1,720/Math.max(canvas.width,canvas.height));
    thumb.width=Math.max(1,Math.round(canvas.width*scale));thumb.height=Math.max(1,Math.round(canvas.height*scale));
    thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);
    return {name,hint,image:thumb.toDataURL('image/jpeg',.78),match:matched?.marker||'',foreign:Boolean(code&&!matched),value:matched?.marker||''};
  }
  function readSample(){
    try{
      savedText=localStorage.getItem(storageKey);
      const saved=JSON.parse(savedText);
      if(Array.isArray(saved?.batches)) return saved.batches;
      // Earlier trials stored the first batch directly.
      return Array.isArray(saved?.values)?[{sheet:null,values:saved.values,confirmed:saved.confirmed}]:[];
    }catch{return [];}
  }
  function saveSample(){
    if(!sampleOnly() || previousValues) return true;
    try{
      if(localStorage.getItem(storageKey)!==savedText){
        msg('另一個分頁已更新示例記錄。點「繼續核對示例頁」讀取最新資料。');
        return false;
      }
      const data={batches:batches.map(b=>({sheet:b.sheet,values:b.rows.map(r=>r.value),confirmed:b.confirmed}))};
      const text=JSON.stringify(data);
      localStorage.setItem(storageKey,text);savedText=text;
      $('example').textContent='繼續核對示例頁';return true;
    }catch{msg('瀏覽器未能儲存本次配對。關閉分頁後記錄可能遺失。');return false;}
  }
  function staleSample(){
    if(!sampleOnly())return false;
    try{return localStorage.getItem(storageKey)!==savedText;}catch{return false;}
  }
  function collected(list){
    const markers=new Set();
    for(const b of list) if(b.confirmed) for(const row of b.rows) if(byMarker.has(row.value))markers.add(row.value);
    return markers;
  }
  function totals(){
    const counts=new Map(), prior=collected(batches.slice(0,-1)), rows=current().rows;
    for(const row of rows) if(byMarker.has(row.value))counts.set(row.value,(counts.get(row.value)||0)+1);
    const duplicate=[...counts.entries()].some(([id,n])=>n>1||prior.has(id));
    return {counts,prior,empty:rows.filter(r=>!r.value).length,duplicate};
  }
  function updateTally(){
    const {counts,prior,empty,duplicate}=totals(), rows=current().rows;
    const ignored=rows.filter(r=>r.value==='skip').length;
    $('tally').textContent=(prior.size?'先前已確認 '+prior.size+' 頁 · ':'')+
      '本批已配對 '+counts.size+' 頁 · 待核對 '+empty+' 張'+(ignored?' · 略過 '+ignored+' 張':'')+
      (duplicate?'。有兩張相片指向同一頁，請保留一張。':'');
    $('confirm').disabled=busy||staleSample()||!counts.size||!!empty||duplicate;
    $('skip-unknown').hidden=!rows.some(r=>!r.value&&!r.match&&!r.foreign);
    $('cancel').hidden=batches.length<2 && !previousValues;
    $('cancel').textContent=previousValues?'取消更改':'取消這批補交';
    $('pages').querySelectorAll('.scan-row').forEach((node,i)=>{
      const row=rows[i];
      node.querySelector('small').textContent=prior.has(row.value)?'這一頁先前已收件，請略過重複頁':
        counts.get(row.value)>1?'重複頁，請核對':node.dataset.note;
    });
  }
  function showRows(){
    const rows=current().rows.map((r,i)=>{
      const article=document.createElement('article');article.className='scan-row';
      const left=document.createElement('div'),right=document.createElement('div'),title=document.createElement('strong');
      title.textContent='收件 '+(i+1)+' · '+r.name;left.append(title);
      const note=document.createElement('small');
      article.dataset.note=r.foreign?'二維碼不屬於本次派卷，請略過此頁':r.match?'已讀取二維碼':'未讀到二維碼，請查看頁首後配對';
      if(!r.match)note.className='attention';
      left.append(note);
      const details=document.createElement('details'),summary=document.createElement('summary'),img=new Image();
      summary.textContent='查看頁面';img.src=r.image;img.alt=r.hint||('收件第 '+(i+1)+' 張的相片');
      details.append(summary,img);
      if(r.hint){const caption=document.createElement('p');caption.textContent='頁首：'+r.hint;details.append(caption);}
      left.append(details);
      const select=document.createElement('select'),label=document.createElement('label');
      select.id='map-'+i; label.htmlFor=select.id;label.textContent='歸入答卷';
      select.add(new Option('請選擇學生及頁碼',''));
      const eligible=r.foreign?[]:r.match?[byMarker.get(r.match)]:sheets;
      for(const s of eligible)select.add(new Option(sheetLabel(s),s.marker));
      select.add(new Option('略過這一張','skip'));select.value=r.value;
      select.addEventListener('change',()=>{r.value=select.value;updateTally();saveSample();});
      right.append(label,select);article.append(left,right);return article;
    });
    $('review-heading').textContent=batches.length>1?'第 '+batches.length+' 批 · 補交頁核對':'逐頁核對';
    $('pages').replaceChildren(...rows);$('review').hidden=false;$('finished').hidden=true;
    updateTally();
  }
  function action(label,handler){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',handler);return button;
  }
  function summary(focus=true){
    const received=collected(batches);
    $('review').hidden=true;$('finished').hidden=false;
    $('receipt-summary').textContent='已核對 '+received.size+' / '+sheets.length+' 張應收頁 · 共 '+batches.length+' 批。';
    $('bundles').replaceChildren(...students.map((name,i)=>{
      const own=sheets.filter(s=>s.student===i),missing=own.filter(s=>!received.has(s.marker));
      const li=document.createElement('li'),label=document.createElement('strong');
      label.textContent=name+' · 已收 '+(own.length-missing.length)+' / '+own.length+' 頁'+(missing.length?' · 欠第 '+missing.map(s=>s.page).join('、')+' 頁':' · 齊頁');li.append(label);
      for(const s of missing){
        const row=document.createElement('div');row.className='missing-actions';
        row.append(action('補印第 '+s.page+' 頁',()=>{
          $('pupil').value=s.marker;updatePrint();printSheets();
        }));
        if(sampleOnly()) row.append(action('試收第 '+s.page+' 頁補交',()=>supplement(s)));
        li.append(row);
      }
      return li;
    }));
    $('photo-topup').hidden=received.size===sheets.length;
    if(focus)$('finished-heading').focus();
  }
  function restore(rows,stored){
    if(!Array.isArray(stored?.values)||stored.values.length!==rows.length)return false;
    for(let i=0;i<rows.length;i++){
      const row=rows[i],val=stored.values[i];
      if(val!=='' && val!=='skip' && (!byMarker.has(val)||row.foreign||(row.match&&row.match!==val)))return false;
    }
    rows.forEach((r,i)=>{r.value=stored.values[i];});return true;
  }
  async function example(focus=true){
    if(busy)return;setBusy(true);msg('正在讀取示例回收頁的二維碼…');
    try{
      const rows=[], order=sheets.slice().reverse(), saved=readSample();
      for(let i=0;i<order.length;i++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const s=order[i];rows.push(makeRow(drawSheet(s,true,i===order.length-1),'示例紙卷',sheetLabel(s)));
      }
      if(batches.some(b=>!b.example))photoSession={batches,previousValues};
      batches=[{rows,example:true,sheet:null,confirmed:false}];previousValues=null;
      $('resume-photos').hidden=!photoSession;
      for(let i=0;i<Math.min(saved.length,sheets.length+1);i++){
        const item=saved[i];
        if(i){
          const sheet=byMarker.get(item?.sheet);
          if(!current().confirmed||!sheet||collected(batches).has(sheet.marker))break;
          batches.push({rows:[makeRow(drawSheet(sheet,true),'示例補交頁',sheetLabel(sheet))],sheet:sheet.marker,example:true,confirmed:false});
        }
        if(!restore(current().rows,item))break;
        const t=totals();current().confirmed=!!item.confirmed&&!!t.counts.size&&!t.empty&&!t.duplicate;
      }
      setBusy(false);msg(saved.length?'已讀取這個瀏覽器的示例收件記錄。':'已讀取 '+rows.length+' 張示例頁。');
      if(current().confirmed)summary(focus);else{showRows();if(focus)$('review-heading').focus();}
    }catch{setBusy(false);msg('暫時未能讀取示例，請再試一次。');}
  }
  async function supplement(s){
    if(busy||!current()?.confirmed||collected(batches).has(s.marker))return;
    setBusy(true);msg('正在讀取示例補交頁的二維碼…');
    try{
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const row=makeRow(drawSheet(s,true),'示例補交頁',sheetLabel(s));
      batches.push({rows:[row],example:true,sheet:s.marker,confirmed:false});
      previousValues=null;setBusy(false);showRows();msg('請核對這一張補交頁。');
      saveSample();$('review-heading').focus();
    }catch{setBusy(false);msg('未能讀取示例補交頁，請再試一次。');}
  }
  async function photos(files){
    if(busy||!files.length)return;
    if(files.length>sheets.length*2||files.some(f=>!['image/png','image/jpeg'].includes(f.type)||f.size>20*1024*1024)){
      msg('請選取最多 '+(sheets.length*2)+' 張 JPG 或 PNG 相片，每張上限 20 MB。');return;
    }
    setBusy(true);const rows=[];
    try{
      for(const [i,f] of files.entries()){
        msg('正在讀取第 '+(i+1)+' / '+files.length+' 張相片…');
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const url=URL.createObjectURL(f),img=new Image();
        try{img.src=url;await img.decode();rows.push(makeRow(pageImage(img),f.name));}finally{URL.revokeObjectURL(url);}
      }
      // Uploaded images stay in this tab. Add more files to an unfinished photo batch.
      if(current()&&!current().confirmed&&!current().example&&previousValues){
        current().rows.forEach((r,i)=>{r.value=previousValues[i];});current().confirmed=true;
      }
      if(current()&&!current().confirmed&&current().example)batches.pop();
      if(current()&&!current().confirmed){
        if(current().rows.length+rows.length>sheets.length*2){
          setBusy(false);updateTally();msg('這批相片已達上限，請先完成目前這批收件。');return;
        }
        current().rows.push(...rows);
      }else batches.push({rows,example:false,confirmed:false});
      previousValues=null;photoSession=null;$('resume-photos').hidden=true;setBusy(false);
      showRows();msg('相片已在這個分頁讀取。');$('review-heading').focus();
    }catch{setBusy(false);if(current()&&!current().confirmed)updateTally();msg('其中一張相片無法讀取。請重新選擇可開啟的 JPG 或 PNG。');}
  }
  async function start(){
    if(!paper||!Object.hasOwn(groups,group)||!groups[group].startsWith(paper.year))throw Error();
    if(pupilNumbers){
      const limit={'1a':26,'1b':25,'2a':27,'2b':26}[group];
      if(pupilNumbers.length>limit||new Set(pupilNumbers).size!==pupilNumbers.length||
        pupilNumbers.some(n=>!/^\d{2}$/.test(n)||Number(n)<1||Number(n)>limit))throw Error();
      students.splice(0,students.length,...pupilNumbers.map(n=>'示例學生 '+n));
      $('pupil').options[0].textContent='全部已選學生（'+students.length+' 人）';
    }
    pageCount=Math.ceil(paper.questions.length/rowsPerPage);
    const version=[group,paper.id,...paper.questions.map(q=>q.prompt)].join('|');
    const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).slice(0,12).map(n=>n.toString(16).padStart(2,'0')).join('');
    for(let i=0;i<students.length;i++){
      $('pupil').add(new Option(students[i],String(i)));
      for(let page=1;page<=pageCount;page++){
        const identity=pupilNumbers?'pupil-'+pupilNumbers[i]:i;
        const marker='EDUTRIAL:'+await digest(version+'|'+identity+'|'+page);
        const s={student:i,page,marker,first:(page-1)*rowsPerPage+1,last:Math.min(paper.questions.length,page*rowsPerPage)};
        s.printImage=drawSheet(s).toDataURL('image/png');sheets.push(s);byMarker.set(marker,s);
      }
    }
    storageKey='eduflow-hk-preview:paper-receipt:v1:'+sheets[0].marker+(pupilNumbers?':'+pupilNumbers.join(','):'');
    $('context').textContent=groups[group]+' · '+paper.title+' · '+students.length+' 位虛構學生';
    if(params.has('paper')&&params.has('room')){
      $('back').href='assessment.html#sample-homework/'+group+'/'+encodeURIComponent(paper.id);$('back').textContent='返回派卷記錄';
    }
    const single=document.createElement('optgroup');single.label='指定一頁';
    for(const sheet of sheets)single.append(new Option(sheetLabel(sheet),sheet.marker));
    $('pupil').append(single);
    $('tools').hidden=false;updatePrint();
    $('pupil').addEventListener('change',updatePrint);
    $('print').addEventListener('click',printSheets);
    $('example').addEventListener('click',()=>example());
    $('resume-photos').addEventListener('click',()=>{
      if(!photoSession)return;
      ({batches,previousValues}=photoSession);photoSession=null;$('resume-photos').hidden=true;
      msg('已返回本分頁的相片收件記錄。');
      if(current().confirmed)summary();else{showRows();$('review-heading').focus();}
    });
    for(const id of ['choose','photo-topup'])$(id).addEventListener('click',()=>$('images').click());
    $('images').addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';photos(files);});
    $('skip-unknown').addEventListener('click',()=>{
      for(const row of current().rows) if(!row.value&&!row.match&&!row.foreign)row.value='skip';
      showRows();msg('未配對頁已略過。確認後可按欠頁清單補印或收取補交。');saveSample();
    });
    $('confirm').addEventListener('click',()=>{
      const t=totals();if(busy||!t.counts.size||t.empty||t.duplicate)return;
      if(staleSample()){msg('另一個分頁已更新示例記錄，請點「繼續核對示例頁」讀取最新資料。');return;}
      current().confirmed=true;previousValues=null;
      msg(sampleOnly()?'示例收件記錄已存於此瀏覽器。':'相片核對結果只保留在目前分頁。');
      saveSample();summary();
    });
    $('revise').addEventListener('click',()=>{
      previousValues=current().rows.map(r=>r.value);current().confirmed=false;showRows();
      msg('可重新核對最近一批頁面。');$('review-heading').focus();
    });
    $('cancel').addEventListener('click',()=>{
      if(previousValues){
        current().rows.forEach((r,i)=>{r.value=previousValues[i];});current().confirmed=true;previousValues=null;
      }else if(batches.length>1)batches.pop();
      else return;
      msg('已返回先前確認的收件清單。');saveSample();summary();
    });
    window.addEventListener('storage',e=>{
      if((e.key===storageKey||e.key===null)&&staleSample()){
        $('confirm').disabled=true;
        $('example').textContent='繼續核對示例頁';
        msg('另一個分頁已更新示例記錄。點「繼續核對示例頁」即可讀取。');
      }
    });
    if(readSample().length){$('example').textContent='繼續核對示例頁';await example(false);}

  }
  start().catch(()=>{$('context').textContent='未能準備這份答題紙。請返回學校試用，重新打開紙卷示例。';});
})();
