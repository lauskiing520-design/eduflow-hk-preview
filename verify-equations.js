/* Independently verify the current wording and reference answer of a junior algebra question. */
(() => {
  'use strict';

  function gcd(a, b) {
    a = a < 0n ? -a : a;
    while (b) [a, b] = [b, a % b];
    return a < 0n ? -a : a;
  }

  class Rational {
    constructor(n, d = 1n) {
      if (!d) throw new Error('除數不可為零。');
      if (d < 0n) { n = -n; d = -d; }
      const divisor = gcd(n, d);
      this.n = n / divisor;
      this.d = d / divisor;
    }
    static decimal(text) {
      if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) || text.length > 30)
        throw new Error('數值的格式或長度未能核對。');
      const [whole, fraction = ''] = text.split('.');
      return new Rational(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
    }
    add(other) { return new Rational(this.n * other.d + other.n * this.d, this.d * other.d); }
    sub(other) { return this.add(other.neg()); }
    mul(other) { return new Rational(this.n * other.n, this.d * other.d); }
    div(other) { return new Rational(this.n * other.d, this.d * other.n); }
    neg() { return new Rational(-this.n, this.d); }
    eq(other) { return this.n === other.n && this.d === other.d; }
    toString() {
      if (this.d === 1n) return String(this.n);
      let scale = 1n;
      for (let digits = 1; digits <= 8; digits++) {
        scale *= 10n;
        if (scale % this.d) continue;
        const value = this.n * (scale / this.d);
        const text = String(value < 0n ? -value : value).padStart(digits + 1, '0');
        return (value < 0n ? '-' : '') + text.slice(0, -digits) + '.' + text.slice(-digits);
      }
      return this.n + '/' + this.d;
    }
  }

  const zero = new Rational(0n), one = new Rational(1n);
  const linear = (a, b) => ({a, b});
  const scale = (v, n) => linear(v.a.mul(n), v.b.mul(n));
  const at = (v, x) => v.a.mul(x).add(v.b);

  function normalized(value) {
    return String(value ?? '').replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim();
  }

  // Parse a single-variable affine expression. Never evaluate input as JavaScript.
  function expression(text, variable) {
    const tokens = text.match(/\d+(?:\.\d+)?|\.\d+|[A-Za-z]|[^\s]/g) || [];
    if (!tokens.length || tokens.length > 120) throw new Error('算式過長或沒有內容。');
    let pos = 0;
    function atom() {
      const token = tokens[pos++];
      if (token === '+' || token === '-') {
        const value = atom();
        return token === '-' ? scale(value, one.neg()) : value;
      }
      if (token === '(') {
        const value = sum();
        if (tokens[pos++] !== ')') throw new Error('請核對括號是否成對。');
        return value;
      }
      if (variable && token === variable) return linear(one, zero);
      if (!token || !/^(?:\d|\.)/.test(token)) throw new Error('只支援一個未知數及四則運算。');
      return linear(zero, Rational.decimal(token));
    }
    function product() {
      let left = atom();
      let afterDivision = false;
      while (pos < tokens.length) {
        const op = tokens[pos];
        const implicit = op === '(' || Boolean(variable && op === variable);
        if (!implicit && op !== '*' && op !== '/') break;
        if (implicit && afterDivision) throw new Error('除號後的隱含乘法有歧義，請用括號標明分母。');
        if (!implicit) pos++;
        const right = atom();
        if (op === '/') {
          if (right.a.n) throw new Error('分母含未知數，須另行核對定義域。');
          left = scale(left, one.div(right.b));
        } else {
          if (left.a.n && right.a.n) throw new Error('這個乘積含高次項，超出一元一次驗算範圍。');
          left = left.a.n ? scale(left, right.b) : scale(right, left.b);
        }
        afterDivision = op === '/';
      }
      return left;
    }
    function sum() {
      let left = product();
      while (tokens[pos] === '+' || tokens[pos] === '-') {
        const op = tokens[pos++], right = product();
        if (op === '+') left = linear(left.a.add(right.a), left.b.add(right.b));
        else left = linear(left.a.sub(right.a), left.b.sub(right.b));
      }
      return left;
    }
    const result = sum();
    if (pos !== tokens.length) throw new Error('算式含未支援的符號或缺少運算符。');
    return result;
  }

  function result(status, computed = '', steps = [], note = '') {
    return {status, computed, steps, note};
  }

  function affineText(v, symbol) {
    if (!v.a.n) return String(v.b);
    const term = v.a.eq(one) ? symbol : v.a.eq(one.neg()) ? '-' + symbol : v.a + symbol;
    return term + (v.b.n > 0n ? '+' + v.b : v.b.n < 0n ? String(v.b) : '');
  }

  const units = {
    cm: ['cm', '厘米', '公分'], '冊': ['冊'], '本': ['本'], '粒': ['粒'], '人': ['人'],
    h: ['h', '小時'], min: ['min', '分鐘']
  };

  function supplied(q) {
    return Object.hasOwn(q, 'referenceAnswer') ? q.referenceAnswer : q.expected;
  }

  function referenceValue(q, variable, unit) {
    let raw = normalized(supplied(q)).replace(/[。]$/, '').trim();
    if (variable) raw = raw.replace(new RegExp('^' + variable + '\\s*=\\s*'), '');
    const suffix = unit && units[unit].find(s => raw.endsWith(s));
    if (suffix) raw = raw.slice(0, -suffix.length).trim();
    raw = raw.replace(/^\\(?:d?frac)\{([+-]?\d+)\}\{([+-]?\d+)\}$/, '$1/$2');
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*[+-]?\d+(?:\.\d+)?)?$/.test(raw))
      return null;
    try { return expression(raw, '').b; } catch { return null; }
  }

  function verifyModel(q, equation, variable, opts = {}) {
    const sides = equation.split('=');
    if (sides.length !== 2) throw new Error('請保留包含一個等號的完整方程。');
    const left = expression(sides[0], variable), right = expression(sides[1], variable);
    const slope = left.a.sub(right.a), constant = right.b.sub(left.b);
    const steps = opts.intro ? [opts.intro, equation] : [equation];
    if (!slope.n) {
      steps.push('消去未知數後得到 0 = ' + constant + '。');
      const computed = constant.n ? '無解' : '無限多解';
      // Word problems may impose restrictions beyond this equation.
      if (opts.valid) return result('invalid', computed, steps, '題目條件未能給出唯一有效數值。');
      const answer = normalized(supplied(q)).replace(/[。.]$/, '');
      const no = /^(無解|沒有解|无解|没有解)$/.test(answer);
      const many = /^(無限多解|無窮多解|無限多個解|所有實數|任意實數|无限多解)$/.test(answer);
      return result(no || many || referenceValue(q, variable) ? ((constant.n ? no : many) ? 'match' : 'mismatch') : 'unsupported',
        computed, steps, '原方程' + (constant.n ? '不成立。' : '對所有實數均成立。'));
    }
    const x = constant.div(slope);
    steps.push('整理得 (' + slope + ')' + variable + ' = ' + constant + '，所以 ' + variable + ' = ' + x + '。');
    if (opts.valid && !opts.valid(x)) return result('invalid', String(x), steps, '算出的數值不符合題目所需的數量或大小關係，請核對題目條件。');
    return compareNumber(q, x, variable, opts.unit, steps, candidate =>
      '代入 ' + variable + ' = ' + candidate + '，左邊 = ' + at(left, candidate) + '，右邊 = ' + at(right, candidate) + '。');
  }

  function compareNumber(q, answer, variable, unit, steps, evidence) {
    const computed = String(answer) + (unit ? ' ' + unit : '');
    if (q.unit && !units[unit]?.includes(q.unit)) return result('invalid', computed, steps, '目前設定的答案單位與題幹不相符，請核對。');
    const given = referenceValue(q, variable, unit);
    if (!given) return result('unsupported', computed, steps, '已由題幹算出答案。請以數值或分數填寫待核對的參考答案，並核對單位。');
    if (evidence) steps.push(evidence(given));
    return result(given.eq(answer) ? 'match' : 'mismatch', computed, steps);
  }

  const amount = '(\\d{1,14}(?:\\.\\d{1,12})?)';
  function wordRule(pattern, build) {
    return {match: new RegExp('^' + pattern.replaceAll('{n}', amount).replaceAll('{s}', '([+-]?\\d{1,14}(?:\\.\\d{1,12})?)') + '$'), build};
  }

  // Match complete problem statements so a new condition cannot be dropped accidentally.
  const whole = x => x.d === 1n && x.n >= 0n;
  function model(equation, intro, unit, valid) { return {equation, opts:{intro, unit, valid}}; }
  function inverse(op, a, b) { return model('x' + (op === '減去' ? '-' : '+') + a + '=(' + b + ')', '設原數為 x。'); }
  function rope(total, factor, less) {
    const times = factor === '兩' ? '2' : factor;
    return model('x+(' + times + 'x-' + less + ')=' + total, '設短段長 x cm，兩段相加為原長。', 'cm',
      x => x.n > 0n && x.mul(Rational.decimal(times)).sub(Rational.decimal(less)).sub(x).n > 0n);
  }
  function shelf(total, plus, minus) {
    return model('x+(x+' + plus + ')+(x-' + minus + ')=' + total, '設所求一層有 x 本。', '本',
      x => whole(x) && whole(x.add(Rational.decimal(plus))) && whole(x.sub(Rational.decimal(minus))));
  }
  function printing(fee, rate, total) {
    return model(fee + '+' + rate + 'x=' + total, '設印了 x 冊。', '冊', whole);
  }
  function rental(total, deposit, rate) {
    return model(deposit + '+' + rate + 'x=' + total, '設租用 x 小時。', 'h', x => x.n >= 0n);
  }
  function beads(a, b, n) {
    return model('(' + a + '/' + b + ')*x+' + n + '=x', '設所求第二種珠原有 x 粒，第一種珠按比例計算。', '粒',
      x => whole(x) && x.n > 0n && whole(x.mul(Rational.decimal(a)).div(Rational.decimal(b))) && Rational.decimal(a).n > 0n && Rational.decimal(b).n > 0n && whole(Rational.decimal(n)));
  }
  function transfer(a, b, n) {
    return model('x-' + n + '=(' + b + '/' + a + ')*x+' + n, '設甲組原有 x 人，轉組前後總人數不變。', '人',
      x => whole(x) && x.n > 0n && whole(x.sub(Rational.decimal(n))) && whole(x.mul(Rational.decimal(b)).div(Rational.decimal(a))) && Rational.decimal(b).n > 0n && whole(Rational.decimal(n)));
  }
  function catchUp(lead, slow, fast) {
    return model(fast + 'x=' + lead + '+' + slow + 'x', '設相遇需 x 分鐘；兩者到達同一位置。', 'min', x => x.n > 0n);
  }
  const wordProblems = [
    wordRule('(?:一[個个][數数]|某[數数])的{s}倍(加上|減去|减去){s}(?:後|后)?等[於于]{s}[。,;](?:請|请)?求(?:這[個个][數数]|这[個个][數数]|原[數数])[?。.]?',
      (factor, op, term, total) => model('(' + factor + ')x' + (op === '加上' ? '+' : '-') + '(' + term + ')=(' + total + ')', '設所求的數為 x。')),
    wordRule('一個數(減去|加上){s}後等於{s}。原數是多少[?。]', inverse),
    wordRule('某數(減去|加上){s}後得到{s}。求原數[?。]', inverse),
    wordRule('兩段繩共長{n}cm,長段比短段的(兩|\\d+)倍少{n}cm。短段長多少cm[?。]', rope),
    wordRule('一條長{n}cm的絲帶剪成兩段,長段比短段的{n}倍少{n}cm。短段長多少cm[?。]', rope),
    wordRule('三層書架共有{n}本書。中層比上層多{n}本,下層比上層少{n}本。上層有多少本[?。]', shelf),
    wordRule('三個書櫃共有{n}本書。乙櫃比甲櫃多{n}本,丙櫃比甲櫃少{n}本。甲櫃有多少本書[?。]', shelf),
    wordRule('印刷費包括一次排版費{n}元及每冊{n}元。總費{n}元,印了多少冊[?。]', printing),
    wordRule('印製講義須付排版費{n}元,另每冊收費{n}元。若合共付了{n}元,印了多少冊[?。]', printing),
    wordRule('租單車已繳{n}元,其中{n}元是按金,餘額支付每小時{n}元的租金。可租多少小時[?。]', rental),
    wordRule('租用單車付款{n}元,當中包括按金{n}元,其餘是按每小時{n}元計算的租金。租用了多少小時[?。]', rental),
    wordRule('藍珠與白珠數量比為{n}:{n}。加入{n}粒藍珠後兩色數量相等。原有多少粒白珠[?。]', beads),
    wordRule('盒內黃珠與綠珠的數量比為{n}:{n}。多放{n}粒黃珠後,兩色珠的數量相等。原有多少粒綠珠[?。]', beads),
    wordRule('甲乙兩組人數比為{n}:{n}。甲組有{n}人轉往乙組後兩組相等,原來甲組有多少人[?。]', transfer),
    wordRule('甲隊和乙隊原有人數比為{n}:{n}。有{n}人由甲隊轉到乙隊後,兩隊人數相同。甲隊原有多少人[?。]', transfer),
    wordRule('小慧比小明先走{n}m。兩人同向,每分鐘分別走{n}m及{n}m。小明起步後多少分鐘追上[?。]', catchUp),
    wordRule('後車起步時前車領先{n}km。兩車同向,每分鐘分別前進{n}km\\(後車\\)及{n}km\\(前車\\)。多少分鐘後追上[?。]',
      (lead, fast, slow) => catchUp(lead, slow, fast)),
    wordRule('兩位同學同向而行。乙出發時,甲已領先{n}m。甲和乙每分鐘分別前進{n}m和{n}m。乙出發後多少分鐘追上甲[?。]', catchUp),
    wordRule('兩輛車同向而行。乙出發時,甲已領先{n}km。甲和乙每分鐘分別前進{n}km和{n}km。乙出發後多少分鐘追上甲[?。]', catchUp)
  ];

  function identity(q, text) {
    const statement = /^(?:方程|若)([^,。]+)對(?:每一個|任何|所有)x都成立[。,]求k[。?]$/.exec(text);
    if (!statement) return null;
    const equation = statement[1];
    // k can occur as one additive constant or as the coefficient of one affine factor.
    // In both grammars each side is affine in x and each coefficient is affine in k.
    if (!/^[+\-\d.()x*/]+=([+\-\d.x*/()]+)[+-]k$/.test(equation) &&
        !/^k\(x[+-]\d+(?:\.\d+)?\)=[+\-\d.()x*/]+$/.test(equation))
      return result('unsupported', '', [], '請人手核對參數方程是否對所有 x 成立。');
    const [lhs, rhs] = equation.split('=');
    const parts = k => {
      const l = expression(lhs.replace('k', '(' + k + ')'), 'x');
      const r = expression(rhs.replace('k', '(' + k + ')'), 'x');
      return [l.a.sub(r.a), l.b.sub(r.b)];
    };
    const atZero = parts(0), atOne = parts(1);
    const candidates = [];
    const steps = [equation, 'x 的係數和常數項都必須分別相等。'];
    for (let i = 0; i < 2; i++) {
      const coeff = atOne[i].sub(atZero[i]);
      if (coeff.n) candidates.push(atZero[i].neg().div(coeff));
      else if (atZero[i].n) return result('invalid', '無此 k 值', steps, '比較係數與常數項時出現矛盾。');
    }
    if (!candidates.length || candidates.some(k => !k.eq(candidates[0])))
      return result('invalid', candidates.length ? '無此 k 值' : '任意 k', steps, '條件未能確定唯一的 k。');
    const k = candidates[0];
    const l = expression(lhs.replace('k', '(' + k + ')'), 'x');
    const r = expression(rhs.replace('k', '(' + k + ')'), 'x');
    steps.push('代入 k = ' + k + '，左右兩邊分別化為 ' + affineText(l, 'x') + ' 和 ' + affineText(r, 'x') + '。');
    return compareNumber(q, k, 'k', undefined, steps);
  }

  function simplify(q, text) {
    const pair = /^(?:有人|小晴)把(.+?)展開為(.+?)。指出(?:她的)?符號錯誤,(?:並)?寫出正確簡式。$/.exec(text) ||
      /^有人由(.+?)=0得出(.+?)=0。指出錯處並寫出正確簡式\(左邊\)。$/.exec(text);
    if (!pair) return null;
    const symbols = new Set((pair[1] + pair[2]).match(/[a-zA-Z]/g));
    if (symbols.size !== 1) throw new Error('只支援一個未知數的簡式。');
    const symbol = [...symbols][0], value = expression(pair[1], symbol), claimed = expression(pair[2], symbol);
    const computed = affineText(value, symbol);
    const steps = ['原式 ' + pair[1] + ' 展開並合併得 ' + computed + '。',
      '題中待辨析的式子化簡為 ' + affineText(claimed, symbol) + '。'];
    if (value.a.eq(claimed.a) && value.b.eq(claimed.b)) return result('invalid', computed, steps, '題中所指的錯解與原式等值，應核對題幹。');
    const explicit = Object.hasOwn(q, 'referenceAnswer');
    const answer = normalized((explicit ? q.referenceAnswer : q.solution) ?? '').replace(/[。.]$/, '').trim();
    const conclusion = /正確簡式(?:是|為)\s*([^。；;，,]+)$/.exec(answer);
    try {
      const ref = expression(conclusion ? conclusion[1] : answer, symbol);
      return result(ref.a.eq(value.a) && ref.b.eq(value.b) ? 'match' : 'mismatch', computed, steps,
        '已核對簡式的等值性。符號錯誤的文字解釋須由老師核對。');
    } catch {
      return result('unsupported', computed, steps, '已算出簡式。請填寫最後的代數式，符號錯誤的解釋須由老師核對。');
    }
  }

  function check(q) {
    const prompt = normalized(q?.prompt);
    if (!prompt || prompt.length > 1100) return null;
    try {
      // Do not allow whitespace removal to join two separately written numerals.
      if (/\d\s+\d/.test(prompt)) return result('unsupported', '', [], '兩個數字之間有空格，請先核對是否欠缺運算符。');
      const compact = prompt.replace(/\s/g, '');
      const manual = identity(q, compact) || simplify(q, compact);
      if (manual) return manual;
      for (const rule of wordProblems) {
        const values = rule.match.exec(compact);
        if (!values) continue;
        const {equation, opts} = rule.build(...values.slice(1));
        return verifyModel(q, equation, 'x', opts);
      }
      let direct = prompt.replace(/[。?.]$/, '').trim();
      const requested = /[,;。]\s*(?:請|请)?求(?:出)?\s*([a-zA-Z])(?:\s*的\s*值)?$/.exec(direct);
      if (requested) {
        direct = direct.slice(0, requested.index).replace(/^(?:若|已知)\s*/, '').trim();
      }
      direct = direct.replace(/^(?:請|请)?(?:求解|解)(?:\s*(?:下列|以下|這個|这个)?\s*方程(?:式)?)?\s*:?\s*/, '');
      if (!direct.includes('=') || !/^[\d\sA-Za-z().=+\-*/^²³]+$/.test(direct)) return null;
      const symbols = new Set(direct.match(/[a-zA-Z]/g));
      if (symbols.size !== 1) return result('unsupported', '', [], '此處只支援一個未知數的方程。');
      const variable = [...symbols][0];
      if (requested && requested[1] !== variable)
        return result('invalid', '', [], '題目要求的字母與方程內的未知數不同，請核對。');
      return verifyModel(q, direct, variable);
    } catch (error) {
      return result('unsupported', '', [], error.message);
    }
  }

  globalThis.EduEquationCheck = Object.freeze({check});
})();
