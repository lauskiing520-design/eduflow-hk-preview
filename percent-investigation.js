/* Shared classroom model and objective marking for the school magazine investigation. */
(function (root) {
  'use strict';

  const kind = 'priceInvestigation';
  const terms = Object.freeze({
    a: Object.freeze({price:10, pay:80, fee:120}),
    b: Object.freeze({price:12, pay:75, fee:0})
  });
  const sections = {
    quote:['unitA', 'unitB'], model:['formulaA', 'formulaB', 'cross'],
    budget:['maxA', 'maxB'], advice:['counter', 'reason']
  };
  const objective = ['unitA', 'unitB', 'formulaA', 'formulaB', 'cross', 'maxA', 'maxB', 'counter'];
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const int = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
  function requireValue(ok, message) { if (!ok) throw new Error(message); }
  function boundedText(value, max, label, allowEmpty=false) {
    requireValue(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim()), '請核對'+label+'的內容及長度。');
    return value;
  }
  function create(budget=1400) {
    requireValue(int(budget, 800, 5000), '預算須為 800 至 5,000 港元的整數。');
    return {kind, title:'校刊付印：哪家印刷廠划算？',
      instructions:'閱讀兩家印刷廠的報價，為校刊編委會訂出揀選印刷廠的準則，並用數據支持建議。',
      budget};
  }
  function validate(raw) {
    requireValue(record(raw) && raw.kind === kind && has(raw,'budget'), '請核對印刷報價課堂資料。');
    const data = create(raw.budget);
    data.title = boundedText(raw.title, 120, '標題').trim();
    data.instructions = boundedText(raw.instructions, 600, '課堂任務').trim();
    return data;
  }
  function cost(quantity, payA=terms.a.pay, payB=terms.b.pay) {
    requireValue(int(quantity,0,10000), '試印數量須為 0 至 10,000 本的整數。');
    requireValue(int(payA,0,100) && int(payB,0,100), '實付百分率須為 0 至 100 的整數。');
    // Quantity x catalogue dollars x whole percent yields exact cents.
    const a = terms.a.fee*100 + quantity*terms.a.price*payA;
    const b = terms.b.fee*100 + quantity*terms.b.price*payB;
    return {a:a/100, b:b/100, cheaper:a===b?'equal':a<b?'a':'b'};
  }
  function inspection(raw) {
    const spec = validate(raw);
    const unitA = terms.a.price*terms.a.pay/100, unitB = terms.b.price*terms.b.pay/100;
    return {unitA, unitB, cross:(terms.a.fee-terms.b.fee)/(unitB-unitA),
      maxA:Math.floor((spec.budget-terms.a.fee)/unitA), maxB:Math.floor((spec.budget-terms.b.fee)/unitB)};
  }
  function initial() {
    return {unitA:null, unitB:null, formulaA:'', formulaB:'', cross:null, maxA:null, maxB:null,
      counter:null, reason:'', focus:null, trial:{quantity:80,payA:terms.a.pay,payB:terms.b.pay}, first:{}, checks:{}};
  }
  function field(key, value) {
    if (key==='reason') return boundedText(value,500,'採購建議',true);
    if (key==='formulaA' || key==='formulaB') return boundedText(value,120,'總價算式',true);
    if (value===null) return null;
    // Accept decimal responses so a teacher can inspect a tempting non-integer budget answer.
    requireValue(Number.isFinite(value) && Math.abs(value)<=1000000, '請輸入有效數字。');
    return value;
  }
  function state(raw) {
    requireValue(record(raw),'請核對這節課的作答紀錄。');
    const out = initial();
    for (const key of [...objective,'reason']) if (has(raw,key)) out[key]=field(key,raw[key]);
    if (has(raw,'focus') && raw.focus!==null) {
      requireValue(typeof raw.focus==='string' && has(sections,raw.focus),'請選擇目前的任務。');
      out.focus=raw.focus;
    }
    if (has(raw,'trial')) {
      const t=raw.trial;
      requireValue(record(t) && int(t.quantity,1,10000) && int(t.payA,0,100) && int(t.payB,0,100),
        '請核對報價試算的數量和百分率。');
      out.trial={quantity:t.quantity,payA:t.payA,payB:t.payB};
    }
    const first=has(raw,'first')?raw.first:{}, checks=has(raw,'checks')?raw.checks:{};
    requireValue(record(first) && record(checks),'請核對首次作答紀錄。');
    for (const [section, keys] of Object.entries(sections)) {
      if (!has(first,section) && !has(checks,section)) continue;
      requireValue(has(first,section) && record(first[section]) && has(checks,section) && int(checks[section],1,999),
        '首次作答與核對次數不符。');
      out.first[section]={};
      for (const key of keys) {
        requireValue(has(first[section],key),'首次作答紀錄不完整。');
        const value=field(key,first[section][key]);
        requireValue(answered(value),'首次作答紀錄不完整。');
        out.first[section][key]=value;
      }
      out.checks[section]=checks[section];
    }
    return out;
  }
  const answered = value => typeof value==='string' ? Boolean(value.trim()) : value!==null;

  // A small affine-expression parser. Only numbers, one variable, arithmetic,
  // parentheses, implicit multiplication and a percentage postfix are accepted.
  function linear(input, supplier) {
    if (typeof input!=='string' || !input.trim() || input.length>120) return null;
    let s=input.normalize('NFKC').toLowerCase().replace(/\s+/g,'')
      .replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-');
    let namedVariable=null;
    if (s.includes('=')) {
      const [lhs,rhs,...more]=s.split('=');
      if (more.length) return null;
      const label=/^(c|y|f|總價|甲|乙|a|b|c_a|c_b)(?:\(([xn])\))?$/.exec(lhs);
      if (!label) return null;
      const opposite=supplier==='a'?['乙','b','c_b']:['甲','a','c_a'];
      if (opposite.includes(label[1])) return null;
      namedVariable=label[2];
      s=rhs;
    }
    const tokens=s.match(/\d+(?:\.\d+)?|\.\d+|[xn+*/%()-]/g);
    if (!tokens || tokens.join('')!==s) return null;
    if ((tokens.includes('x') || namedVariable==='x') && (tokens.includes('n') || namedVariable==='n')) return null;
    let pos=0;
    const invalid=()=>{throw new Error('invalid expression');};
    const peek=()=>tokens[pos];
    // Encode (ax+b)/d using integers so recognition remains exact for fractions and decimals.
    function reduced(a,b,d) {
      if (d===0n) invalid();
      if (d<0n) { a=-a; b=-b; d=-d; }
      function gcd(u,v) {
        u=u<0n?-u:u;
        while (v) [u,v]=[v,u%v];
        return u;
      }
      const h=gcd(a,gcd(b,d));
      return [a/h,b/h,d/h];
    }
    function atom() {
      const token=tokens[pos++];
      let e;
      if (token==='(') {
        e=sum();
        if (tokens[pos++]!==')') invalid();
      } else if (token==='x' || token==='n') e=[1n,0n,1n];
      else if (/^(?:\d|\.)/.test(token || '')) {
        const [whole,decimals='']=token.split('.');
        e=reduced(0n,BigInt((whole || '0')+decimals),10n**BigInt(decimals.length));
      }
      else invalid();
      if (peek()==='%') { pos++; e=reduced(e[0],e[1],e[2]*100n); }
      return e;
    }
    function signed() {
      if (peek()!=='+' && peek()!=='-') return atom();
      const sign=tokens[pos++]==='-'?-1n:1n;
      const e=signed();
      return [e[0]*sign,e[1]*sign,e[2]];
    }
    function product() {
      let left=signed();
      while (pos<tokens.length) {
        const op=peek();
        if (op==='*' || op==='/') pos++;
        else if (op!=='x' && op!=='n' && op!=='(') break;
        const right=signed();
        if (op==='/') {
          if (right[0]!==0n || right[1]===0n) invalid();
          left=reduced(left[0]*right[2],left[1]*right[2],left[2]*right[1]);
        } else {
          if (left[0]!==0n && right[0]!==0n) invalid();
          left=reduced(left[0]*right[1]+right[0]*left[1],left[1]*right[1],left[2]*right[2]);
        }
      }
      return left;
    }
    function sum() {
      let left=product();
      while (peek()==='+' || peek()==='-') {
        const sign=tokens[pos++]==='-'?-1n:1n, right=product();
        left=reduced(left[0]*right[2]+right[0]*sign*left[2],left[1]*right[2]+right[1]*sign*left[2],
          left[2]*right[2]);
      }
      return left;
    }
    try {
      const result=sum();
      return pos===tokens.length?result:null;
    } catch (_) { return null; }
  }
  function sameLine(formula, unit, fee, supplier) {
    const line=linear(formula,supplier);
    return !!line && line[0]===BigInt(unit)*line[2] && line[1]===BigInt(fee)*line[2];
  }
  function rubric(key,a,v) {
    if (key==='formulaA') return sameLine(a.formulaA,v.unitA,terms.a.fee,'a');
    if (key==='formulaB') return sameLine(a.formulaB,v.unitB,terms.b.fee,'b');
    if (key==='counter') return int(a.counter,1,10000) && cost(a.counter).cheaper==='b';
    return a[key]===v[key];
  }
  function hint(key,a,v,budget) {
    switch (key) {
      case 'unitA': return a.unitA===2?'甲：你計出的是每本扣減的金額。印一本實付的是餘下部分。':'甲：八折是付原單價的八成，起版費另計。';
      case 'unitB': return a.unitB===3?'乙：這是折扣金額。報價單的七五折指實付百分率。':'乙：先把七五折轉成實付百分率，再乘每本原價。';
      case 'formulaA':
        if (!linear(a.formulaA,'a')) return '甲：用 x 代表本數，按「單價 × x + 固定費」寫總價算式。';
        return '甲：起版費整批只付一次。把你的式代入一本和兩本，檢查兩次報價相差多少。';
      case 'formulaB':
        if (!linear(a.formulaB,'b')) return '乙：用 x 代表本數，檢查乘號、括號和變數，再寫總價算式。';
        return '乙：沒有固定費。把一本的實付價乘印量，再試代入兩本。';
      case 'cross': return '分界印量要讓兩式的總價完全相同。每多印一本，兩家的價差改變多少？';
      case 'maxA':
      case 'maxB': {
        const name=key==='maxA'?'甲':'乙', q=a[key], company=key==='maxA'?'a':'b';
        if (!Number.isInteger(q)) return name+'：校刊只能以整本付印。取整後要試算這個本數及下一本。';
        if (q>=1 && q<=10000) {
          if (cost(q)[company]>budget) return name+'：把你填的本數代入報價，總價已超出預算，試少印一本。';
          if (q<10000 && cost(q+1)[company]<=budget) return name+'：試多印一本，總價仍在預算之內。';
        }
        return name+'：先扣起固定費，再用可用的金額除以折後單價。';
      }
      case 'counter':
        if (a.counter===v.cross) return '這個印量兩家同價。編委會需要一個乙廠確實較便宜的例子。';
        return '請選正整數印量，比較兩份總價，找出乙廠確實便宜的一宗訂單。';
    }
  }
  function report(raw,a,section) {
    requireValue(has(sections,section),'請選擇課堂任務。');
    const keys=sections[section], v=inspection(raw);
    const missing=keys.filter(k=>!answered(a[k]));
    const wrong=keys.filter(k=>k!=='reason' && answered(a[k]) && !rubric(k,a,v));
    const feedback=wrong.map(k=>hint(k,a,v,raw.budget));
    if (missing.length) feedback.push(missing.includes('reason')?'請寫下給編委會的建議，交由老師覆核。':'請填妥這項任務的各部分。');
    const complete=!missing.length, correct=complete && !wrong.length;
    if (correct) feedback.push(section==='advice'?'反例的兩份總價已核對。你的解釋會交給老師覆核。':
      section==='quote'?'兩個折後單價都正確。':
      section==='model'?'兩個算式和分界印量都正確。':'兩個本數都在預算內，再加一本便會超支。');
    return {complete,correct,feedback};
  }
  function diagnose(raw,answers,section) { return report(raw,state(answers),section); }
  function remember(a,section) {
    if (!has(a.first,section)) a.first[section]=Object.fromEntries(sections[section].map(k=>[k,a[k]]));
    a.checks[section]=Math.min(999,(a.checks[section] || 0)+1);
  }
  function check(raw,answers,section) {
    const a=state(answers), result=report(raw,a,section);
    if (result.complete) remember(a,section);
    return {...result, answers:a};
  }
  function mergeHistory(raw,previous,incoming) {
    validate(raw);
    const past=state(previous || initial()), next=state(incoming);
    for (const section of Object.keys(past.first)) {
      next.first[section]=past.first[section];
      next.checks[section]=Math.max(past.checks[section],next.checks[section] || 0);
    }
    return next;
  }
  function grade(raw,answers,requireComplete=false) {
    const v=inspection(raw),a=state(answers);
    if (requireComplete) {
      for (const [section,keys] of Object.entries(sections)) {
        requireValue(keys.every(k=>answered(a[k])),'請完成四項任務，並寫下給編委會的建議。');
        if (!has(a.first,section)) remember(a,section);
      }
    }
    const criteria=objective.map(key=>({key,correct:rubric(key,a,v)}));
    const score=criteria.filter(c=>c.correct).length;
    return {answers:a, score, maximum:objective.length, max:objective.length, pendingReview:!!a.reason.trim(), criteria};
  }
  function coach(raw,answers) {
    const spec=validate(raw), v=inspection(spec), a=state(answers);
    const active=a.focus || Object.keys(sections).reverse().find(s=>sections[s].some(k=>answered(a[k])) &&
      sections[s].some(k=>!answered(a[k]) || (k!=='reason' && !rubric(k,a,v)))) ||
      Object.keys(sections).find(s=>sections[s].some(k=>!answered(a[k]))) || 'advice';
    const labels={quote:'還原折後報價',model:'建立總價算式與找分界',budget:'在預算內印最多整本校刊',advice:'反例與採購建議'};
    const observations=[{label:'正在處理',text:labels[active]}], moves=[];
    function see(label,text) { observations.push({label,text}); }
    function ask(id,text) { moves.push({id,text}); }
    function focused(keys) { return keys.find(k=>answered(a[k]) && !rubric(k,a,v)) || keys.find(k=>!answered(a[k])); }
    if (active==='quote') {
      const key=focused(['unitA','unitB']);
      const which=key==='unitB'?'乙':'甲', termsFor=which==='乙'?terms.b:terms.a;
      const savings=termsFor.price*(100-termsFor.pay)/100;
      if (key && answered(a[key])) see('你填的折後單價',which+'廠每本 '+a[key]+' 元');
      if (key && a[key]===savings) {
        ask('paid-or-saved','你算出的金額是印一本要付的錢，還是比原價少付的錢？你會如何用兩者驗算？');
        ask('split-catalogue','試把一本的原價分成「要付」和「省下」兩部分。你的數字填在哪一格？');
      } else {
        ask('translate-discount','用一句話把'+which+'廠的折扣讀成「每 100 元付多少元」。你會用哪個百分率乘原價？');
        ask('estimate-unit','先估計一本校刊折後會接近原價，還是接近零元。哪個估計跟報價單吻合？');
      }
    } else if (active==='model') {
      const key=focused(['formulaA','formulaB','cross']);
      if (key==='formulaA' || key==='formulaB') {
        const which=key==='formulaA'?'甲':'乙', parsed=linear(a[key],which==='甲'?'a':'b');
        if (answered(a[key])) see('你寫的'+which+'廠算式',parsed?a[key]:'尚未能讀成一條一次式');
        if (which==='甲' && parsed && parsed[1]===0n) {
          ask('one-setup','印同一批校刊，印一本和印兩本各要付幾次起版費？你的式子把這筆費用放在哪裏？');
          ask('compare-invoices','把甲廠的報價分為「整張訂單」與「每本」兩欄。哪一欄才需要乘本數？');
        } else {
          ask('check-two-orders','把一本和兩本分別代入'+which+'廠的算式。兩個結果相差的金額，應對應報價單的哪一項？');
          ask('slope-and-intercept','如果把這條總價線延長到縱軸，截距代表甚麼費用？斜率又代表甚麼？');
        }
      } else {
        if (int(a.cross,1,10000)) {
          const at=cost(a.cross);
          see('你估的分界',a.cross+' 本時，甲收 '+at.a+' 元，乙收 '+at.b+' 元');
        }
        ask('equal-invoices','把兩個總價式寫在等號兩邊。每多印一本，甲乙的總價差會擴大還是收窄？');
        ask('bracket-crossing','試找一個甲較貴和一個乙較貴的印量。你可以怎樣把兩者之間的搜尋範圍收窄？');
      }
    } else if (active==='budget') {
      see('這張訂單的預算',spec.budget+' 港元');
      const key=focused(['maxA','maxB']) || 'maxA', which=key==='maxA'?'甲':'乙', company=key==='maxA'?'a':'b', q=a[key];
      if (q!==null) see('你填的印量',which+'廠 '+q+' 本');
      if (q!==null && !Number.isInteger(q)) {
        ask('whole-books','校刊按整本交貨。你會比較哪兩個相鄰的整數，才知道哪一個可以付印？');
        ask('round-test','如果按四捨五入揀本數，會否超支？你會怎樣用報價單檢查？');
      } else if (int(q,1,10000) && cost(q)[company]>spec.budget) {
        see('按原報價試算',which+'廠訂單已超出預算');
        ask('over-budget','這個印量的總價超出預算。你會先從預算扣起甚麼，再計算可用於逐本印刷的金額？');
        ask('lower-and-check','把印量調低，再核對兩個相鄰的總價。預算應落在這兩個總價的哪一側？');
      } else if (int(q,1,9999) && cost(q+1)[company]<=spec.budget) {
        see('按原報價試算','在你填的本數上再加一本，仍未超支');
        ask('one-more','你已找到一個付得起的印量。怎樣證明它是最多，而不是其中一個可行答案？');
        ask('money-left','算出這張訂單尚餘的預算。餘款與多印一本的費用相比如何？');
      } else {
        ask('reserve-fee','在'+which+'廠的預算表把固定費用獨立列出。剩餘款項可以買甚麼？');
        ask('maximum-proof','交建議前，要用哪兩個相鄰本數的報價證明「最多」？');
      }
    } else {
      if (int(a.counter,1,10000)) {
        const at=cost(a.counter);
        see('你選的反例',a.counter+' 本時，甲收 '+at.a+' 元，乙收 '+at.b+' 元');
        if (at.cheaper==='equal') {
          ask('tie-not-strict','你找到兩廠同價的訂單。怎樣改動本數，才可以測試乙廠有沒有嚴格便宜？');
          ask('side-of-crossing','在這個印量兩旁各試一張訂單。兩邊誰的總價較低？');
        } else if (at.cheaper==='a') {
          ask('opposite-winner','你舉的訂單支持了甲廠的廣告。在哪一段印量，起版費可能比單價差更重要？');
          ask('short-order','保持兩廠原報價，改成一張較小的訂單。哪項費用佔總價的比例變大？');
        }
      }
      if (!moves.length) {
        ask('support-purchase','如果編委質疑你的選擇，你會引用同一本數下的哪兩個總價來說明？');
        ask('boundary-policy','你的採購準則有沒有分開處理分界以下、剛好分界和分界以上的訂單？');
      }
    }
    const {quantity,payA,payB}=a.trial;
    if (payA!==terms.a.pay || payB!==terms.b.pay) {
      see('目前試算條件',quantity+' 本，甲實付 '+payA+'%，乙實付 '+payB+'%');
      ask('compare-original-terms','你改動了試算折扣。要用這組結果向編委解釋原來的兩份報價，哪一些條件要先還原？');
    } else if (quantity!==80 && active!=='quote') {
      const at=cost(quantity);
      see('目前試算訂單',quantity+' 本，甲收 '+at.a+' 元，乙收 '+at.b+' 元');
      ask('contrast-order','保留報價，只把印量改動一本。兩家總價的變動有何不同？這能怎樣支持你的說法？');
    }
    // Only observations on the selected task and vetted questions leave the lesson engine.
    // Private free-text recommendations and unchecked symbolic strings never reach the model.
    return {kind,observations,moves};
  }
  const api={kind,terms,create,validate,project:validate,cost,inspection,initial,state,diagnose,check,mergeHistory,grade,coach};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.EduInvestigation=api;
})(globalThis);
