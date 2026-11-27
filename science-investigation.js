/* Repeated measurements, source-aware teaching materials and classroom marking. */
(function (root) {
  'use strict';

  const kind = 'scienceInquiryLab';
  const example = [
    {length:6, times:[1.12,1.28,1.20]},
    {length:8, times:[1.25,1.33,1.32]},
    {length:10, times:[1.39,1.52,1.44]}
  ];
  const guides = {
    repeat:'先看第一次的讀數，再加入第二、三次。只做一次會漏看哪些變化？',
    spread:'比較每組的最低與最高讀數。平均值不同的兩組，有沒有共同的時間範圍？',
    control:'兩組同學如何確保只有翼長不同？請說出一個要保持相同的條件，以及控制它的方法。'
  };
  const ids=['control','mean','trend','overlap','claim'];
  const letters='ABCD';
  const obj=x=>x!==null && typeof x==='object' && !Array.isArray(x);
  const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const cents=x=>Math.round(x*100);
  const seconds=x=>x.toFixed(2);
  function measured(n,limit){
    return typeof n==='number' && n>0 && n<=limit && Math.abs(cents(n)/100-n)<1e-10;
  }
  function checkedRows(rows){
    check(Array.isArray(rows)&&rows.length>=3&&rows.length<=12,'請輸入 3 至 12 組不同翼長的讀數，每組三次。');
    const sorted=rows.map((row,i)=>{
      check(obj(row)&&measured(row.length,100),'第 '+(i+1)+' 組翼長須為大於 0、最多 100 厘米的數值，最多兩位小數。');
      check(Array.isArray(row.times)&&row.times.length===3&&Array.from(row.times).every(t=>measured(t,120)),
        '第 '+(i+1)+' 組需要三個完整讀數，各次下落時間須大於 0、最多 120 秒，最多兩位小數。');
      return {length:cents(row.length)/100,times:row.times.map(t=>cents(t)/100)};
    }).sort((a,b)=>a.length-b.length);
    check(new Set(sorted.map(row=>row.length)).size===sorted.length,'翼長有重複。請把同一翼長的三次時間放在同一行。');
    return sorted;
  }
  function base(rows){
    const matchesSample=JSON.stringify(rows)===JSON.stringify(example);
    return {kind,title:'紙直升機：翼長會改變下落時間嗎？',instructions:'比較不同翼長各三次的讀數，判斷這組證據可以支持甚麼結論。',
      origin:matchesSample?'example':'teacher',focus:'repeat',focusLength:rows[Math.floor(rows.length/2)].length,rows};
  }
  function create(){return base(checkedRows(example));}
  function validate(spec){
    check(obj(spec)&&spec.kind===kind,'請核對科學探究課資料。');
    const data=base(checkedRows(spec.rows));
    for(const [key,limit] of [['title',120],['instructions',600]]){
      check(typeof spec[key]==='string'&&spec[key].trim()&&spec[key].length<=limit,'請核對課題名稱及課堂指引。');
      data[key]=spec[key].trim();
    }
    check(typeof spec.focus==='string'&&has(guides,spec.focus),'請核對課堂追問的重點。');
    data.focus=spec.focus;
    if(has(spec,'focusLength')){
      check(data.rows.some(row=>row.length===spec.focusLength),'追問所引用的翼長不在目前的讀數表中。');
      data.focusLength=spec.focusLength;
    }
    return data;
  }
  const header='翼長(cm),第1次(s),第2次(s),第3次(s)';
  function format(spec){return [header,...validate(spec).rows.map(row=>[row.length,...row.times.map(seconds)].join(','))].join('\n');}
  function fields(line){
    const delimiter=line.includes('\t')?'\t':line.includes(',')?',':line.includes(';')?';':null;
    return (delimiter?line.split(delimiter):line.split(/\s+/)).map(token=>token.trim());
  }
  function headerRow(cols){
    if(cols.length!==4)return false;
    const tidy=s=>s.toLowerCase().replace(/[\s()（）_]/g,'');
    const first=tidy(cols[0]);
    if(!/^(?:(?:機)?翼[長长](?:度)?|winglength|length)(?:cm|厘米|公分)?$/.test(first))return false;
    return cols.slice(1).every((entry,i)=>{
      const name=tidy(entry),ordinal='一二三'[i];
      return new RegExp('^(?:(?:第?['+(i+1)+ordinal+']次(?:下落時間|下落时间|時間|时间|讀數|读数)?)|(?:trial|time|t)'+(i+1)+')(?:s|秒)?$').test(name);
    });
  }
  function readCell(value,length,row){
    const unit=length?'(?:cm|厘米|公分)':'(?:s|秒)';
    const match=value.match(new RegExp('^((?:[0-9]+(?:\\.[0-9]{1,2})?|\\.[0-9]{1,2}))\\s*'+unit+'?$','i'));
    check(match,'第 '+row+' 行的'+(length?'翼長':'時間')+'無法讀取。請用'+(length?'厘米':'秒')+'及最多兩位小數，並填妥每一格。');
    return Number(match[1]);
  }
  function parse(text){
    check(typeof text==='string'&&text.trim()&&text.length<=6000,'請貼上完整讀數表，最多 6,000 字。');
    const lines=text.normalize('NFKC').replace(/^\uFEFF/,'').split(/\r\n?|\n/);
    const rows=[];
    lines.forEach((raw,i)=>{
      const line=raw.trim();
      if(!line)return;
      const values=fields(line);
      if(headerRow(values))return;
      check(values.length===4,'第 '+(i+1)+' 行應有四欄：翼長（厘米）及三次下落時間（秒）。');
      rows.push({length:readCell(values[0],true,i+1),times:values.slice(1).map(v=>readCell(v,false,i+1))});
    });
    return base(checkedRows(rows));
  }
  function summarize(spec){
    return validate(spec).rows.map(({length,times})=>{
      const total=times.reduce((sum,t)=>sum+cents(t),0);
      return {length,times,mean:Math.round(total/3)/100,min:Math.min(...times),max:Math.max(...times)};
    });
  }
  function guidance(spec){
    const data=validate(spec),i=data.rows.findIndex(row=>row.length===data.focusLength),row=data.rows[i];
    const next=data.rows[i===data.rows.length-1?i-1:i+1];
    if(data.focus==='control')return '比較 '+row.length+' 和 '+next.length+' 厘米兩組時，'+guides.control;
    if(data.focus==='spread')return '把 '+row.length+' 和 '+next.length+' 厘米的三次讀數標在同一條數線上。'+guides.spread;
    return row.length+' 厘米的三次紀錄為 '+row.times.map(seconds).join('、')+' 秒。'+guides.repeat;
  }
  function question(id,stem,correct,others,position,analysis){
    const labels=others.slice();
    labels.splice(position,0,correct);
    return {id,type:'single',question:stem,options:labels.map((label,i)=>({value:letters[i],label})),
      answer:[letters[position]],analysis,hasAnswer:true,points:1};
  }
  function alternatives(id,stem,labels,correct,rotation,analysis){
    const start=labels.length-rotation%labels.length;
    const ordered=[...labels.slice(start),...labels.slice(0,start)];
    const index=ordered.indexOf(correct);
    return question(id,stem,correct,ordered.filter(value=>value!==correct),index,analysis);
  }
  function trendOf(rows){
    const means=rows.map(r=>cents(r.mean));
    if(means.every(v=>v===means[0]))return 2;
    if(means.slice(1).every((v,i)=>v>means[i]))return 0;
    if(means.slice(1).every((v,i)=>v<means[i]))return 1;
    return 3;
  }
  function questions(spec){
    const rows=summarize(spec),mid=rows[Math.floor(rows.length/2)],last=rows[rows.length-1];
    const positionOffset=(cents(last.length)+cents(mid.mean))%4;
    const q=(id,stem,correct,others,slot,analysis)=>question(id,stem,correct,others,(positionOffset+slot)%4,analysis);
    const mean=mid.mean, meanLabel=v=>seconds(v)+' 秒';
    const distractors=new Set();
    for(const candidate of [...mid.times,mid.min,mid.max,mean+0.01,mean+0.05,mean+0.10,mean+0.2]){
      const label=meanLabel(candidate);
      if(label!==meanLabel(mean))distractors.add(label);
    }
    const trends=['每增加一級翼長，平均時間都增加。','每增加一級翼長，平均時間都減少。',
      '所有翼長的平均時間相同。','部分平均時間相同或方向改變，整列既非逐級嚴格增加，也非逐級嚴格減少。'];
    const trend=trendOf(rows);
    // Prefer an adjacent pair whose variation matters to the reading of the means.
    const overlap=(a,b)=>Math.max(a.min,b.min)<=Math.min(a.max,b.max);
    const idx=rows.findIndex((row,i)=>i>0&&overlap(rows[i-1],row));
    const a=rows[idx<0?0:idx-1],b=rows[idx<0?1:idx],common=overlap(a,b);
    const ranges='兩組實測範圍分別為 '+seconds(a.min)+' 至 '+seconds(a.max)+' 秒和 '+seconds(b.min)+' 至 '+seconds(b.max)+' 秒。';
    const yes='兩組實測範圍有共同部分（包括端點相接）。',no='兩組實測範圍沒有共同部分。';
    const limits='這張表只記下各翼長三次下落時間。實驗是否公平，還須核對釋放高度、方式、紙材、總質量等條件。';
    return [
      q('control','為了檢驗翼長的影響，下列哪種比較最公平？','用同樣紙材及總質量、相同高度和放手方式，只改變翼長。',
        ['翼長每增加一次，同時提高釋放位置。','讓每個翼長使用不同數量的萬字夾，也用不同高度釋放。','每種翼長都選最慢的一次，其餘讀數全部刪去。'],1,limits),
      q('mean','翼長 '+mid.length+' 厘米的三次平均下落時間是多少？取至最接近的 0.01 秒。',
        meanLabel(mean),Array.from(distractors).slice(0,3),3,'('+mid.times.map(seconds).join(' + ')+') ÷ 3 ≈ '+meanLabel(mean)+'。三次均須計入。'),
      alternatives('trend','按翼長由短至長排列，並將各組平均時間取至 0.01 秒。哪一句描述整列結果？',
        trends,trends[trend],positionOffset,rows.map(r=>r.length+' 厘米：'+seconds(r.mean)+' 秒').join('；')+'。'),
      alternatives('overlap','比較 '+a.length+' 與 '+b.length+' 厘米兩組，由最短至最長下落時間組成的範圍有何關係？',
        [yes,no,'只要平均時間不同，兩組範圍就一定分開。','沒有第四次紀錄，就不能找出三次讀數中的最短和最長時間。'],
        common?yes:no,positionOffset+2,ranges),
      q('claim','同學想用這份紀錄預測其他紙直升機。哪個結論最有證據支持？',
        '可以描述這 '+rows.length+' 組在本次測試的表現。換紙材或測未試過的翼長，應再實測。',
        ['由這份表便能確定，所有材質的紙直升機增加翼長都會更慢落地。','重複三次已保證沒有量度誤差，沒有必要記下實驗條件。','先刪去最偏離平均值的一次，便可證明翼長是唯一成因。'],1,limits)
    ];
  }
  function initial(){return {choices:{},reason:'',evidence:[],view:{round:1,showMeans:false}};}
  function state(raw){
    check(obj(raw),'請核對課堂作答。');
    const result=initial();
    if(has(raw,'choices')){
      check(obj(raw.choices),'請核對選項紀錄。');
      for(const [id,choice] of Object.entries(raw.choices)){
        check(ids.includes(id)&&typeof choice==='string'&&/^[A-D]$/.test(choice),'無效的題目或選項。');
        result.choices[id]=choice;
      }
    }
    if(has(raw,'reason')){
      check(typeof raw.reason==='string'&&raw.reason.length<=600,'證據解釋最多 600 字。');
      result.reason=raw.reason;
    }
    if(has(raw,'evidence')){
      check(Array.isArray(raw.evidence)&&raw.evidence.length<=2&&Array.from(raw.evidence).every(n=>measured(n,100))
        &&new Set(raw.evidence).size===raw.evidence.length,'請選擇最多兩組不同的翼長作為證據。');
      result.evidence=raw.evidence.slice();
    }
    if(has(raw,'view')){
      check(obj(raw.view)&&[1,2,3].includes(raw.view.round)&&typeof raw.view.showMeans==='boolean','請核對觀察紀錄。');
      result.view={round:raw.view.round,showMeans:raw.view.showMeans};
    }
    return result;
  }
  function checkedAnswers(spec,raw){
    const data=validate(spec),a=state(raw);
    check(a.evidence.every(length=>data.rows.some(row=>row.length===length)),'引用的讀數不在本次課堂，請重新選擇。');
    return a;
  }
  function isComplete(spec,raw){const a=checkedAnswers(spec,raw);return ids.every(id=>has(a.choices,id));}
  function grade(spec,raw,requireComplete=false){
    const answers=checkedAnswers(spec,raw);
    if(requireComplete)check(ids.every(id=>has(answers.choices,id)),'請先在課堂小測完成五題，再交回老師。');
    const items=questions(spec);
    return {answers,score:items.filter(q=>q.answer[0]===answers.choices[q.id]).length,max:items.length,maximum:items.length};
  }
  function classSummary(spec,students){
    check(Array.isArray(students),'請重新讀取這個已派版本的班級作答。');
    const receipts=students.filter(pupil=>pupil?.submitted===true);
    let priority=null;
    const breakdown=questions(spec).map(q=>{
      const options=q.options.map(o=>({...o,count:0,isCorrect:o.value===q.answer[0]}));
      let answered=0,correct=0;
      for(const pupil of receipts){
        const choices=pupil.answers?.choices;
        if(!obj(choices)||!has(choices,q.id))continue;
        const selected=options.find(o=>o.value===choices[q.id]);
        if(!selected)continue;
        selected.count+=1;answered+=1;
        if(selected.isCorrect)correct+=1;
      }
      let topWrong=null;
      for(const option of options){
        if(!option.isCorrect&&option.count>(topWrong?.count??0))topWrong=option;
      }
      const row={id:q.id,question:q.question,analysis:q.analysis,correct,answered,wrong:answered-correct,
        missing:receipts.length-answered,options,topWrong};
      if(row.wrong>(priority?.wrong??0))priority=row;
      return row;
    });
    return {submitted:receipts.length,questions:breakdown,priority};
  }
  const api={kind,create,parse,format,validate,project:validate,initial,state,isComplete,grade,questions,summarize,guidance,classSummary};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EduScienceInquiry=api;
})(globalThis);
