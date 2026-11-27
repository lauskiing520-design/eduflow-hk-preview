/* Ground classroom questions in the published paper-helicopter measurements. */
(function(root){
  'use strict';
  const lab=typeof module==='object'&&module.exports?require('./science-investigation.js'):root.EduScienceInquiry;
  const numberWord='(?:[0-9]+(?:\\.[0-9]+)?|[零〇一二兩两三四五六七八九十百]+(?:[點点][零〇一二兩两三四五六七八九]+)?)';
  const cm='(?:厘米|公分|cm|公釐|毫米|mm|公尺|米|m)';
  const digits='零一二三四五六七八九';
  const normalize=q=>q.normalize('NFKC').toLowerCase().replace(/公厘/g,'毫米');
  const num=v=>{
    if (/^\d/.test(v))return Number(v);
    const [whole,decimals]=v.replace(/[〇]/g,'零').replace(/[兩两]/g,'二').split(/[點点]/);
    let total=0,n=0;
    for(const ch of whole){
      if(ch==='十'||ch==='百'){total+=(n||1)*(ch==='十'?10:100);n=0;}
      else n=n*10+digits.indexOf(ch);
    }
    return total+n+(decimals?Number('0.'+[...decimals].map(d=>digits.indexOf(d)).join('')):0);
  };
  const fmt=value=>value.toFixed(2);
  const lengths=rows=>rows.map(row=>row.length+' 厘米').join('、');
  const dataLine=row=>row.length+' 厘米組是 '+row.times.map(fmt).join('、')+' 秒';
  const asCents=x=>Math.round(x*100);
  function references(q,rows){
    const explicit=[],rounds=[],unknown=[];
    function include(x){if(!explicit.includes(x))explicit.push(x);}
    const units=new RegExp('(-?'+numberWord+'(?:\\s*(?:、|和|與|与|同|及|跟|vs\\.?|and|&)\\s*-?'+numberWord+')*)\\s*('+cm+')(?![a-z])','g');
    for(const m of q.matchAll(units)){
      const factor=/^(?:mm|毫米|公釐)$/.test(m[2])?0.1:/^(?:m|米|公尺)$/.test(m[2])?100:1;
      for(const atom of m[1].matchAll(new RegExp('(-?)('+numberWord+')','g')))include(Number(((atom[1]?-1:1)*num(atom[2])*factor).toFixed(6)));
    }
    for(const m of q.matchAll(new RegExp('(?:翼[長长]|wing\\s*length)\\s*(?:係|是|[為为]|=)?\\s*(-?)('+numberWord+')(?![\\d.])(\\s*'+cm+')?','g'))){
      // An explicit unit was already converted above.
      if(!m[3])include((m[1]?-1:1)*num(m[2]));
    }
    for(const m of q.matchAll(new RegExp('第\\s*('+numberWord+')\\s*([次輪轮組组題题])','g'))){
      const n=num(m[1]);
      if(/[組组]/.test(m[2])){
        if(Number.isInteger(n)&&n>=1&&n<=rows.length)include(rows[n-1].length);
        else unknown.push('第 '+n+' 組');
      }else if(!/[題题]/.test(m[2]))rounds.push(n);
    }
    return {explicit,rounds:[...new Set(rounds)],unknown};
  }
  const patterns=[
    ['cause',/因果|[造导導]致|造成|[归歸][因咎]|[证證]明|[結结][論论]|影響|影响|所[以致].*[翼長长]|只因|一定|保[證证]|所有.*[直升機机]|caus|prove|conclu|always/],
    ['control',/公平|控制|[保維维]持.*相同|同一高度|放手|[釋释]放|紙[材質质]|纸[材质]|配重|fair|control/],
    ['overlap',/重[疊叠迭]|交[疊叠集叉]|相[交接]|有共同|overlap/],
    ['spread',/[稳穩]|[极極全]距|[範范]圍|范围|波[動动幅]|[離离]散|分[散佈布]|齊整|相差|差[異异]大|差距|一致|range|spread|stable|consistent/],
    ['outlier',/[離离][群羣]|異常|异常|[删刪剔]|[丟丢]掉|扔掉|[唔不]要.*[數数]|outlier/],
    ['trend',/[趋趨][勢势]|越[長长短快慢]|愈[長长短快慢]|[递遞][增減减]|上升|下降|[負负正]相[關关]|方向|最[慢快久]|最耐|pattern|trend/],
    ['mean',/平均|[总總]和|除以三|mean\b|average/],
    ['repeat',/[重複重复]{2}|做三次|量三次|測三次|测三次|試三次|一次.*[夠够]|誤差|误差|repeat|reliab/],
    ['read',/讀數|读数|幾多秒|多少秒|用了多久|下落時間|下落时间|測到|测到|reading|trial/]
  ];
  const allowed=new Set(patterns.map(x=>x[0]));
  function requestedIntent(q){
    if(/唔明|[听聽睇看]不懂|沒聽懂|没听懂|不知[道点點].*開始|唔知.*入手/.test(q)&&
      !patterns.some(([,p])=>p.test(q)))return 'read';
    if(/三次|同一組|同一组/.test(q)&&/唔同|不同|不一樣|不一样/.test(q)&&!/平均/.test(q))return 'repeat';
    // A single unusual result is a question about whether to discard a measurement.
    if(/離群|离群|[删刪剔]|outlier/.test(q))return 'outlier';
    return patterns.find(([,pattern])=>pattern.test(q))?.[0];
  }
  function prepare(spec,{question,view,previous,submitted=false,interpretation}={}){
    if(typeof question!=='string'||!question.trim()||question.length>400)throw Error('請輸入 1 至 400 字的課堂問題。');
    const course=lab.validate(spec),rows=lab.summarize(course),q=normalize(question.trim()),handed=submitted===true;
    const prev=previous?.reply||previous||{},previousLengths=Array.isArray(prev.citations)?
      prev.citations.map(c=>c?.length).filter(v=>rows.some(r=>r.length===v)):[];
    const {explicit,rounds,unknown}=references(q,rows);
    const requested=explicit.map(n=>rows.find(r=>r.length===n));
    const fallback=rows.find(r=>r.length===view?.length)||rows.find(r=>r.length===course.focusLength)||rows[0];
    const other=/另[一兩两]?([個个]?[組组]|[种種])|另一排|其[他餘余].*[組组]|next group|other group/.test(q);
    const follow=other||/[嗰那這这]([一個个]?)[組组]|[剛刚][才才剛刚]|[然跟]後呢|然后呢|why is that/.test(q)||/^(為甚麼|為什麼|為何|點解|为什么|為咩|why)[呀啊呢嗎吗\s?!？]*$/.test(q);
    let selected=requested.filter(Boolean);
    if(!selected.length&&follow&&previousLengths.length){
      if(other){
        const base=rows.findIndex(x=>x.length===previousLengths.at(-1));
        const rotated=rows.slice(base+1).concat(rows.slice(0,base+1));
        selected=[rotated.find(x=>!previousLengths.includes(x.length))||rotated[0]];
      }else selected=rows.filter(x=>previousLengths.includes(x.length));
    }
    if(!selected.length)selected=[fallback];
    let intent=requestedIntent(q)||(follow&&allowed.has(prev.intent)?prev.intent:undefined);
    const nativeQuestion=q.match(new RegExp('第\\s*('+numberWord+')\\s*[題题]'));
    const itemIntent=nativeQuestion&&['control','mean','trend','overlap','cause'][num(nativeQuestion[1])-1];
    const askingKey=/答案|正[確确][選选][項项]|[揀拣選选]\s*(?:[邊边哪乜咩]|[abcd](?:\b|[呀啊嗎吗]))|[abcd]\s*(?:定|還是|还是|or)\s*[abcd]|直接[答告]|answer\s*key|correct (?:option|choice)|(?:the|right) answer/.test(q);
    intent=intent||itemIntent;
    const weakRead=!intent&&(rounds.length>0||explicit.length>0);
    const missing=explicit.filter((n,i)=>!requested[i]).map(n=>n+' 厘米');
    if(rounds.some(n=>!Number.isInteger(n)||n<1||n>3))unknown.push('指定試次');
    if(nativeQuestion&&!itemIntent)unknown.push('指定題號');
    const interpretable=!missing.length&&!unknown.length&&!intent&&!askingKey;
    if(interpretable&&allowed.has(interpretation?.intent))intent=interpretation.intent;
    if(!intent&&weakRead)intent='read';
    if(missing.length||unknown.length||!intent||(askingKey&&!handed)){
      const unavailable=missing.length||unknown.length, key=askingKey&&!handed&&!unavailable;
      const intentName=key?'answerKey':'clarify';
      let text='這節課有 '+lengths(rows)+' 的下落紀錄。你想讀某次時間、比較兩組差異，還是檢查實驗條件？';
      if(key)text='先說出你正在比較的翼長，或寫出卡住的一步。我可以陪你讀數、檢查算法，再由你決定選項。';
      if(unavailable)text='這份紀錄找不到'+[...missing,...unknown].join('、')+'。表中有 '+lengths(rows)+'，每組各量三次。';
      const followUp='例如：'+fallback.length+' 厘米組的三次讀數為甚麼不同？';
      return {intent:intentName,submitted:handed,interpretable,allowedIntents:interpretable?[...allowed]:[],
        facts:[],moves:[{id:'clarify',text,citations:[],followUp}]};
    }
    const specific=explicit.length>0||follow,group=selected[0];
    const pair=selected.slice(0,2);
    if(pair.length===1){
      const index=rows.indexOf(pair[0]);pair.push(rows[index===rows.length-1?index-1:index+1]);
    }
    const round=rounds.length===1?rounds[0]:3;
    const make=(id,text,groupRows,followUp,round=3,trial)=>({id,text,followUp,
      citations:groupRows.map(row=>({length:row.length,round,times:row.times.slice(),...(trial?{trial}:{})}))});
    const [a,b]=pair,associated=selected.length>1?selected:pair;
    const rawPair=pair.map(dataLine).join('；')+'。';
    const bounds=r=>[Math.min(...r.times),Math.max(...r.times)];
    const width=r=>asCents(r.max)-asCents(r.min);
    const asksAboutMean=q.includes('平均')||q.includes('average');
    let moves;
    switch(intent){
      case 'mean':{
        const show=(r)=>handed?'('+r.times.map(fmt).join(' + ')+') ÷ 3 ≈ '+fmt(r.mean)+' 秒。':dataLine(r)+'。先把同一行三個時間相加，再除以實際量度的次數。';
        moves=[make('observe',selected.map(r=>(handed?r.length+' 厘米組：':'')+show(r)).join(' '),selected,'若只保留最長的一次，你算到的數會怎樣改變？'),
          make('method','先圈出 '+lengths(selected)+' 的紀錄。各組分開計算，把三次時間列入同一個分子，計算到最後才四捨五入至 0.01 秒。'+
            (handed?'依次得到 '+selected.map(r=>fmt(r.mean)).join('、')+' 秒。':''),selected,'為甚麼分母用量度次數？')];
        break;
      }
      case 'read':{
        const chosen=rounds.length?rounds:[Number.isInteger(view?.round)&&view.round>=1&&view.round<=3?view.round:1];
        const text=selected.map(r=>r.length+' 厘米組'+chosen.map(i=>'第 '+i+' 次 '+fmt(r.times[i-1])+' 秒').join('、')).join('；')+'。';
        const lastRound=Math.max(...chosen),trial=chosen.length===1?chosen[0]:undefined;
        moves=[make('observe',text,selected,'換看同一組的另一次，數值有甚麼變化？',lastRound,trial),
          make('method','按翼長找到要讀的行，再沿該行看試次。'+text,selected,'為甚麼比較時要先看清橫軸的單位？',lastRound,trial)];
        break;
      }
      case 'spread':{
        const candidates=specific?selected:rows;
        const least=Math.min(...candidates.map(width)),winners=candidates.filter(r=>width(r)===least);
        const pre='穩定程度可以比較同一組三次的全距，即最長時間減最短時間。';
        const result=!handed?'先為每組算一次全距，再找較小的一個。':
          candidates.length===1?lengths(winners)+' 這組的全距為 '+fmt(least/100)+' 秒。你想和哪一組比較？':
          '在'+(specific?'比較的組別':'全部 '+rows.length+' 組')+'之中，'+lengths(winners)+' 的全距最小（'+fmt(least/100)+' 秒）'+(winners.length>1?'，是並列。':'。');
        moves=[make('observe',rawPair+pre+result,pair,'一組落得較慢，是否代表它的三次時間也較接近？'),
          make('method',pre+result,handed?winners.slice(0,2):pair,'若只比較這兩組的平均，你會漏掉甚麼？')];
        break;
      }
      case 'overlap':{
        const common=Math.max(a.min,b.min)<=Math.min(a.max,b.max);
        const result=handed?'按目前讀數，這兩段'+(common?'有共同部分。':'沒有共同部分。'):'留意兩段有沒有碰到同一個秒數，端點也要計入。';
        moves=[make('observe',rawPair+'把每組最短和最長的點連起來。'+result,pair,'你能指出一個共同秒數，或者兩段之間的空隙嗎？'),
          make('method',pair.map(r=>r.length+' 厘米由 '+bounds(r).map(fmt).join(' 至 ')+' 秒').join('；')+'。'+result,pair,'如果平均不同，但部分量度十分接近，應怎樣形容它們？')];
        break;
      }
      case 'trend':{
        const seq=explicit.length>1?associated:rows,ranked=[...seq].sort((x,y)=>x.length-y.length);
        const signs=ranked.slice(1).map((r,i)=>Math.sign(asCents(r.mean)-asCents(ranked[i].mean)));
        const trend=signs.every(v=>v===1)?'平均逐組上升':signs.every(v=>v===-1)?'平均逐組下降':signs.every(v=>v===0)?'各組平均相同':'平均沒有全程逐組增加或逐組減少';
        const result=handed?'按翼長排序，'+ranked.map(r=>fmt(r.mean)).join('、')+' 秒；'+trend+'。':'把翼長由短至長排好，逐對比較相鄰兩組的三次平均。只比較兩端會漏看中間的變化。';
        moves=[make('observe',result,handed?ranked:pair,'若有一對相鄰平均相同，可以說每一級都嚴格增加嗎？'),
          make('method','先把翼長和平均下落時間分成兩欄。'+result,handed?ranked:pair,'哪兩個相鄰翼長最能檢驗你的說法？')];
        break;
      }
      case 'outlier':{
        moves=[make('observe',dataLine(group)+'。先保留三次紀錄，再查當次是否提前放手、碰到桌面或計時有誤。未記錄的情況不能當作發生過。',[group],'你會在實驗簿補記甚麼，讓其他組判斷該次量度？'),
          make('method','把可疑時間標記起來，再按相同條件重做一次。用不同標記保留新舊讀數，看看你的解釋會否改變。',[group],'有甚麼實驗證據支持重做那一次？')];
        break;
      }
      case 'cause':
      case 'control':{
        const prompt=asksAboutMean?'平均值顯示這幾次測到了甚麼。表中沒有記錄兩組怎樣放手，所以平均值本身不能分開翼長與放手方式的影響。':'這份表記錄了翼長和下落時間。要把差異歸因於翼長，還需要知道兩組做實驗的條件。';
        moves=[make('observe',rawPair+prompt,pair,'如果一組由更高的位置放手，你會如何重新比較？'),
          make('method','草擬兩次試驗，只改一項條件。分別寫下你會改甚麼、量甚麼，以及怎樣讓放手的位置每次一樣。'+(handed?'紙材、總質量及放手方式也值得核對。':''),pair,'要用甚麼紀錄說服另一組，你控制了這項條件？')];
        break;
      }
      default:
        moves=[make('observe',dataLine(group)+'。同一翼長也可以量到不同時間。把第一次與其後兩次放在一起，比較只用一點會漏看甚麼。',[group],'若再量一次，應記下甚麼才方便與這三次比較？'),
          make('method','先用紙遮住第二、第三次讀數，寫下第一次給你的印象，再打開其餘兩次檢查。保留每次紀錄，才能看出組內差異。',[group],'三次讀數都一樣時，還有哪種誤差可能一直存在？')];
    }
    const cited=new Set(moves.flatMap(move=>move.citations.map(c=>c.length)));
    return {intent,submitted:handed,interpretable:interpretable&&!interpretation,allowedIntents:interpretable&&!interpretation?[...allowed]:[],
      facts:rows.filter(r=>cited.has(r.length)).map(r=>({length:r.length,times:r.times.slice()})),moves};
  }
  function guided(context,moveId){
    const move=context.moves.find(m=>m.id===moveId)||context.moves[0];
    return {text:move.text,citations:move.citations.map(c=>({...c,times:c.times.slice()})),followUp:move.followUp,intent:context.intent};
  }
  const api={prepare,guided};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EduScienceDiscussion=api;
})(globalThis);
