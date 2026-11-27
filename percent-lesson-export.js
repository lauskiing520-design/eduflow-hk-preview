/* Portable OpenMAIC v1 classroom archive. The only entry is manifest.json. */
(function (root) {
  'use strict';
  const engine = typeof module === 'object' && module.exports ? require('./percent-lesson.js') : root.EduPercentLesson;

  const money = value => Number(value.toFixed(2)).toString();
  const describe = ({price, down, up}) => `一件貨品原價 ${price} 港元，先減價 ${down}%，再按減價後的售價加價 ${up}%。`;
  function page(title, body, script = '') {
    return `<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f9fb;color:#15384b;font:18px/1.65 system-ui,sans-serif}
main{max-width:44rem;margin:auto;padding:clamp(1rem,5vw,4rem)}h1{font-size:clamp(1.5rem,4vw,2.4rem);line-height:1.35}fieldset{border:0;padding:0}
fieldset label{display:block;margin:.5rem 0;padding:.55rem 1rem;background:white;border:1px solid #b5d0dc;border-radius:.4rem}
input[type=range],progress{width:100%;accent-color:#126d83}progress{display:block;height:1.2rem;margin:.2rem 0 .65rem}output{font-weight:700}
</style><main><h1>${title}</h1>${body}</main>${script ? '<script>'+script+'<\/script>' : ''}</html>`;
  }

  function prediction(example) {
    return page('最後售價會怎樣？', `<p>${describe(example)}</p><fieldset><legend>先記下你的預測，再到下一節調校價格條。</legend>${['低於原價','等於原價','高於原價'].map((label, i) =>
      `<label><input type="radio" name="prediction" value="${i}"> ${label}</label>`).join('')}</fieldset>`);
  }

  function experiment(example) {
    const {price, down, up} = example;
    const amounts = engine.amounts(example);
    const first = money(amounts.first), final = money(amounts.finalCents / 100);
    const ceiling = price * 2;
    // The only interpolated script value is an integer derived from the validated example.
    const script = `const rate=document.getElementById('rate'), result=document.getElementById('final');
function update(){
  const up=Number(rate.value);
  const cents=Math.round(${price*(100-down)}*(100+up)/100);
  document.getElementById('percent').textContent=up+'%';
  document.getElementById('bar').value=cents/100;
  result.textContent=(cents/100).toFixed(2)+' 元';
}
rate.addEventListener('input',update);update();`;
    return page('第二次變價的基數', `<p>${describe(example)} 拖動滑桿，觀察最後售價。</p>
<label>原價 · ${price} 元<progress max="${ceiling}" value="${price}"></progress></label>
<label>減價後 · ${first} 元<progress max="${ceiling}" value="${amounts.first}"></progress></label>
<label>加價後 · <output id="final" for="rate">${final} 元</output><progress id="bar" max="${ceiling}" value="${final}"></progress></label>
<label for="rate">加價率　<output id="percent" for="rate">${up}%</output></label>
<input id="rate" type="range" min="0" max="100" value="${up}"><p>第二次按減價後的 ${first} 港元計算。要還原到原價，加回的金額應是多少？</p>`, script);
  }

  function exitQuestion(example) {
    const {price, down, up} = example;
    const correct = engine.amounts(example).finalCents;
    const candidates = [price*(100-down+up), price*(100-down), price*100, correct+1, correct+10, correct+100];
    const options = [...new Set(candidates.filter(cents => cents !== correct))].slice(0, 3);
    const position = (price + down + up) % 4;
    options.splice(position, 0, correct);
    const keys = ['A', 'B', 'C', 'D'];
    return {
      id:'transfer-price', type:'single', question:describe(example)+' 最後售價是多少？最後才四捨五入至最接近的仙。',
      options:options.map((cents, i) => ({label:money(cents/100)+' 港元', value:keys[i]})),
      answer:[keys[position]], analysis:`${price} × (1 − ${down}%) × (1 + ${up}%)，取至最接近的仙為 ${money(correct/100)} 港元。`,
      points:1, hasAnswer:true
    };
  }

  function manifest(spec, now = new Date()) {
    const data = engine.validate(spec);
    const scenes = [
      {title:'預測售價', content:{type:'interactive',html:prediction(data.example)}},
      {title:'調校價格條', content:{type:'interactive',html:experiment(data.example),widgetType:'simulation'}},
      {title:'獨立練習', content:{type:'quiz',questions:[exitQuestion(data.transfer)]}}
    ];
    return {
      formatVersion:1, appVersion:'EduFlow HK', exportedAt:now.toISOString(),
      stage:{name:data.title,description:data.instructions,language:'繁體中文（香港）',createdAt:now.getTime(),updatedAt:now.getTime()},
      scenes:scenes.map((scene, order) => ({...scene, type:scene.content.type, order})), agents:[], mediaIndex:{}
    };
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit=0; bit<8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function archive(spec, now = new Date()) {
    const encoder = new TextEncoder(), name = encoder.encode('manifest.json');
    const payload = encoder.encode(JSON.stringify(manifest(spec, now)));
    const localSize = 30 + name.length + payload.length, centralSize = 46 + name.length;
    const bytes = new Uint8Array(localSize + centralSize + 22), view = new DataView(bytes.buffer);
    const word = (at, value) => view.setUint16(at, value, true);
    const dword = (at, value) => view.setUint32(at, value, true);
    const crc = crc32(payload);
    // ZIP stored entry, UTF-8, DOS date 1980-01-01. No external compressor or service.
    dword(0,0x04034b50); word(4,20); word(6,0x800); word(12,33);
    dword(14,crc); dword(18,payload.length); dword(22,payload.length); word(26,name.length);
    bytes.set(name,30); bytes.set(payload,30+name.length);
    const c = localSize;
    dword(c,0x02014b50); word(c+4,20); word(c+6,20); word(c+8,0x800); word(c+14,33);
    dword(c+16,crc); dword(c+20,payload.length); dword(c+24,payload.length); word(c+28,name.length); bytes.set(name,c+46);
    const end = localSize+centralSize;
    dword(end,0x06054b50); word(end+8,1); word(end+10,1); dword(end+12,centralSize); dword(end+16,localSize);
    return bytes;
  }

  function download(spec) {
    const data = archive(spec);
    const blob = new Blob([data], {type:'application/zip'}), url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (spec.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,80) || '互動課') + '.maic.zip';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const api = {manifest, archive, download};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EduPercentLessonExport = api;
})(globalThis);
