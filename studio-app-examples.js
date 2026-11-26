/* Local authoring for the public trial. School installations use the configured model. */
(() => {
  'use strict';
  const slider = (id,label,min,max,value,step=1) => ({id,label,min,max,value,step});
  const metric = (label,expr,unit='') => unit ? {label,expr,unit} : {label,expr};
  const blank = (title,instructions) => ({kind:'app',title,instructions,inputs:[],points:[],shapes:[],outputs:[]});
  const norm = s => s.normalize('NFKC').replace(/[长宽积标围调称结顶显边额价减圆阔为]/g,
    c => ({长:'長',宽:'寬',积:'積',标:'標',围:'圍',调:'調',称:'稱',结:'結',顶:'頂',显:'顯',边:'邊',额:'額',价:'價',减:'減',圆:'圓',阔:'闊',为:'為'})[c]);
  function triangle() {
    const app=blank('三角形的內角','拖動頂點改變三角形，觀察每個角和三個內角的總和。');
    app.points=[['A',15,75],['B',80,75],['C',48,20]].map(([id,x,y])=>({id,label:id,x,y,draggable:true}));
    app.shapes=[{type:'polygon',points:['A','B','C']}];
    const angles=['angle(B,A,C)','angle(A,B,C)','angle(A,C,B)'];
    app.outputs=[...angles.map((expr,i)=>metric('∠'+'ABC'[i],expr,'°')),metric('內角和',angles.join('+'),'°')];
    return app;
  }
  function discount() {
    const app=blank('折扣計算器','調整原價和減價百分率。減價百分率為 20% 即八折，觀察實付金額。');
    app.inputs=[slider('price','原價',0,1000,200),slider('off','減價百分率',0,100,20)];
    app.outputs=[metric('折後售價','price*(100-off)/100','港元'),metric('節省金額','price*off/100','港元')];
    return app;
  }
  function rectangle() {
    const app=blank('長方形面積挑戰','調整長與闊，嘗試找出不同組合，達到指定面積。');
    app.inputs=[slider('w','長',1,20,4),slider('h','闊',1,20,5)];
    app.outputs=[metric('面積','w*h','平方單位')];
    app.challenge={prompt:'令面積等於 36 平方單位',expr:'w*h',target:36,tolerance:0};
    return app;
  }
  function foodFair() {
    const app=blank('班際義賣的最後半小時','扮演義賣小組，選擇如何處理剩餘的包裝食品，看看每個決定帶來的取捨。');
    app.story={start:'start',scenes:[
      {id:'start',text:'距離義賣結束還有半小時。攤位剩下 12 包餅乾，人流開始減少。小組先做甚麼？',choices:[
        {label:'調低售價，通知附近同學',to:'price'},{label:'保留售價，改用預留名單',to:'orders'}]},
      {id:'price',text:'減價吸引了幾位同學，較早購買的同學卻問為何價錢不同。小組怎樣回應？',choices:[
        {label:'說明限時減價的原因',to:'explain'},{label:'給原價買家同樣優惠',to:'refund'}]},
      {id:'explain',text:'同學清楚知道減價安排。你們決定下一次預先張貼減價時間，讓買家有相同資訊。',choices:[]},
      {id:'refund',text:'買家接受你們的補差額安排，小組要預留人手登記，最終籌得款額也受影響。',choices:[]},
      {id:'orders',text:'你們先向已登記的同學留貨。浪費減少了，但仍需安排領取時間和同學值班。',choices:[]}
    ]};
    return app;
  }
  function addDonation(app) {
    if(!app.story.scenes.some(s=>s.id==='donation')) {
      const start=app.story.scenes.find(s=>s.id===app.story.start);
      start.choices.push({label:'聯絡食物回收機構',to:'donation'});
      app.story.scenes.push({id:'donation',text:'接收機構要求先核對包裝及有效日期。小組須安排交收，才能確認有哪些食品可捐出。',choices:[]});
    }
  }
  // A teacher can write entirely new paths locally, including all dialogue and endings.
  function writeStory(brief,base) {
    const app=base||blank('分支故事','選擇下一步，探索不同結局。');
    const scenes=[];let current;
    for(const line of brief.split(/[\n；;]/).map(s=>s.trim()).filter(Boolean)){
      const name=line.match(/^(?:名稱|標題)\s*[:：]\s*(.+)$/);
      const scene=line.match(/^(?:場景|场景)\s+([A-Za-z][A-Za-z0-9_]*)\s*[:：]\s*(.+)$/);
      const choice=line.match(/^(?:選項|选项)\s+(.+?)\s*(?:->|=>|→)\s*([A-Za-z][A-Za-z0-9_]*)$/);
      if(name)app.title=name[1];
      else if(scene){current={id:scene[1],text:scene[2],choices:[]};scenes.push(current);}
      else if(choice&&current)current.choices.push({label:choice[1],to:choice[2]});
      else throw Error('故事請分行寫「場景 start：發生甚麼事？」及「選項 前往課室 → room」，另寫同名目的地場景。');
    }
    if(!scenes.length)throw Error('請寫最少兩個場景。');
    app.story={start:scenes[0].id,scenes};
    return app;
  }
  function putMetric(app,entry) {
    const at=app.outputs.findIndex(o=>o.label===entry.label);
    if(at===-1){app.outputs.push(entry);return;}
    const previous=app.outputs[at];
    if(app.challenge && previous.expr===app.challenge.expr && previous.expr.replace(/\s+/g,'')!==entry.expr.replace(/\s+/g,'')){
      throw Error('這個讀數用作判定挑戰目標。請保留其算式，另取讀數名稱，或另建自訂計算工具。');
    }
    app.outputs[at]={...previous,...entry};
  }
  const number='[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const range=new RegExp('('+number+')\\s*(?:至|到|~|–|—|\\.\\.|-)\\s*('+number+')');
  function customFields(app,brief) {
    let count=0;
    for (const line of brief.split(/[\n；;]/).map(s=>s.trim()).filter(Boolean)) {
      const named=line.match(/^(?:名稱|名称|標題|标题)\s*[:：]\s*(.+)$/);
      const field=line.match(/^(?:滑桿|滑杆|滑塊|滑块)\s*[:：]?\s*(.+?)\s*\(([A-Za-z][A-Za-z0-9_]*)\)\s*[:：]?\s*(.+)$/);
      const result=line.match(/^結果\s*[:：]?\s*(.+?)\s*[=＝]\s*(.+)$/);
      if(named)app.title=named[1].trim();
      else if(field){
        const [label,id]=[field[1].trim(),field[2]];
        const bounds=field[3].match(range);
        if(!bounds||bounds[0].length!==field[3].trim().length)throw Error('滑桿請寫成「滑桿 距離(d) 1 至 30」。');
        const min=Number(bounds[1]),max=Number(bounds[2]);
        const decimals=Math.max(0,...bounds.slice(1).map(n=>(n.split('.')[1]||'').length));
        const item=slider(id,label,min,max,min,10**(-decimals));
        const at=app.inputs.findIndex(x=>x.id===id);
        if(at===-1)app.inputs.push(item);else app.inputs[at]=item;
      }else if(result)putMetric(app,metric(result[1].trim(),result[2].trim()));
      else throw Error('自訂公式每行可填「名稱：…」、「滑桿 距離(d) 1 至 30」或「結果 車費 = 27 + d * 2」。');
      count++;
    }
    return count;
  }
  function rectangleChallenge(app) {
    return app.challenge?.expr==='w*h' && app.inputs.some(s=>s.id==='w') && app.inputs.some(s=>s.id==='h');
  }
  function finish(app) {
    const spec=EduStudioApp.validate(app);
    if(rectangleChallenge(spec)){
      let [w,h]=['w','h'].map(key=>spec.inputs.find(i=>i.id===key));
      if(w.min<=0||h.min<=0)throw Error('長方形的長和闊須為正數。');
      if((w.max-w.min)/w.step>(h.max-h.min)/h.step)[w,h]=[h,w];
      const steps=Math.round((w.max-w.min)/w.step);
      if(steps>10000)throw Error('請縮小其中一個滑桿範圍，或加大步距，以便檢查面積挑戰。');
      let possible=false;
      for(let i=0;i<=steps;i++){
        const x=w.min+i*w.step;
        const k=Math.round((spec.challenge.target/x-h.min)/h.step);
        if(k<0||k>Math.round((h.max-h.min)/h.step))continue;
        const product=x*(h.min+k*h.step);
        if(Math.abs(product-spec.challenge.target)<=spec.challenge.tolerance+8*Number.EPSILON*Math.max(1,Math.abs(product),Math.abs(spec.challenge.target))){possible=true;break;}
      }
      if(!possible)throw Error('目前的長、闊範圍無法達到這個面積，請調整範圍或目標。');
    }
    if(spec.outputs.some(o=>o.expr==='price*(100-off)/100')){
      const price=spec.inputs.find(i=>i.id==='price'),off=spec.inputs.find(i=>i.id==='off');
      if(price.min<0||off.min<0||off.max>100)throw Error('原價不可為負數，減價百分率須在 0% 至 100% 之間。');
    }
    return spec;
  }
  function builder(brief,base) {
    if(typeof brief!=='string'||!brief.trim()||brief.length>1200)throw Error('請用 1 至 1,200 字描述活動。');
    const s=norm(brief.trim());
    let app=base?structuredClone(EduStudioApp.validate(base)):null;
    if(/(?:^|[\n;；])\s*(?:場景|场景)\s/.test(s))return finish(writeStory(s,app));
    if (/^(?:名稱|標題|滑[桿杆塊块]|結果)\s*[:：]|^(?:滑[桿杆塊块]|結果)\s/m.test(s)) {
      app ||= blank('自訂計算工具','調整滑桿，觀察數值的變化。');
      customFields(app,s);
      return finish(app);
    }
    const isNew=!app;
    if(!app) {
      if(/三角|triangle/i.test(s))app=triangle();
      else if(/折扣|減價|折後|discount/i.test(s))app=discount();
      else if(/長方|矩形|rectangle/i.test(s))app=rectangle();
      else if(/義賣|义卖|剩餘食物|剩余食物/.test(s))app=foodFair();
      else throw Error('本機示例支援三角形、折扣、長方形及義賣故事。也可自訂公式或分行編寫故事場景。');
    }
    const tri=app.shapes.some(p=>p.type==='polygon'&&p.points.length===3&&['A','B','C'].every(k=>p.points.includes(k)));
    const rect=rectangleChallenge(app);
    let changed=false;
    if(app.story && /捐贈|捐赠|捐出/.test(s)){
      const fair=['start','price','orders','explain','refund'].every(key=>app.story.scenes.some(scene=>scene.id===key));
      if(!fair)throw Error('捐贈結局屬於義賣示例；自訂故事請填寫完整場景及選項。');
      addDonation(app);changed=true;
    }
    if((tri||rect) && /面積|周長|週長|周界|perimeter|area/i.test(s)) {
      const length=rect?'2*(w+h)':'distance(A,B)+distance(B,C)+distance(C,A)';
      const parts=s.split(/[,，。;；\n]|(?:同時|同时|並|并|再)(?=移除|刪除|删除|取消|加|顯示|显示|隱藏|隐藏)/);
      for(const part of parts){
        const remove=/移除|刪除|删除|取消|去掉|隱藏|隐藏|不要|不用|不顯示/.test(part);
        const setOutput=item=>{if(remove)app.outputs=app.outputs.filter(o=>o.label!==item.label);else putMetric(app,item);};
        if(/面積|area/i.test(part))setOutput(metric('面積',rect?'w*h':'area(A,B,C)','平方單位'));
        if(/周長|週長|周界|perimeter/i.test(part))setOutput(metric('周界',length,'單位'));
      }
      changed=true;
    }
    const target=s.match(new RegExp('(?:目標(?:面積)?|面積(?:等於|等于|達到|达到|為|是|=))\\s*(?:改為|改成|調至|設為|改到|為|是|:|=)?\\s*('+number+')'));
    if(target && rect) {
      app.challenge={prompt:'令面積等於 '+target[1]+' 平方單位',expr:'w*h',target:Number(target[1]),tolerance:0};
      changed=true;
    }
    let lastRangeEnd=0;
    for(const bounds of s.matchAll(new RegExp(range.source,'g'))) {
      const before=s.slice(lastRangeEnd,bounds.index).toLowerCase().replace(/長方形|周長|週長/g,'');
      const position=i=>{
        const aliases=[i.label.toLowerCase()];
        if(i.id==='off')aliases.push('折扣','百分');
        if(i.id==='h' && rect)aliases.push('寬');
        const reference=[...before.matchAll(new RegExp('\\b'+i.id+'\\b','gi'))].pop();
        return Math.max(reference?.index??-1,...aliases.map(a=>before.lastIndexOf(a)));
      };
      const named=app.inputs.map(input=>({input,index:position(input)})).filter(e=>e.index>=0).sort((a,b)=>b.index-a.index);
      const which=named[0]?.input;
      if(!which)throw Error('請指出要更改哪個滑桿，例如「把原價範圍改為 10 至 500」。');
      which.min=Number(bounds[1]);which.max=Number(bounds[2]);
      which.value=Math.max(which.min,Math.min(which.max,which.min+Math.round((which.value-which.min)/which.step)*which.step));
      lastRangeEnd=bounds.index+bounds[0].length;changed=true;
    }
    const rename=s.match(/(?:改名|命名|(?:名稱|標題)\s*(?:改|設)?)(?:為|成|叫|:)?\s*[「『"“]?(.+?)[」』"”]?[。！!]?$/);
    if(rename){app.title=rename[1].trim();changed=true;}
    if(!isNew&&!changed)throw Error('本機示例可改名稱、滑桿範圍、面積目標，或加上面積和周界。原版本已保留。');
    return finish(app);
  }
  globalThis.EduStudioAppExamples={build:builder};
})();
