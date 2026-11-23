(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const students = ['示例學生 A', '示例學生 B'];
  const groups = {'1a':'中一 A 班','1b':'中一 B 班','2a':'中二 A 班','2b':'中二 B 班'};
  const params = new URLSearchParams(location.search);
  const catalogue = [...AssessmentData.papers];
  createPreviewPreflight(AssessmentData.papers).sync(p => catalogue.push(p));
  const paper = catalogue.find(p => p.id === (params.get('paper') || 's1-equations-a'));
  const group = params.get('room') || (paper?.year === '中二' ? '2a' : '1a');
  const sheets = [], byMarker = new Map();
  const rowsPerPage = 6;
  let incoming = [], isExample = false, busy = false, confirmed = false, pageCount, storageKey;

  function sheetLabel(s) { return students[s.student]+' · 第 '+s.page+' 頁'; }
  function msg(text) { $('message').textContent = text; }
  function setBusy(value) {
    busy = value;
    for (const id of ['example','choose','confirm','revise']) $(id).disabled = busy;
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
    const selected=sheets.filter(s => choice==='all'||s.student===Number(choice));
    const images=selected.map(s=>{
      const img=new Image();img.alt=sheetLabel(s);img.src=s.printImage;return img;
    });
    $('print-sheets').replaceChildren(...images);
    $('print-count').textContent=selected.length+' 張 A4 · 建議單面列印';
    $('preview').src=selected[0].printImage;
    $('caption').textContent=sheetLabel(selected[0]);
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
  function readSample() {
    try{return JSON.parse(localStorage.getItem(storageKey));}catch{return null;}
  }
  function saveSample(){
    if(!isExample)return true;
    try{localStorage.setItem(storageKey,JSON.stringify({values:incoming.map(r=>r.value),confirmed}));return true;}
    catch{return false;}
  }
  function totals() {
    const counts=new Map();
    for(const row of incoming) if(byMarker.has(row.value))counts.set(row.value,(counts.get(row.value)||0)+1);
    const duplicate=[...counts.values()].some(n=>n>1);
    return {counts,empty:incoming.filter(row=>!row.value).length,duplicate};
  }
  function updateTally(){
    const {counts,empty,duplicate}=totals();
    const ignored=incoming.filter(r=>r.value==='skip').length;
    $('tally').textContent='已配對 '+counts.size+' / '+sheets.length+' 張應收頁 · 待核對 '+empty+' 張'+(ignored?' · 略過 '+ignored+' 張':'')+
      (duplicate?'。有兩張相片指向同一頁，請保留一張。':'');
    $('confirm').disabled=busy||!counts.size||!!empty||duplicate;
    $('pages').querySelectorAll('.scan-row').forEach((row,i)=>{
      row.querySelector('small').textContent=counts.get(incoming[i].value)>1?'重複頁，請核對':row.dataset.note;
    });
  }
  function showRows(){
    const rows=incoming.map((r,i)=>{
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
      select.addEventListener('change',()=>{r.value=select.value;confirmed=false;updateTally();if(!saveSample())msg('瀏覽器未能儲存本次配對。');});
      right.append(label,select);article.append(left,right);return article;
    });
    $('pages').replaceChildren(...rows);$('review').hidden=false;$('finished').hidden=true;
    updateTally();
  }
  function summary(){
    const {counts}=totals();
    $('review').hidden=true;$('finished').hidden=false;
    $('receipt-summary').textContent='已核對 '+counts.size+' / '+sheets.length+' 張應收頁。';
    $('bundles').replaceChildren(...students.map((name,i)=>{
      const own=sheets.filter(s=>s.student===i);
      const received=own.filter(s=>counts.has(s.marker)),missing=own.filter(s=>!counts.has(s.marker));
      const li=document.createElement('li');
      li.textContent=name+' · 已收 '+received.length+' / '+own.length+' 頁'+(missing.length?' · 欠第 '+missing.map(s=>s.page).join('、')+' 頁':' · 齊頁');return li;
    }));
    $('finished-heading').focus();
  }
  async function example(){
    if(busy)return;setBusy(true);msg('正在讀取示例回收頁的二維碼…');
    try{
      const batch=[], order=sheets.slice().reverse();
      for(let i=0;i<order.length;i++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const s=order[i];batch.push(makeRow(drawSheet(s,true,i===order.length-1),'示例紙卷',sheetLabel(s)));
      }
      const prev=readSample();
      if(prev?.values?.length===batch.length)batch.forEach((r,i)=>{
        const v=prev.values[i];
        if(v==='skip'||v===''||(byMarker.has(v)&&(!r.match||r.match===v)))r.value=v;
      });
      incoming=batch;isExample=true;setBusy(false);const t=totals();
      confirmed=!!prev?.confirmed&&!!t.counts.size&&!t.empty&&!t.duplicate;
      msg('已讀取 '+batch.length+' 張示例頁。');
      if(confirmed)summary();else{showRows();$('review-heading').focus();}
    }catch{setBusy(false);if(incoming.length)updateTally();msg('暫時未能讀取示例，請再試一次。');}
  }
  async function photos(files){
    if(busy||!files.length)return;
    if(files.length>sheets.length*2||files.some(f=>!['image/png','image/jpeg'].includes(f.type)||f.size>20*1024*1024)){
      msg('請選取最多 '+(sheets.length*2)+' 張 JPG 或 PNG 相片，每張上限 20 MB。');return;
    }
    setBusy(true);const batch=[];
    try{
      for(const [i,f] of files.entries()){
        msg('正在讀取第 '+(i+1)+' / '+files.length+' 張相片…');
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const url=URL.createObjectURL(f),img=new Image();
        try{img.src=url;await img.decode();batch.push(makeRow(pageImage(img),f.name));}finally{URL.revokeObjectURL(url);}
      }
      incoming=batch;isExample=false;confirmed=false;setBusy(false);showRows();msg('相片已在這個分頁讀取。');$('review-heading').focus();
    }catch{setBusy(false);if(incoming.length)updateTally();msg('其中一張相片無法讀取。請重新選擇可開啟的 JPG 或 PNG。');}
  }
  async function start(){
    if(!paper||!Object.hasOwn(groups,group)||!groups[group].startsWith(paper.year))throw Error();
    pageCount=Math.ceil(paper.questions.length/rowsPerPage);
    const version=[group,paper.id,...paper.questions.map(q=>q.prompt)].join('|');
    const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).slice(0,12).map(n=>n.toString(16).padStart(2,'0')).join('');
    for(let i=0;i<students.length;i++){
      $('pupil').add(new Option(students[i],String(i)));
      for(let page=1;page<=pageCount;page++){
        const marker='EDUTRIAL:'+await digest(version+'|'+i+'|'+page);
        const s={student:i,page,marker,first:(page-1)*rowsPerPage+1,last:Math.min(paper.questions.length,page*rowsPerPage)};
        s.printImage=drawSheet(s).toDataURL('image/png');sheets.push(s);byMarker.set(marker,s);
      }
    }
    storageKey='eduflow-hk-preview:paper-receipt:v1:'+sheets[0].marker;
    $('context').textContent=groups[group]+' · '+paper.title+' · 兩位虛構學生';
    if(params.has('paper')&&params.has('room')){
      $('back').href='assessment.html#sample-homework/'+group+'/'+encodeURIComponent(paper.id);$('back').textContent='返回派卷記錄';
    }
    if(readSample())$('example').textContent='繼續核對示例頁';
    $('tools').hidden=false;updatePrint();
    $('pupil').addEventListener('change',updatePrint);
    $('print').addEventListener('click',async()=>{await Promise.all([...$('print-sheets').children].map(img=>img.decode()));window.print();});
    $('example').addEventListener('click',example);
    $('choose').addEventListener('click',()=>$('images').click());
    $('images').addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';photos(files);});
    $('confirm').addEventListener('click',()=>{
      const t=totals();if(!t.counts.size||t.empty||t.duplicate)return;
      confirmed=true;msg(isExample?(saveSample()?'示例收件記錄已存於此瀏覽器。':'示例收件已確認，瀏覽器未能儲存記錄。'):'相片核對結果只保留在目前分頁。');summary();
    });
    $('revise').addEventListener('click',()=>{confirmed=false;saveSample();showRows();msg('可重新核對頁面。');$('review-heading').focus();});
  }
  start().catch(()=>{$('context').textContent='未能準備這份答題紙。請返回學校試用，重新打開紙卷示例。';});
})();
