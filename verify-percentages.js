/* Recalculate a recognised percentage question from its current wording. */
(() => {
  'use strict';

  const decimal = '[0-9]{1,9}(?:\\.[0-9]{1,6})?';
  const discount = '(?:十|[零一二三四五六七八九]{1,2}|[0-9]{1,2}(?:\\.[0-9])?)';
  const units = new Map([['$', '$'], ['HK$', '$'], ['HKD', '$'], ['元', '$'], ['港元', '$'],
    ['%', '%'], ['袋', '袋'], ['張', '張'], ['人','人']]);
  const fail = note => ({status:'invalid', computed:'', steps:[], note});
  const review = (computed, steps, note) => ({status:'unsupported', computed, steps, note});
  const normalize = s => String(s ?? '').normalize('NFKC').replace(/−/g, '-').trim();
  const stripSpaces = s => normalize(s).replace(/\s/g, '');

  // Exact decimal inputs, ratios, and ceiling divisions even at whole-unit boundaries.
  class Ratio {
    constructor(n, d=1n) {
      if (!d) throw new RangeError('分母不能是零。');
      if (d < 0n) { n = -n; d = -d; }
      let a = n < 0n ? -n : n, b = d;
      while (b) [a, b] = [b, a % b];
      this.n = n/a;
      this.d = d/a;
    }
    static read(raw) {
      const [whole, digits=''] = String(raw).split('.');
      return new Ratio(BigInt(whole+digits), 10n**BigInt(digits.length));
    }
    add(v) { return new Ratio(this.n*v.d+v.n*this.d, this.d*v.d); }
    sub(v) { return new Ratio(this.n*v.d-v.n*this.d, this.d*v.d); }
    mul(v) { return new Ratio(this.n*v.n, this.d*v.d); }
    div(v) { return new Ratio(this.n*v.d, this.d*v.n); }
    eq(v) { return this.n === v.n && this.d === v.d; }
    abs() { return new Ratio(this.n<0n ? -this.n : this.n, this.d); }
    round(digits) {
      const scale = 10n**BigInt(digits);
      return new Ratio((2n*this.abs().n*scale+this.d)/(2n*this.d)*(this.n<0n?-1n:1n), scale);
    }
    toString() {
      let d = this.d;
      while (d%2n === 0n) d /= 2n;
      while (d%5n === 0n) d /= 5n;
      if (d !== 1n) return this.n+'/'+this.d;
      let remainder=this.abs().n%this.d, fraction='';
      while (remainder) {
        fraction += remainder*10n/this.d;
        remainder = remainder*10n%this.d;
      }
      return (this.n<0n?'-':'')+String(this.abs().n/this.d)+(fraction?'.'+fraction:'');
    }
  }
  const one = Ratio.read('1'), hundred = Ratio.read('100'), twelve = Ratio.read('12');
  const rates = value => value.div(hundred);
  const percent = (part, total) => part.div(total).mul(hundred);
  const value = (amount, unit, steps) => ({amount, unit, steps});
  const show = (n, unit) => unit==='$' ? n+' 元' : n+(!unit || unit==='%'?unit:' '+unit);
  const positive = v => v.n>0n;
  const share = v => v.n>=0n && v.n<=100n*v.d;
  const natural = v => v.d===1n && v.n>=0n;
  function discountRate(raw) {
    if (raw === '十') return one;
    const digits = raw.replace(/[零一二三四五六七八九]/g, c=>'零一二三四五六七八九'.indexOf(c));
    // 8 折、8.5 折及八五折分別代表 80%、85% 及 85%。
    const divisor = digits.includes('.') || digits.length===1 || digits==='10' ? '10' : '100';
    return Ratio.read(digits).div(Ratio.read(divisor));
  }

  const rules = [];
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function rule(template, solve) {
    const parts = stripSpaces(template).split(/(\{\w+\})/);
    const expression = parts.map(part=>{
      if (!part.startsWith('{')) return escape(part);
      const name=part.slice(1,-1);
      const type = name==='fold' ? discount : name==='direction' ? '[增減]' : decimal;
      return '(?<'+name+'>'+type+')';
    }).join('');
    rules.push({expression:new RegExp('^'+expression+'$','u'), solve});
  }
  function base({total, part}) {
    if (!natural(total) || !natural(part) || !positive(total) || part.sub(total).n>0n)
      return fail('總數須為正整數，部分數量不能超過總數。');
    return value(percent(part,total), '%', ['以總數 '+total+' 為基數。', part+' ÷ '+total+' × 100%。']);
  }
  function reverse({price, rate}, increase) {
    const multiplier=increase?one.add(rates(rate)):one.sub(rates(rate));
    if (!positive(multiplier)) return fail('這個折減幅度不能用來倒推唯一的原價。');
    return value(price.div(multiplier), '$', ['變動後金額是原來的 '+multiplier+' 倍。', '原來金額 = '+price+' ÷ '+multiplier+'。']);
  }
  function consecutive({up, down, direction}, upFirst) {
    if (!share(down)) return fail('減少的幅度不能超過原量的 100%。');
    const first=one.add(rates(up)), second=one.sub(rates(down));
    const change=first.mul(second).sub(one).mul(hundred);
    const steps=['以最初的量為 100，先後乘 '+(upFirst?first+' 和 '+second:second+' 和 '+first)+'。',
      '最後為 '+hundred.add(change)+'，相對最初'+(change.n<0n?'減少 ':'增加 ')+change.abs()+'%。'];
    if ((direction==='減' && change.n>0n) || (direction==='增' && change.n<0n))
      return {...fail('題幹所問的增減方向與計算結果相反。'), computed:change.abs()+'%（'+(change.n<0n?'減少':'增加')+'）',steps};
    return value(change.abs(), '%', steps);
  }
  function cashDiscount({price, coupon, fold, rate}, cashFirst) {
    const multiplier=fold ?? one.sub(rates(rate));
    if (multiplier.n<0n || multiplier.sub(one).n>0n) return fail('折扣後的乘數應在 0 與 1 之間。');
    const payable=cashFirst?price.sub(coupon).mul(multiplier):price.mul(multiplier).sub(coupon);
    if (payable.n<0n) return fail('現金優惠高於可付款金額，請核對條件。');
    return value(payable, '$', cashFirst
      ? ['先扣現金券，餘額為 '+price+' − '+coupon+' = '+price.sub(coupon)+' 元。','再以餘額乘 '+multiplier+'。']
      : ['先按 '+multiplier+' 倍付款，折後為 '+price.mul(multiplier)+' 元。','再扣減 '+coupon+' 元。']);
  }
  function profitOnCost({price,cost,loss}) {
    const baseCost=cost ?? price.add(loss), difference=loss ?? price.sub(baseCost);
    if (!positive(baseCost) || difference.n<0n) return fail('請核對成本以及題目所指的盈虧方向。');
    return value(percent(difference,baseCost),'%',['成本為 '+baseCost+' 元，'+(loss?'虧損':'盈利')+'為 '+difference+' 元。',
      '以成本為基數，'+difference+' ÷ '+baseCost+' × 100%。']);
  }
  function tagPrice({cost, profit, rate, fold}) {
    const multiplier=fold ?? one.sub(rates(rate)), target=cost.mul(one.add(rates(profit)));
    if (!positive(multiplier) || multiplier.sub(one).n>0n) return fail('請核對折扣，現有條件不能倒推出唯一標價。');
    return value(target.div(multiplier),'$',['目標售價 = '+cost+' × (1 + '+profit+'%) = '+target+' 元。',
      '標價 = '+target+' ÷ '+multiplier+'。']);
  }
  function rateChange({start,end}, increase) {
    if (!share(start) || !share(end) || !positive(start)) return fail('比率應介乎 0% 和 100%；起始比率須大於零才可計算相對變幅。');
    const difference=increase?end.sub(start):start.sub(end);
    if (difference.n<=0n) return fail('起始和結束比率與題目所說的升跌方向不符。');
    const relative=percent(difference,start);
    return {pair:[difference,relative],increase,
      computed:difference+' 個百分點，相對'+(increase?'增幅':'減幅')+' '+relative+'%',
      steps:['兩個比率相減，相差 '+difference+' 個百分點。','以原比率為基數，'+difference+' ÷ '+start+' × 100% = '+relative+'%。']};
  }
  function weighted({a,b,r,s}, rounding) {
    if (!natural(a) || !natural(b) || !positive(a.add(b)) || !share(r) || !share(s))
      return fail('兩組樣本數應為非負整數，總數須大於零，組內百分率應在 0% 至 100% 之間。');
    const first=a.mul(rates(r)), second=b.mul(rates(s)), total=a.add(b);
    if (!natural(first) || !natural(second)) return fail('這些百分率換算出非整數人數或件數。請核對數據，或說明是否使用約數。');
    const result=percent(first.add(second),total);
    const steps=['兩組數量分別是 '+a+' × '+r+'% = '+first+' 和 '+b+' × '+s+'% = '+second+'。',
      '整體比率 = ('+first+' + '+second+') ÷ '+total+' × 100%。'];
    if (rounding) steps.push('按題意把百分數取至一位小數。');
    return value(rounding?result.round(1):result, '%', steps);
  }
  function interest({principal, rate, months, earned}) {
    const time=months.div(twelve), factor=rates(rate).mul(time);
    if (!positive(months) || (!principal && !positive(factor))) return fail('請核對存期和利率，現有條件不能求出所問金額。');
    const result=principal?principal.mul(factor):earned.div(factor);
    return value(result,'$',['存期 '+months+' 個月 = '+time+' 年。',principal
      ? '利息 = '+principal+' × '+rate+'% × '+time+'。' : '本金 = '+earned+' ÷ ('+rate+'% × '+time+')。']);
  }
  function compareShops({price,fold,rate,fee,coupon}) {
    const multiplier=fold ?? one.sub(rates(rate));
    if (multiplier.n<0n || multiplier.sub(one).n>0n || coupon.sub(price).n>0n) return fail('請核對兩個方案的優惠金額。');
    const left=price.mul(multiplier).add(fee??Ratio.read('0')), right=price.sub(coupon);
    return value(left.sub(right).abs(),'$',['第一個方案實付 '+left+' 元，第二個方案實付 '+right+' 元。','兩個實付金額相減，取差額。']);
  }
  function breakEven({price,cost,fee,fixed}, unit) {
    const net=price.mul(one.sub(rates(fee))).sub(cost);
    if (!share(fee)) return fail('請核對平台費佔售價的百分比。');
    if (!fixed.n) return value(fixed,unit,['固定開支為 0 元，毋須售出貨品來抵銷開支。']);
    if (!positive(net)) return fail('每件扣除成本及平台費後未有正收益，請核對能否抵銷固定開支。');
    const count=fixed.div(net), needed=new Ratio((count.n+count.d-1n)/count.d);
    return value(needed,unit,['每'+unit+'可抵銷 '+price+' × (1 − '+fee+'%) − '+cost+' = '+net+' 元。',
      '固定開支 '+fixed+' ÷ '+net+' = '+count+'，按整'+unit+'計最少要 '+needed+' '+unit+'。']);
  }
  function upAndDown({start,peak,end}, rounded) {
    if (!positive(start) || peak.sub(start).n<=0n || end.sub(peak).n>=0n) return fail('價格與題幹所指的升跌方向不符。');
    const up=percent(peak.sub(start),start),down=percent(peak.sub(end),peak);
    const computed='升幅 '+(rounded?up.round(1):up)+'%，跌幅 '+(rounded?down.round(1):down)+'%';
    return review(computed,['升幅以 '+start+' 元為基數；跌幅以 '+peak+' 元為基數。',computed+'。'],
      '已獨立計算兩個比率。請核對參考答案的判斷及解釋。');
  }
  function markupClaim({cost,markup,quoted}, rounded) {
    const base=cost??hundred;
    if (!positive(base)) return fail('成本必須大於零才能比較兩個基數。');
    const profit=base.mul(rates(markup)), sell=base.add(profit), portion=percent(profit,sell);
    const computed='盈利佔售價 '+(rounded?portion.round(1):portion)+'%';
    return review(computed,['以成本 '+base+' 元計，盈利為 '+profit+' 元，售價為 '+sell+' 元。',
      '把 '+profit+' ÷ '+sell+' × 100% 與說法中的 '+quoted+'% 比較。'],
      '已獨立計算盈利佔售價的比率。請核對參考答案的判斷及解釋。');
  }

  rule('書展售出{total}本書，其中{part}本是小說。小說佔多少百分比？填百分數數值。',base);
  rule('合唱團共有{total}人，其中{part}人是新團員。新團員佔多少百分比？',base);
  rule('借出的圖書共{total}本，當中科普書有{part}本。求科普書佔總數的百分比。',base);
  rule('參加校際比賽的學生共{total}名，當中參加接力的學生有{part}名。求參加接力的學生佔總數的百分比。',base);
  rule('球鞋減價{rate}%後售{price}元。原價多少元？',v=>reverse(v,false));
  rule('電費加價{rate}%後為{price}元，用量不變。加價前是多少元？',v=>reverse(v,true));
  rule('書包減價{rate}%後售{price}元。原價是多少元？',v=>reverse(v,false));
  rule('月費上調{rate}%後為{price}元。舊月費是多少元？',v=>reverse(v,true));
  rule('數量先增加{up}%再減少{down}%。相對原來淨增加多少百分比？',v=>consecutive({...v,direction:'增'},true));
  rule('數量先增加{up}%再減少{down}%。相對原來淨減少多少百分比？',v=>consecutive({...v,direction:'減'},true));
  rule('材料先減重{down}%，再吸水增重{up}%。相對最初淨增加多少百分比？',v=>consecutive({...v,direction:'增'},false));
  rule('材料先減重{down}%，再吸水增重{up}%。相對最初淨減少多少百分比？',v=>consecutive({...v,direction:'減'},false));
  rule('單車徑的每日人流先增加{up}%，其後再減少{down}%。與最初相比，淨{direction}幅是多少百分比？',v=>consecutive(v,true));
  rule('某書店的訂單數目先減少{down}%，下一期再增加{up}%。與最初相比，淨{direction}幅是多少百分比？',v=>consecutive(v,false));
  rule('貨品標價{price}元，先用{coupon}元現金券，再按餘額{fold}折付款。實付多少元？',v=>cashDiscount(v,true));
  rule('訂單{price}元先打{fold}折，再扣{coupon}元積分。最後應付多少元？',v=>cashDiscount(v,false));
  rule('書店訂單共{price}元，先扣{coupon}元現金券，再按餘額減價{rate}%。最後應付多少元？',v=>cashDiscount(v,true));
  rule('畫具定價{price}元，先減價{rate}%，再扣{coupon}元電子禮券。最後應付多少元？',v=>cashDiscount(v,false));
  rule('相機配件售價{price}元，成本{cost}元。盈利佔成本百分之幾？',profitOnCost);
  rule('一批花以{price}元出售，較成本虧損{loss}元。虧損佔成本百分之幾？',profitOnCost);
  rule('模型成本為{cost}元，以{price}元售出。盈利相對成本是多少百分比？',profitOnCost);
  rule('一批飾物以{price}元清貨，合共虧損{loss}元。虧損佔成本的百分比是多少？',profitOnCost);
  rule('店主希望{fold}折出售後仍較成本{cost}元多賺{profit}%。標價應為多少元？',tagPrice);
  rule('貨品成本為{cost}元，優惠期提供{fold}折，目標是仍賺成本的{profit}%。標價多少元？',tagPrice);
  rule('運動背囊的成本是{cost}元。店主準備按標價減價{rate}%，並要賺取成本的{profit}%。應定價多少元？',tagPrice);
  rule('旅行水樽的成本是{cost}元。店主準備按標價減價{rate}%，並要賺取成本的{profit}%。應定價多少元？',tagPrice);
  rule('到課率由{start}%升至{end}%。寫出增加的百分點及相對增幅。',v=>rateChange(v,true));
  rule('不合格率由{start}%降至{end}%。寫出下降的百分點及相對減幅。',v=>rateChange(v,false));
  rule('回收率由{start}%上升至{end}%。寫出相差的百分點，以及相對原來的增幅。',v=>rateChange(v,true));
  rule('缺貨率由{start}%下降至{end}%。寫出相差的百分點，以及相對原來的減幅。',v=>rateChange(v,false));
  rule('甲店退貨率{r}%，售出{a}件；乙店退貨率{s}%，售出{b}件。整體退貨率是多少百分比？',v=>weighted(v,false));
  rule('早場{a}名觀眾有{r}%滿意，晚場{b}名有{s}%滿意。整體滿意率是多少百分比？',v=>weighted(v,false));
  rule('甲店售出{a}件貨品，退貨率為{r}%；乙店售出{b}件，退貨率為{s}%。合計兩店的退貨率是多少？百分數取至小數點後一位。',v=>weighted(v,true));
  rule('甲場有{a}人填寫問卷，滿意率為{r}%；乙場有{b}人填寫，滿意率為{s}%。合計兩場的滿意率是多少？百分數取至小數點後一位。',v=>weighted(v,true));
  rule('本金{principal}元按年單利{rate}%存{months}個月。利息多少元？',interest);
  rule('某筆存款按年單利{rate}%存了{months}個月，獲利息{earned}元。求本金（元）。',interest);
  rule('將{principal}元存入銀行，按年單利{rate}%計息，存期為{months}個月。利息是多少元？',interest);
  rule('某筆存款按年單利{rate}%計息，存了{months}個月後利息為{earned}元。求本金。',interest);
  rule('甲店定價{price}元打{fold}折；乙店同價減{coupon}元。較便宜的方案可省多少元？',compareShops);
  rule('網店售{price}元商品打{fold}折另加{fee}元運費；實體店原價相同減{coupon}元。較便宜的方案可省多少元？',compareShops);
  rule('同一套教材兩店標價均為{price}元。甲店減價{rate}%；乙店直接扣減{coupon}元。兩店沒有其他收費。選較便宜的一店可省多少元？',compareShops);
  rule('同一套教材兩店標價均為{price}元。甲店減價{rate}%，另收運費{fee}元；乙店直接扣減{coupon}元。兩店沒有其他收費。選較便宜的一店可省多少元？',compareShops);
  rule('有同學說售價從{start}元升至{peak}元，再降至{end}元，升幅和跌幅一樣。判斷並解釋。',v=>upAndDown(v,false));
  rule('有人說每件貨以成本加價{markup}%出售，所以利潤佔售價{quoted}%。判斷並用例子解釋。',v=>markupClaim(v,false));
  rule('門票由{start}元加至{peak}元，後來回復至{end}元。小美說：「前後相差的金額相同，所以升幅和跌幅也相同。」判斷並計算兩個百分率，取至小數點後一位。',v=>upAndDown(v,true));
  rule('畫框成本{cost}元，店主按成本加價{markup}%出售。小文說：「每收取100元售價，當中有{quoted}元是盈利。」判斷並以盈利佔售價的百分比解釋，百分數取至小數點後一位。',v=>markupClaim(v,true));
  rule('每袋餅成本{cost}元，售價{price}元；當中{fee}%售價用作平台費。要抵銷固定攤租{fixed}元，須售出多少袋？',v=>breakEven(v,'袋'));
  rule('義賣每張卡售{price}元，須撥出售價的{fee}%支付平台費，每張製作費{cost}元。要抵銷印版費{fixed}元，須售出多少張？',v=>breakEven(v,'張'));
  rule('義賣每袋果仁售{price}元，製作成本{cost}元，平台另收售價的{fee}%作手續費。要付清{fixed}元固定攤租，最少要售出多少袋？',v=>breakEven(v,'袋'));
  rule('義賣每張心意卡售{price}元，製作成本{cost}元，平台另收售價的{fee}%作手續費。要付清{fixed}元固定攤租，最少要售出多少張？',v=>breakEven(v,'張'));

  rule('求{total}的{rate}%。',({total,rate})=>value(total.mul(rates(rate)),'',[total+' × '+rate+' ÷ 100。']));
  function directDiscount({price,rate}) {
    if (!share(rate)) return fail('減價幅度應在 0% 至 100% 之間。');
    return value(price.mul(one.sub(rates(rate))),'$',['折後金額 = '+price+' × (1 − '+rate+'%)。']);
  }
  rule('一件貨品原價${price}，減價{rate}%後的售價是多少？',directDiscount);
  rule('一件貨品原價{price}元，減價{rate}%後售價是多少元？',directDiscount);
  rule('一件貨品的價格由${start}增至${end}。求增加百分率。請以百分數作答。',({start,end})=>{
    if (!positive(start) || end.sub(start).n<0n) return fail('請核對原價及題目所說的增幅。');
    return value(percent(end.sub(start),start),'%',['差額 '+end+' − '+start+'，再除以原價 '+start+' 並乘 100%。']);
  });
  rule('一件外套原價${price}，先減價{rate}%，再按減價後的價錢打{fold}折。求最後售價，並寫出過程。',({price,rate,fold})=>{
    if (!share(rate) || !positive(fold) || fold.sub(one).n>0n) return fail('請核對兩次折扣。');
    return {...value(price.mul(one.sub(rates(rate))).mul(fold),'$',['先後按 (1 − '+rate+'%) 和 '+fold+' 倍計算。']),manual:'列式過程另由老師核對。'};
  });
  rule('一件貨品原價${price}，先加價{up}%，再減價{down}%。求最後售價，並解釋為何不等於原價。',({price,up,down})=>{
    if (!share(down)) return fail('減幅不能超過 100%。');
    const answer=price.mul(one.add(rates(up))).mul(one.sub(rates(down)));
    if (answer.eq(price)) return fail('按此數據最後售價等於原價，請核對題幹的解釋要求。');
    return {...value(answer,'$',['先加價至 '+price.mul(one.add(rates(up)))+' 元，再按新基數減價 '+down+'%。']),manual:'基數的解釋另由老師核對。'};
  });
  rule('一件外套先減價{rate}%，再用${coupon}優惠券，實付${price}。原價是多少元？',({rate,coupon,price})=>{
    const res=reverse({price:price.add(coupon),rate},false);
    res.steps.unshift('先把優惠券 '+coupon+' 元加回實付金額。');
    return res;
  });
  rule('貨品按成本加價{markup}%作標價，其後按標價{fold}折出售。盈利佔成本百分之幾？只填百分數的數值。',({markup,fold})=>{
    if (!positive(fold) || fold.sub(one).n>0n) return fail('請核對折扣。');
    return profitOnCost({price:hundred.add(markup).mul(fold),cost:hundred});
  });
  rule('某會所會員人數先增加{up}%，翌年減少{down}%，現有{members}人。兩年前有多少人？',({up,down,members})=>{
    const factor=one.add(rates(up)).mul(one.sub(rates(down)));
    if (!positive(factor) || !natural(members)) return fail('這組數據無法倒推出原來的人數。');
    const old=members.div(factor);
    if (!natural(old) || !natural(old.mul(one.add(rates(up))))) return fail('根據這組數據，人數並非整數。');
    return value(old,'人',['現有人數是原來的 (1 + '+up+'%) × (1 − '+down+'%) 倍。',members+' ÷ '+factor+'。']);
  });
  rule('甲班{a}人中{r}%合格，乙班{b}人中{s}%合格。兩班合計的合格百分率是多少？只填數值。',v=>weighted(v,false));

  // Common teacher-written forms. Each pattern consumes every fact and the final question.
  const ordinaryRules = [];
  const noun = '(?:(?:一(?:件|個|對|雙|本|部|臺|台|套|款)|這件|這個|某件|某個|某)?' +
    '(?:商品|貨品|產品|物品|貨物|書包|背包|球鞋|運動鞋|外套|毛衣|上衣|衣服|裙子|課本|圖書|玩具|手機|電腦|耳機|鉛筆盒|文具盒|單車|手袋|水樽|水杯|門票))?';
  const clause = '[,;:。]?';
  const oldPriceQuestion = '(?:求(?:出)?(?:它的|其)?原價|(?:原價|原來的售價)(?:是|為)?多少(?:錢|元)?)';
  const newPriceQuestion = '(?:求(?:出)?(?:商品的)?(?:折後價|折後售價|現價|售價)|(?:折後價|折後售價|現價|售價|實付)(?:是|為)?多少(?:錢|元)?)';
  const paid = '(?:折後(?:的)?(?:價格|價錢|售價|價)|現價|售價|現售|售)(?:為|是)?';
  const price = '(?<price>'+decimal+')元';
  const rate = '(?<rate>'+decimal+')%';
  const fold = '(?<fold>'+discount+')折';
  const percentageQuery = '(?:百分之幾|多少(?:百分比|百分率))';
  const optionalPlease = '(?:請)?';
  function ordinary(source, solve) {
    ordinaryRules.push({expression:new RegExp('^'+source+'[?。.!]?$','u'), solve});
  }
  function reverseFold({price,fold}) {
    if (!positive(fold) || fold.sub(one).n>0n) return fail('這個折扣無法用來倒推唯一原價。');
    return value(price.div(fold),'$',['折後金額是原價的 '+fold+' 倍。','原價 = '+price+' ÷ '+fold+'。']);
  }
  ordinary(noun+'(?:打|以)'+fold+'(?:出售)?'+clause+paid+price+clause+optionalPlease+oldPriceQuestion,reverseFold);
  ordinary(noun+'(?:減價|降價|減售)'+rate+'(?:後)?'+clause+paid+price+clause+optionalPlease+oldPriceQuestion,v=>reverse(v,false));
  ordinary(noun+'(?:加價|漲價)'+rate+'(?:後)?'+clause+paid+price+clause+optionalPlease+oldPriceQuestion,v=>reverse(v,true));
  ordinary(noun+'(?:的)?原價(?:是|為)?'+price+clause+'(?:現在|現)?(?:減價|降價)'+rate+'(?:後)?'+clause+optionalPlease+newPriceQuestion,directDiscount);
  ordinary(noun+'(?:的)?原價(?:是|為)?'+price+clause+'(?:現在|現)?打'+fold+'(?:後)?'+clause+optionalPlease+newPriceQuestion,({price,fold})=>{
    if (fold.n<0n || fold.sub(one).n>0n) return fail('請核對折扣。');
    return value(price.mul(fold),'$',['折後價 = 原價 '+price+' × '+fold+'。']);
  });
  const total='(?<total>'+decimal+')', part='(?<part>'+decimal+')';
  ordinary('(?:全班|班內)(?:共有|有|共)'+total+'(?:名學生|人|個學生)'+clause+'其中(?:有)?'+part+
    '(?:名|個|人是)(?<group>女生|男生|新生|新同學)'+clause+'(?:請問|問)?\\k<group>佔(?:全班|全體學生)(?:的)?'+percentageQuery,
    base);
  ordinary('(?:共有|有)'+total+'本書'+clause+'其中(?:有)?'+part+'本(?:是|為)(?<group>小說|故事書|科普書|工具書)'+clause+
    '(?:請問|問)?\\k<group>佔(?:總數|全部圖書|所有圖書)(?:的)?'+percentageQuery,base);
  ordinary(part+'(?:佔|是)'+total+'(?:的)?'+percentageQuery,({part,total})=>
    positive(total)?value(percent(part,total),'%',[part+' ÷ '+total+' × 100%。']):fail('基數須大於零。'));
  ordinary('(?:求|計算)'+total+'的'+rate,({total,rate})=>value(total.mul(rates(rate)),'',[total+' × '+rate+' ÷ 100。']));
  ordinary(total+'的'+rate+'(?:是|為|等於)?多少',({total,rate})=>value(total.mul(rates(rate)),'',[total+' × '+rate+' ÷ 100。']));
  function priceChange({start,end}, increase) {
    if (!positive(start)) return fail('百分率的原來基數須大於零。');
    const delta=increase?end.sub(start):start.sub(end);
    if (delta.n<0n) return fail('金額的變動方向與題目所問的增減相反。');
    return value(percent(delta,start),'%',['差額為 '+delta+' 元。','以原價 '+start+' 元為基數，'+delta+' ÷ '+start+' × 100%。']);
  }
  const priceFrom = noun+'(?:的)?(?:價格|售價|價錢)?(?:由|從)(?<start>'+decimal+')元';
  const priceEnd = '(?<end>'+decimal+')元'+clause;
  ordinary(priceFrom+'(?:增加至|上升至|升至|增至)'+priceEnd+'(?:請)?(?:求|計算)(?:升幅|增幅|增加百分率)(?:的百分比)?',v=>priceChange(v,true));
  ordinary(priceFrom+'(?:減少至|下降至|降至|跌至)'+priceEnd+'(?:請)?(?:求|計算)(?:跌幅|減幅|減少百分率)(?:的百分比)?',v=>priceChange(v,false));

  const simplified = {后:'後',价:'價',减:'減',书:'書',货:'貨',产:'產',这:'這',个:'個',双:'雙',对:'對',几:'幾',运:'運',
    动:'動',课:'課',图:'圖',机:'機',脑:'腦',铅:'鉛',笔:'筆',单:'單',门:'門',卖:'賣',实:'實',为:'為',钱:'錢',现:'現',
    涨:'漲',来:'來',数:'數',总:'總',内:'內',学:'學',说:'說',问:'問',请:'請',计:'計',从:'從',达:'達',与:'與',币:'幣',占:'佔'};
  function ordinaryText(text) {
    const traditional=text.replace(/[\u3400-\u9fff]/gu,c=>simplified[c]??c);
    return traditional.replace(/(?:HK\$|HKD|港幣|\$)([0-9]+(?:\.[0-9]+)?)(?:港元|元)?/gi,'$1元').replaceAll('港元','元');
  }

  const numberWithUnit = new RegExp('^(HK\\$|HKD|\\$)?([+-]?'+decimal+'(?:/'+decimal+')?)(港元|元|%|袋|張|人)?$','i');
  function readNumber(raw) {
    const [numerator, denominator] = raw.split('/').map(Ratio.read);
    if (denominator && !denominator.n) return null;
    return denominator ? numerator.div(denominator) : numerator;
  }
  function confirmNumber(result, q) {
    const computed = show(result.amount,result.unit), {steps} = result;
    const source = q.referenceAnswer !== undefined ? q.referenceAnswer : q.expected;
    const raw=normalize(source);
    const match=raw.length<=90 && !/\d\s+\d/.test(raw) && numberWithUnit.exec(stripSpaces(raw));
    if (!match || (match[1] && match[3] && units.get(match[3])!=='$'))
      return review(computed,steps,'請填寫一個參考數值和相應單位，再次驗算。');
    const reference = readNumber(match[2]), answerUnit = units.get(match[1]?.toUpperCase() || match[3]);
    if (!reference) return review(computed,steps,'參考答案的分母不能是零。');
    if ((answerUnit && answerUnit!==result.unit) || (q.unit && units.get(stripSpaces(q.unit))!==result.unit))
      return {status:'mismatch',computed,steps,note:'參考答案或設定的單位與題目所問的量不同。'};
    return {status:reference.eq(result.amount)?'match':'mismatch', computed, steps, ...(result.manual?{note:result.manual}:{})};
  }
  function confirmPair(result, q) {
    const {computed,steps,increase,pair} = result;
    // A teacher-edited solution is authoritative; never fall back to a stale rubric label.
    const raw=stripSpaces(q.referenceAnswer!==undefined?q.referenceAnswer:q.solution).replace(/。$/u,'');
    const direction=increase?'(?:增加|上升)':'(?:下降|減少)';
    const measure=increase?'增幅':'減幅';
    const numeric=decimal+'(?:/'+decimal+')?';
    const pairPattern=new RegExp('^(?:'+direction+')?('+numeric+')(?:個)?百分點[,;、]相對'+measure+
      '(?:為)?(?:('+decimal+')÷('+decimal+')×100%=)?('+numeric+')%$');
    // Only the current two labelled values are verified. Free-form explanations still need review.
    const final=raw.split(/[;。]/u).at(-1);
    const pairMatch=pairPattern.exec(raw) || pairPattern.exec(final);
    if (!pairMatch) return review(computed,steps,'已算出兩個數值。可按「X 個百分點，相對'+measure+' Y%」填寫參考答案，再驗算兩項。');
    const points=readNumber(pairMatch[1]), relative=readNumber(pairMatch[4]);
    const shownWork=pairMatch[2]===undefined || checkRelativeCalculation(pairMatch[2],pairMatch[3],relative);
    const same=points?.eq(pair[0]) && relative?.eq(pair[1]) && shownWork;
    return {status:same?'match':'mismatch', computed, steps, note:'已核對兩個標示的最終數值；文字推導另由老師核對。'};
  }
  function checkRelativeCalculation(part,total,expected) {
    const base=Ratio.read(total);
    return positive(base) && expected && percent(Ratio.read(part),base).eq(expected);
  }
  function check(q) {
    if (typeof q?.prompt!=='string' || q.prompt.length>2000 || /\d\s+\d/u.test(normalize(q.prompt))) return null;
    const prompt=stripSpaces(q.prompt);
    for (const [patterns,text] of [[rules,prompt],[ordinaryRules,ordinaryText(prompt)]]) {
      for (const {expression,solve} of patterns) {
        const match=expression.exec(text);
        if (!match) continue;
        const values={};
        for (const [key,raw] of Object.entries(match.groups)) {
          if (key==='group') continue; // The backreference ensures the same category was requested.
          values[key]=key==='direction' ? raw : key==='fold' ? discountRate(raw) : Ratio.read(raw);
        }
        const result=solve(values);
        if (result.status) return result;
        return result.pair?confirmPair(result,q):confirmNumber(result,q);
      }
    }
    return null;
  }
  globalThis.EduPercentCheck = Object.freeze({check});
})();
