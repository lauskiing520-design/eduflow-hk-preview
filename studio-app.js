/* Declarative classroom activities. The browser and the submission worker use the same maths. */
(function (root) {
  'use strict';

  const scalar = {abs: [1, Math.abs], sqrt: [1, Math.sqrt], round: [1, Math.round],
    min: [2, Math.min], max: [2, Math.max]};
  const geometry = {angle: 3, distance: 2, area: 3};
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = (x, low, high) => Number.isFinite(x) && x >= low && x <= high;
  const coord = value => finite(value, 0, 100) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
  function insist(ok, message) { if (!ok) throw new Error(message); }
  function words(raw, limit, field) {
    insist(typeof raw === 'string' && raw.trim() && raw.trim().length <= limit, '請核對'+field+'的文字及長度。');
    return raw.trim();
  }
  function fields(raw, allowed) {
    insist(object(raw) && Object.keys(raw).every(k => allowed.includes(k)), '活動有未支援的設定。');
  }
  function list(data, key, maximum) {
    const items = data[key] === undefined ? [] : data[key];
    insist(Array.isArray(items) && items.length <= maximum, '活動包含過多項目或格式不符。');
    return items;
  }
  function id(raw, used) {
    insist(typeof raw === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(raw) &&
      !used.has(raw) && !(raw in scalar) && !(raw in geometry) && raw !== 'prototype', '項目代號須為不重複的英文字母或數字，並以字母開頭。');
    used.add(raw);
    return raw;
  }
  function onStep(number, input) {
    if (!finite(number, input.min, input.max)) return false;
    const position = (number - input.min) / input.step;
    return Math.abs(position - Math.round(position)) <= 1e-7;
  }
  function storySpec(raw) {
    fields(raw,['start','scenes']);
    const ids=new Set();
    const scenes=list(raw,'scenes',16).map(scene=>{
      fields(scene,['id','text','choices']);
      insist(Array.isArray(scene.choices),'每幕均須提供選項，結局可留空。');
      const destinations=new Set(), labels=new Set();
      const choices=list(scene,'choices',5).map(choice=>{
        fields(choice,['label','to']);
        const label=words(choice.label,100,'選項');
        insist(typeof choice.to==='string' && !destinations.has(choice.to) && !labels.has(label),
          '同一幕的選項及去向須可區分。');
        destinations.add(choice.to);labels.add(label);
        return {label,to:choice.to};
      });
      return {id:id(scene.id,ids),text:words(scene.text,420,'場景敘述'),choices};
    });
    insist(scenes.length>=2 && ids.has(raw.start),'請設定有效的開場及最少兩幕情境。');
    const byId=new Map(scenes.map(s=>[s.id,s])), active=new Set(), visited=new Set();
    function walk(key) {
      insist(byId.has(key),'選項指向不存在的場景。');
      insist(!active.has(key),'每個選擇都須通往結局，請移除循環的分支。');
      if (visited.has(key)) return;
      active.add(key);
      for (const choice of byId.get(key).choices) walk(choice.to);
      active.delete(key);visited.add(key);
    }
    walk(raw.start);
    insist(visited.size===scenes.length,'有場景無法從開場到達。');
    return {start:raw.start,scenes};
  }

  // A small arithmetic language. Parse to pure functions over values and points.
  // Exponentiation is right-associative and binds more tightly than unary minus.
  function compile(source, data) {
    const invalid = () => { throw new Error('請核對算式「'+source+'」的符號、項目代號或函數參數。'); };
    const inputIds = new Set(data.inputs.map(v => v.id));
    const pointIds = new Set(data.points.map(v => v.id));
    const src = source.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    const lex = /\s+|(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z][A-Za-z0-9_]*|[(),+*/^%-]/gy;
    const tokens = [];
    let offset = 0;
    while (offset < src.length) {
      const match = lex.exec(src);
      if (!match || tokens.length > 120) invalid();
      offset = lex.lastIndex;
      if (match[0].trim()) tokens.push(match[0]);
    }
    let cursor = 0;
    function take(token) { if (tokens[cursor] === token) { cursor++; return true; } return false; }
    function requireToken(token) { if (!take(token)) invalid(); }
    const operators = {
      '+': (a,b) => a+b, '-': (a,b) => a-b, '*': (a,b) => a*b,
      '/': (a,b) => b === 0 ? NaN : a/b, '%': (a,b) => b === 0 ? NaN : a%b, '^': (a,b) => a**b
    };
    function operation(op, left, right) {
      return state => {
        const a = left(state), b = right(state);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
        const result = operators[op](a,b);
        return Number.isFinite(result) ? result : NaN;
      };
    }
    function atom() {
      if (take('(')) {
        const arg = sum(); requireToken(')'); return arg;
      }
      const token = tokens[cursor++];
      if (!token) invalid();
      if (/^[.\d]/.test(token)) {
        const value = Number(token); if (!Number.isFinite(value)) invalid();
        return () => value;
      }
      if (inputIds.has(token)) return state => state.values[token];
      if (own(geometry,token)) {
        requireToken('(');
        const args = [];
        for (let i=0; i<geometry[token]; i++) {
          if (i) requireToken(',');
          const point = tokens[cursor++];
          if (!pointIds.has(point)) invalid();
          args.push(point);
        }
        requireToken(')');
        return state => {
          const [a,b,c] = args.map(key => state.points[key]);
          const dx = a[0]-b[0], dy = a[1]-b[1];
          if (token === 'distance') return Math.hypot(dx,dy);
          const ex = c[0]-b[0], ey = c[1]-b[1];
          const cross = Math.abs(dx*ey-dy*ex);
          if (token === 'area') return cross/2;
          if ((dx===0 && dy===0) || (ex===0 && ey===0)) return NaN;
          return Math.atan2(cross, dx*ex+dy*ey)*180/Math.PI;
        };
      }
      if (!own(scalar,token)) invalid();
      requireToken('('); const args = [sum()];
      if (scalar[token][0] === 2) { requireToken(','); args.push(sum()); }
      requireToken(')');
      return state => scalar[token][1](...args.map(arg => arg(state)));
    }
    function power() {
      const left = atom();
      return take('^') ? operation('^',left,unary()) : left;
    }
    function unary() {
      if (take('+')) return unary();
      if (take('-')) { const arg = unary(); return state => -arg(state); }
      return power();
    }
    function product() {
      let left = unary();
      while (['*','/','%'].includes(tokens[cursor])) left = operation(tokens[cursor++],left,unary());
      return left;
    }
    function sum() {
      let left = product();
      while (['+','-'].includes(tokens[cursor])) left = operation(tokens[cursor++],left,product());
      return left;
    }
    const expression = sum();
    if (cursor !== tokens.length) invalid();
    return expression;
  }

  function validate(raw) {
    fields(raw,['kind','title','instructions','inputs','points','shapes','outputs','challenge','story']);
    insist(raw.kind === 'app','活動種類不符。');
    const data = {kind:'app',title:words(raw.title,100,'活動名稱'),instructions:words(raw.instructions,600,'學生指引')};
    const used = new Set();
    data.inputs = list(raw,'inputs',8).map(input => {
      fields(input,['id','label','min','max','step','value']);
      insist(finite(input.min,-1e6,1e6) && finite(input.max,-1e6,1e6) && input.min < input.max &&
        finite(input.step,1e-6,input.max-input.min) && (input.max-input.min)/input.step <= 1e6 &&
        onStep(input.max,input) && onStep(input.value,input), '請核對滑桿範圍、步距和起始值。');
      return {id:id(input.id,used),label:words(input.label,56,'滑桿名稱'),
        min:input.min,max:input.max,step:input.step,value:input.value};
    });
    data.points = list(raw,'points',10).map(point => {
      fields(point,['id','label','x','y','draggable']);
      insist(coord(point.x) && coord(point.y) && typeof point.draggable === 'boolean','頂點座標須在 0–100 內，最多一位小數，並指明可否移動。');
      return {id:id(point.id,used),label:words(point.label,32,'頂點名稱'),x:point.x,y:point.y,draggable:point.draggable};
    });
    const pointIds = new Set(data.points.map(p => p.id));
    data.shapes = list(raw,'shapes',16).map(shape => {
      fields(shape,['type','points']);
      const polygon = shape.type==='polygon';
      insist((polygon || shape.type==='line' || shape.type==='circle') && Array.isArray(shape.points) &&
        (polygon ? shape.points.length>=3 && shape.points.length<=8 : shape.points.length===2) &&
        shape.points.every(p => pointIds.has(p)) && new Set(shape.points).size===shape.points.length,'請核對圖形所需的頂點。');
      return {type:shape.type,points:[...shape.points]};
    });
    const expression = value => {
      const source = words(value,192,'算式'); compile(source,data); return source;
    };
    data.outputs = list(raw,'outputs',10).map(out => {
      fields(out,['label','expr','unit']);
      return {label:words(out.label,64,'讀數名稱'),expr:expression(out.expr),
        ...(out.unit ? {unit:words(out.unit,20,'單位')} : {})};
    });
    if (raw.challenge != null) {
      const c = raw.challenge;
      fields(c,['prompt','expr','target','tolerance']);
      insist(finite(c.target,-1e12,1e12) && finite(c.tolerance,0,1e9),'請核對挑戰的目標和容許誤差。');
      data.challenge = {prompt:words(c.prompt,220,'挑戰說明'),expr:expression(c.expr),target:c.target,tolerance:c.tolerance};
    }
    if (raw.story != null) data.story=storySpec(raw.story);
    insist(data.story || data.inputs.length || data.points.some(p=>p.draggable),'請加入滑桿、可移動的點或情境分支。');
    insist(data.story || data.outputs.length || data.shapes.length || data.challenge,'請加入圖形、讀數、挑戰或情境分支。');
    return data;
  }
  function initial(data) {
    return {values:Object.fromEntries((data.inputs||[]).map(v=>[v.id,v.value])),
      points:Object.fromEntries((data.points||[]).map(p=>[p.id,[p.x,p.y]])),
      ...(data.story ? {path:[data.story.start]} : {})};
  }
  function stateFor(data,raw) {
    fields(raw,data.story?['values','points','path']:['values','points']);
    fields(raw.values,data.inputs.map(i=>i.id)); fields(raw.points,data.points.map(p=>p.id));
    const state = initial(data);
    for (const input of data.inputs) {
      insist(own(raw.values,input.id) && onStep(raw.values[input.id],input),'滑桿數值超出範圍或步距。');
      state.values[input.id] = raw.values[input.id];
    }
    for (const point of data.points) {
      const xy = raw.points[point.id];
      insist(own(raw.points,point.id) && Array.isArray(xy) && xy.length===2 && xy.every(coord) &&
        (point.draggable || (xy[0]===point.x && xy[1]===point.y)), '頂點的位置無效。');
      state.points[point.id] = [...xy];
    }
    if (data.story) {
      const path=raw.path, scenes=new Map(data.story.scenes.map(s=>[s.id,s]));
      insist(Array.isArray(path) && path.length>=1 && path.length<=scenes.size && path[0]===data.story.start &&
        path.slice(1).every((key,i)=>scenes.get(path[i])?.choices.some(c=>c.to===key)), '情境選擇紀錄無效。');
      state.path=[...path];
    }
    return state;
  }
  function meets(value,challenge) {
    return Number.isFinite(value) && Math.abs(value-challenge.target) <= challenge.tolerance +
      8*Number.EPSILON*Math.max(1,Math.abs(value),Math.abs(challenge.target));
  }
  function answer(raw,state,requireCompletion=false) {
    const data = validate(raw), answers = stateFor(data,state), c = data.challenge;
    if (data.story && requireCompletion) {
      const scene=data.story.scenes.find(s=>s.id===answers.path[answers.path.length-1]);
      insist(!scene.choices.length,'請先完成情境，抵達一個結局後再提交。');
    }
    return {answers,score:c ? Number(meets(compile(c.expr,data)(answers),c)) : 0,maximum:c ? 1 : 0};
  }

  // Display code below shares the expression parser and state rules with the submission worker.
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag,attributes) {
    const node = document.createElementNS(svgNS,tag);
    for (const [k,v] of Object.entries(attributes||{})) node.setAttribute(k,v);
    return node;
  }
  function element(tag,className,content) {
    const node=document.createElement(tag);
    if (className) node.className=className;
    if (content!==undefined) node.textContent=content;
    return node;
  }
  const roundedCoord = v => Math.round(Math.max(0, Math.min(100,v))*10)/10;
  function geometryCanvas(data,state,changed,locked) {
    const box=element('div','ea-geometry');
    const board=svg('svg',{viewBox:'-9 -9 118 118',role:'group','aria-label':'互動幾何圖'});
    board.classList.add('ea-board');
    const grid=svg('path',{d:Array.from({length:11},(_,i)=>'M'+(i*10)+' 0v100 M0 '+(i*10)+'h100').join(' '),class:'ea-grid'});
    board.append(grid);
    const redraw=[];
    for (const shape of data.shapes) {
      const node=svg(shape.type,{class:'ea-shape ea-'+shape.type});
      board.append(node);
      redraw.push(()=>{
        const points=shape.points.map(key=>state.points[key]);
        if (shape.type==='polygon') node.setAttribute('points',points.map(p=>p.join(',')).join(' '));
        else if (shape.type==='line') {
          node.setAttribute('x1',points[0][0]); node.setAttribute('y1',points[0][1]);
          node.setAttribute('x2',points[1][0]); node.setAttribute('y2',points[1][1]);
        } else {
          node.setAttribute('cx',points[0][0]); node.setAttribute('cy',points[0][1]);
          node.setAttribute('r',Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]));
        }
      });
    }
    const hasHandles=data.points.some(p=>p.draggable);
    const controls=element('details','ea-coordinates');
    controls.append(element('summary',null,'調整頂點座標'));
    for (const point of data.points) {
      const group=svg('g',{class:point.draggable?'ea-handle':'ea-static'});
      const hit=svg('circle',{r:5.5,class:'ea-hit'}), dot=svg('circle',{r:1.6,class:'ea-dot'});
      const text=svg('text',{class:'ea-label'}); text.textContent=point.label;
      group.append(hit,dot,text);board.append(group);
      const canMove=point.draggable && !locked;
      const update=(x,y)=>{
        if (!canMove || board.closest('fieldset:disabled')) return;
        const next=[roundedCoord(x),roundedCoord(y)];
        if (next.every((v,i)=>v===state.points[point.id][i])) return;
        state.points[point.id]=next; changed();
      };
      if (canMove) {
        let active=null;
        const drag=event=>{
          if (active!==event.pointerId) return;
          const matrix=board.getScreenCTM();
          if (!matrix) return;
          const q=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
          update(q.x,q.y);
        };
        group.addEventListener('pointerdown',event=>{
          if (active!==null || event.button!==0 || board.closest('fieldset:disabled')) return;
          event.preventDefault();active=event.pointerId;group.setPointerCapture(active);drag(event);
        });
        group.addEventListener('pointermove',drag);
        for (const name of ['pointerup','pointercancel','lostpointercapture']) group.addEventListener(name,e=>{
          if (e.pointerId===active) active=null;
        });
        const pair=element('div','ea-coord-pair');
        for (const [axis,index] of [['x',0],['y',1]]) {
          const label=element('label',null,point.label+' · '+axis), control=element('input');
          control.type='range'; control.min='0';control.max='100';control.step='0.1';
          control.setAttribute('aria-label',point.label+' '+axis+' 座標');
          const value=element('span','ea-coordinate-value');
          label.append(value,control);pair.append(label);
          control.oninput=()=>{
            const p=[...state.points[point.id]];p[index]=Number(control.value);update(...p);
          };
          redraw.push(()=>{const n=state.points[point.id][index];control.value=String(n);value.textContent=String(n);});
        }
        controls.append(pair);
      }
      redraw.push(()=>{
        const [x,y]=state.points[point.id];
        group.setAttribute('transform','translate('+x+' '+y+')');
        text.setAttribute('x',x>82?-2.6:2.6);text.setAttribute('y',y<7?4.8:-2);
        text.setAttribute('text-anchor',x>82?'end':'start');
      });
    }
    box.append(board);
    if (!locked && hasHandles) box.append(controls);
    return {box,redraw:()=>redraw.forEach(fn=>fn())};
  }

  function storyCanvas(story,state,changed,locked) {
    const box=element('section','ea-story');
    box.setAttribute('aria-label','互動情境');
    const scenes=new Map(story.scenes.map(s=>[s.id,s]));
    const heading=element('h3','ea-scene-heading'), narrative=element('p','ea-narrative');
    const choices=element('div','ea-choices'), past=element('details','ea-story-history');
    const pastTitle=element('summary'), log=element('ol');
    past.append(pastTitle,log);heading.tabIndex=-1;
    const back=element('button','quiet','返回上一個選擇'), reset=element('button','quiet','由頭開始');
    back.type=reset.type='button';
    const bar=element('div','ea-story-nav');bar.append(back,reset);
    box.append(heading,narrative,choices,past,bar);
    function navigate(next) {
      if (locked || box.closest('fieldset:disabled')) return;
      state.path=next;changed();heading.focus({preventScroll:true});
    }
    back.onclick=()=>{if (state.path.length>1) navigate(state.path.slice(0,-1));};
    reset.onclick=()=>navigate([story.start]);
    let previous='';
    function redraw() {
      const key=state.path.join('/');
      if (key===previous) return;
      previous=key;
      const current=scenes.get(state.path[state.path.length-1]);
      heading.textContent=current.choices.length?'作出選擇':'你的結局';
      narrative.textContent=current.text;
      choices.replaceChildren();log.replaceChildren();
      if (!locked) for (const choice of current.choices) {
        const button=element('button','ea-choice',choice.label);button.type='button';
        button.onclick=()=>navigate([...state.path,choice.to]);choices.append(button);
      }
      for (let i=1;i<state.path.length;i++) {
        const scene=scenes.get(state.path[i-1]);
        const choice=scene.choices.find(c=>c.to===state.path[i]);
        log.append(element('li',null,choice.label));
      }
      past.hidden=state.path.length<2;pastTitle.textContent='已作的選擇（'+(state.path.length-1)+'）';
      bar.hidden=locked || state.path.length<2;
      reset.hidden=state.path.length<=2;
    }
    return {box,redraw};
  }

  function mount(host,raw,previous,onChange,readonly=false) {
    const data=validate(raw), state=stateFor(data,previous??initial(data));
    const frame=element('div','ea-app'), tools=element('div','ea-tools');
    const redraw=[];
    const refresh=()=>redraw.forEach(fn=>fn());
    function changed() {
      refresh();
      if (onChange) onChange(stateFor(data,state));
    }
    if (data.story) {
      const story=storyCanvas(data.story,state,changed,readonly);frame.append(story.box);redraw.push(story.redraw);
    }
    if (data.points.length) {
      frame.classList.add('ea-with-geometry');
      const scene=geometryCanvas(data,state,changed,readonly);
      frame.append(scene.box); redraw.push(scene.redraw);
    }
    if (data.inputs.length) {
      const knobs=element('div','ea-knobs');
      for (const control of data.inputs) {
        const row=element('label','ea-slider'), name=element('span',null,control.label), value=element('span','ea-val');
        const slider=element('input');
        slider.type='range';slider.min=control.min;slider.max=control.max;slider.step=control.step;
        slider.disabled=readonly;slider.setAttribute('aria-label',control.label);
        slider.oninput=()=>{state.values[control.id]=Number(slider.value);changed();};
        redraw.push(()=>{const v=state.values[control.id];slider.value=String(v);value.textContent=String(v);});
        row.append(name,value,slider);knobs.append(row);
      }
      tools.append(knobs);
    }
    if (data.outputs.length) {
      const values=element('dl','ea-readings');
      for (const out of data.outputs) {
        const item=element('div'), label=element('dt',null,out.label), value=element('dd');
        const evaluate=compile(out.expr,data);
        redraw.push(()=>{
          const n=evaluate(state);
          value.textContent=Number.isFinite(n)?(format(n)+(out.unit=== '°'?'°':out.unit?' '+out.unit:'')):'未能計算';
        });
        item.append(label,value); values.append(item);
      }
      tools.append(values);
    }
    if (data.challenge) {
      const c=data.challenge, evaluate=compile(c.expr,data);
      const task=element('section','ea-task'), prompt=element('p',null,c.prompt), note=element('span','ea-goal');
      note.setAttribute('role','status');task.append(prompt,note);tools.append(task);
      redraw.push(()=>{
        const ok=meets(evaluate(state),c), message=ok?'已達到目標':'尚未達到目標';
        task.dataset.met=String(ok);
        if (note.textContent!==message) note.textContent=message;
      });
    }
    if (tools.childElementCount) frame.append(tools);
    refresh();host.replaceChildren(frame);
    return {read:()=>stateFor(data,state)};
  }
  const numericFormat = new Intl.NumberFormat('zh-HK',{maximumFractionDigits:3});
  function format(n) {
    if (n!==0 && (Math.abs(n)<0.001 || Math.abs(n)>=1e9)) return n.toExponential(3);
    return numericFormat.format(Object.is(n,-0)?0:n);
  }
  const api={validate,initial,answer,mount};
  root.EduStudioApp=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(globalThis);
