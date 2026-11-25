/* Generate a Form 1 measurement exercise from the teacher's recorded observations. */
(function (root) {
  'use strict';
  const sample = '0, 0\n10, 40\n25, 85\n40, 100';
  const blank = () => ({title:'出水量與時間：數據探究', readings:'', source:'measured'});

  function parse(text) {
    if (typeof text !== 'string' || text.length > 600) throw Error('讀數格式不正確。');
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 3 || lines.length > 8) throw Error('請輸入 3 至 8 組讀數，每行一組。');
    const points = [];
    for (const [i, line] of lines.entries()) {
      const match = /^\s*(\d{1,4})(?:\s*[,，]\s*|\s+)(\d{1,4}(?:\.\d)?)\s*$/.exec(line.normalize('NFKC'));
      if (!match) throw Error('第 '+(i+1)+' 行請填整秒及非負體積，體積最多一位小數。');
      const time = Number(match[1]), tenths = Math.round(Number(match[2])*10);
      if (i && (time <= points[i-1].time || tenths < points[i-1].tenths)) {
        throw Error('第 '+(i+1)+' 行的時間必須比上一行遲，累積體積不可減少。請核對紀錄。');
      }
      points.push({time,tenths});
    }
    return points;
  }

  function waterGraph(points) {
    const left=58, right=461, top=25, base=168;
    const start=points[0].time, end=points[points.length-1].time;
    const firstVolume=points[0].tenths/10, lastVolume=points[points.length-1].tenths/10;
    const change=lastVolume-firstVolume;
    const span=change || (lastVolume ? Math.max(.4,lastVolume*.1) : .4);
    const rawStep=Math.max(.1,span/4), scale=10**Math.floor(Math.log10(rawStep));
    const step=[1,2,2.5,5,10].find(n=>n*scale>=rawStep)*scale;
    const ymin=Math.max(0,Math.floor((firstVolume-(change?0:span/2))/step)*step);
    const tickCount=Math.max(2,Math.ceil((lastVolume-ymin)/step - 1e-9)+(change?0:2));
    const ymax=ymin+tickCount*step;
    const x=t=>left+(t-start)/(end-start)*(right-left);
    const y=v=>base-(v-ymin)/(ymax-ymin)*(base-top);
    const xy=points.map(p=>[x(p.time).toFixed(2),y(p.tenths/10).toFixed(2)]);
    const grid=Array.from({length:tickCount+1},(_,i)=>{
      const v=ymin+step*i, pos=y(v);
      return '<path d="M'+left+' '+pos+'H'+right+'" stroke="#dae1e7"/><text x="51" y="'+(pos+4)+'" text-anchor="end">'+Number(v.toFixed(3))+'</text>';
    }).join('');
    const timeTicks=Array.from({length:5},(_,i)=>{
      const t=start+(end-start)*i/4, pos=x(t);
      return '<path d="M'+pos+' '+base+'v4" stroke="#17364d"/><text x="'+pos+'" y="185" text-anchor="middle">'+t+'</text>';
    }).join('');
    const cells=points.map((p,i)=>'<text x="'+(103+i*(343/Math.max(1,points.length-1)))+'" y="218">'+p.time+'</text><text x="'+(103+i*(343/Math.max(1,points.length-1)))+'" y="242">'+(p.tenths/10)+'</text>').join('');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 255"><rect width="480" height="255" fill="white"/><g font-family="sans-serif" font-size="13" fill="#17364d">'+
      '<text x="12" y="16">累積體積 (cm³)</text>'+grid+'<path d="M'+left+' '+top+'V'+base+'H'+right+'" fill="none" stroke="#17364d"/>'+
      '<polyline points="'+xy.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#205ba4" stroke-width="2.5"/>'+
      xy.map(([cx,cy])=>'<circle cx="'+cx+'" cy="'+cy+'" r="3.7" fill="#205ba4"/>').join('')+
      timeTicks+'<text x="254" y="200" text-anchor="middle">時間 (s)</text>'+
      '<rect x="5" y="204" width="470" height="46" fill="#eff5f8"/><text x="12" y="218">時間 (s)</text><text x="12" y="242">體積 (cm³)</text><g text-anchor="middle">'+cells+'</g></g></svg>';
    const bytes=new TextEncoder().encode(svg);
    return 'data:image/svg+xml;base64,'+btoa(String.fromCharCode(...bytes));
  }

  function build(spec) {
    if (!spec || typeof spec.title!=='string' || !spec.title.trim() || spec.title.length>120) throw Error('請填寫試卷名稱（最多 120 字）。');
    if (!['measured','simulated'].includes(spec.source)) throw Error('請選擇讀數來源。');
    const p=parse(spec.readings), first=p[0], last=p[p.length-1];
    const intervals=p.slice(1).map((b,i)=>({start:p[i].time,end:b.time,dt:b.time-p[i].time,dv:b.tenths-p[i].tenths}));
    const fastest=intervals.reduce((a,b)=>a.dv*b.dt>=b.dv*a.dt?a:b);
    const leaders=intervals.filter(v=>v.dv*fastest.dt===fastest.dv*v.dt);
    const ranges=leaders.map(v=>v.start+' 至 '+v.end+' 秒').join('、');
    const volume=(last.tenths-first.tenths)/10, duration=last.time-first.time;
    // Round the exact ratio of tenths of a cubic centimetre to the nearest hundredth.
    const avg=Math.floor((20*(last.tenths-first.tenths)+duration)/(2*duration))/100;
    function exactRate(v) {
      let a=v.dv, b=10*v.dt;
      while(b) [a,b]=[b,a%b];
      const den=10*v.dt/a, num=v.dv/a;
      return 10000%den===0?String(num/den):num+'/'+den;
    }
    const rates=intervals.map(v=>v.start+'–'+v.end+' s：'+v.dv/10+' ÷ '+v.dt+' = '+exactRate(v)).join('；');
    const attribution=spec.source==='simulated'?'模擬實驗讀數':'教師提供的班級實驗讀數';
    const diagram=waterGraph(p), alt=p.map(v=>v.time+' 秒時為 '+v.tenths/10+' cm³').join('，');
    const questions=[];
    function add(topic,prompt,solution,labels,numeric) {
      const q={id:'q'+(questions.length+1),kind:numeric?'number':'text',topic,prompt,working:true,solution,
        diagram,diagramAlt:'累積體積折線圖。'+alt+'。',diagramCaption:attribution+'。圖下列出每次紀錄的數值。',
        criteria:labels.map((label,i)=>({id:numeric && i===labels.length-1?'answer':'m'+(i+1),label,max:1,
          mode:numeric && i===labels.length-1?'auto':'manual'})),
        sample:{answer:numeric?numeric.referenceAnswer:solution,working:numeric?solution:''}};
      if (numeric) Object.assign(q,numeric);
      questions.push(q);
    }
    add('累積量與變化量','量筒收集出水口流出的水。從第 '+first.time+' 秒至第 '+last.time+' 秒，量筒新增了多少 cm³ 的水？列式作答。',
      '新增體積 = '+last.tenths/10+' − '+first.tenths/10+' = '+volume+' cm³。',['以末讀數減去初讀數','得出新增體積 '+volume+' cm³'],{expected:volume,referenceAnswer:String(volume),unit:'cm³'});
    add('平均出水速率','計算整個紀錄時段的平均出水速率，以 cm³/s 作答，四捨五入至小數後兩位。',
      '相隔 '+duration+' 秒，體積增加 '+volume+' cm³。平均速率 = '+volume+' ÷ '+duration+
        ((10*(last.tenths-first.tenths))%duration?' ≈ ':' = ')+avg.toFixed(2)+' cm³/s（取至小數後兩位）。',
      ['求出經過時間和新增體積','用新增體積除以經過時間','得出 '+avg.toFixed(2)+' cm³/s'],{expected:avg,referenceAnswer:avg.toFixed(2),unit:'cm³/s'});
    add('比較相鄰時段','比較每兩次相鄰讀數之間的平均出水速率。列出各段算式，指出所有最快的時段；如有並列，須全部寫出。',
      rates+'（單位均為 cm³/s）。最高速率出現在'+ranges+'。',['分別求各相鄰時段的體積增量','將各段增量除以該段經過時間','列出全部最快時段：'+ranges]);
    const uniform=leaders.length===intervals.length;
    const everySecond=intervals.every(v=>v.dt===1);
    const interpretation=!uniform?'各段平均速率有別，與每一秒平均速率相同的說法不符。':
      everySecond?'每一秒都有讀數，所測各個一秒時段的平均速率相同，數據支持這句話；這也不能證明每一秒內的瞬時速率恆定。':
      '所有相鄰時段的平均速率相同，但部分時段超過一秒，不能確定段內每一秒的平均速率都相同。';
    const judgement=!uniform?'指出時段平均有別與該結論不符':
      everySecond?'從每一秒的讀數判斷，所測的一秒平均速率相同':'分清相鄰時段平均相同與每一秒平均相同';
    add('從數據判斷結論','同學說：「每一個一秒時段的平均出水速率都相同。」比較至少兩段數據，判斷這句話是否有足夠支持。提出一個量度改進，並說明它有甚麼幫助。',
      rates+'（單位均為 cm³/s）。'+interpretation+
        (everySecond?'可在相同設定下重複實驗，檢查各個一秒時段的結果能否重現。':'可每秒記錄一次累積體積，比較每秒的增量，或重複實驗以檢查結果能否重現。'),
      ['引用最少兩個時段的數據或速率作比較',judgement,'提出可行的量度改進，並說明它如何檢驗上述判斷']);
    return {year:'中一',subject:'科學',title:spec.title.trim(),minutes:18,description:'按'+attribution+'編製的讀圖及探究練習。',attribution,custom:true,questions};
  }
  const api={build,blank,sample};
  root.EduScienceReadings=api;
  if (typeof module!=='undefined') {
    module.exports=api;
    if (require.main===module) {
      try {process.stdout.write(JSON.stringify({paper:build(JSON.parse(require('node:fs').readFileSync(0,'utf8')))}));}
      catch (error) {process.stdout.write(JSON.stringify({error:error.message}));}
    }
  }
})(globalThis);
