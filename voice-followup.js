(() => {
  'use strict';
  const instances = new Set();
  const mounted = new WeakMap();
  const clipLimit = 12 * 1024 * 1024;
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const btn = (name, cls) => {
    const b = node('button', name, cls);
    b.type = 'button';
    return b;
  };
  function field(name, maxlength, rows = 2) {
    const label = node('label', null, 'vf-field');
    const input = node('textarea');
    input.maxLength = maxlength;
    input.rows = rows;
    label.append(node('span', name), input);
    return {label, input};
  }
  function status() {
    const p = node('p', null, 'vf-status');
    p.setAttribute('role', 'status');
    return p;
  }
  function excerpt(turn) {
    const quote = node('blockquote', null, 'vf-excerpt');
    quote.append(node('span', lineLabel(turn)), node('p', turn.quote));
    return quote;
  }
  function lineLabel(line) {
    return (line.field === 'working' ? '解題步驟' : '學生答案') + ' · 第 ' + (line.index + 1) + ' 行';
  }
  function actions(...children) {
    const bar = node('div', null, 'vf-actions');
    bar.append(...children);
    return bar;
  }
  const trouble = e => e?.message || '未能完成，請再試一次。';
  function audioPlayer(label, fetchBlob, cleanup) {
    const box = node('div', null, 'vf-audio'), listen = btn(label), player = node('audio'), msg = status();
    player.controls = true;
    player.hidden = true;
    player.preload = 'metadata';
    let url, alive = true;
    cleanup.push(() => {
      alive = false;
      if (url) { player.pause(); URL.revokeObjectURL(url); }
    });
    listen.onclick = async () => {
      listen.disabled = true; msg.textContent = '正在讀取錄音…';
      try {
        const blob = await fetchBlob();
        if (!alive) return;
        if (!(blob instanceof Blob) || !blob.size) throw Error('未能讀取這段錄音。');
        url = URL.createObjectURL(blob); player.src = url;
        listen.hidden = true; player.hidden = false; msg.textContent = '';
        player.focus();
        await player.play().catch(() => { msg.textContent = '錄音已備妥，請按播放。'; });
      } catch (e) { if (alive) { listen.disabled = false; msg.textContent = trouble(e); } }
    };
    box.append(listen, player, msg);
    return box;
  }

  // Each student response owns its microphone and object URLs through its card's lifetime.
  function responseEditor(turn, adapter, apply, cleanup) {
    const box = node('div', null, 'vf-editor'), draft = turn.draft || {};
    const writing = field('文字回應', 2000, 2);
    writing.input.value = draft.text || '';
    writing.input.placeholder = '可用文字解釋，或補充錄音內容。';
    const start = btn('開始錄音'), stop = btn('停止錄音'), discard = btn('移除錄音', 'vf-quiet');
    const upload = node('label', null, 'vf-file'), file = node('input');
    file.type = 'file'; file.accept = 'audio/*,.webm,.m4a,.ogg,.wav,.mp3';
    upload.append(node('span', '上傳已有錄音'), file);
    const preview = node('audio'), info = status(), result = status();
    preview.controls = true; preview.hidden = true; preview.preload = 'metadata';
    const stored = draft.hasAudio ? audioPlayer('試聽已暫存錄音', () => adapter.audio(turn.id, {draft:true}), cleanup) : null;
    const save = btn('暫存草稿'), submit = btn('交回解釋', 'vf-primary');
    let blob = null, url, recording, stream, timer, pendingMic = false, busy = false;
    let removed = false, alive = true, captureEpoch = 0;
    function hasClip() { return Boolean(blob || (draft.hasAudio && !removed)); }
    function dirty() { return alive && (pendingMic || !!recording || busy || !!blob || removed || writing.input.value !== (draft.text || '')); }
    function draw() {
      const recordingNow = !!recording;
      start.textContent = hasClip() ? '重新錄音' : '開始錄音';
      start.hidden = recordingNow;
      start.disabled = busy || pendingMic;
      stop.hidden = !recordingNow;
      discard.hidden = !hasClip() || recordingNow;
      discard.disabled = busy || pendingMic;
      file.disabled = busy || recordingNow || pendingMic;
      writing.input.readOnly = busy;
      if (stored) stored.hidden = removed || !!blob;
      save.disabled = busy || pendingMic || recordingNow || !dirty();
      submit.disabled = busy || pendingMic || recordingNow || (!writing.input.value.trim() && !hasClip());
    }
    function releaseUrl() {
      if (url) { preview.pause(); preview.removeAttribute('src'); URL.revokeObjectURL(url); url = null; }
      preview.hidden = true;
    }
    function tracksOff() { if (stream) stream.getTracks().forEach(track => track.stop()); stream = null; clearTimeout(timer); }
    function keep(fileBlob) {
      if (!fileBlob?.size || fileBlob.size > clipLimit) { info.textContent = '請選擇有內容且不超過 12 MB 的錄音。'; return; }
      releaseUrl(); blob = fileBlob;
      url = URL.createObjectURL(blob); preview.src = url; preview.hidden = false; removed = false;
      info.textContent = '錄音已備妥。可先試聽，再暫存或交回。'; draw();
    }
    async function record() {
      if (busy || pendingMic || recording) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        info.textContent = '這個瀏覽器未能直接錄音，可上傳錄音檔或用文字回應。'; return;
      }
      const epoch = ++captureEpoch;
      pendingMic = true; info.textContent = '等待咪高峰權限…'; draw();
      try {
        const next = await navigator.mediaDevices.getUserMedia({audio:true});
        if (!alive || epoch !== captureEpoch) { next.getTracks().forEach(track => track.stop()); return; }
        stream = next;
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
          .find(type => MediaRecorder.isTypeSupported?.(type));
        const rec = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
        recording = rec;
        let failed = false;
        const chunks = [];
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        rec.onerror = () => {
          failed = true; tracksOff();
          if (rec.state !== 'inactive') rec.stop();
          if (alive) { info.textContent = '錄音中斷，可再錄一次或上傳錄音。'; draw(); }
        };
        rec.onstop = () => {
          tracksOff(); recording = null;
          if (alive && !failed) keep(new Blob(chunks, {type:rec.mimeType || chunks[0]?.type || 'audio/webm'}));
          if (alive) draw();
        };
        rec.start(1000);
        timer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 118000);
        info.textContent = '錄音中。說完請按「停止錄音」試聽。';
      } catch (e) {
        tracksOff(); recording = null;
        if (alive) info.textContent = '未能啟動咪高峰。可檢查瀏覽器權限、上傳已有錄音，或用文字回應。';
      } finally { if (epoch === captureEpoch) pendingMic = false; if (alive) draw(); }
    }
    start.onclick = record;
    stop.onclick = () => { if (recording?.state === 'recording') recording.stop(); };
    file.onchange = () => { const uploaded = file.files?.[0]; if (uploaded) keep(uploaded); file.value = ''; };
    discard.onclick = () => {
      releaseUrl(); blob = null; removed = !!draft.hasAudio;
      info.textContent = removed ? '已選擇移除原錄音，暫存或交回後生效。' : '已移除錄音。'; draw();
    };
    writing.input.oninput = draw;
    async function write(action) {
      if (busy || recording || pendingMic || !alive) return;
      busy = true; draw(); result.textContent = action === 'draft' ? '正在暫存…' : '正在交回…';
      try {
        const payload = {action,id:turn.id,revision:turn.revision,draftRevision:draft.revision || 0,text:writing.input.value.trim()};
        if (blob) payload.audio = blob;
        else if (removed) payload.removeAudio = true;
        const reply = await adapter.respond(payload);
        if (alive) apply(reply, action === 'draft' ? '草稿已暫存，可稍後繼續。' : '解釋已交回給老師。');
      } catch (e) { if (alive) result.textContent = trouble(e); }
      finally { busy = false; if (alive) draw(); }
    }
    save.onclick = () => write('draft'); submit.onclick = () => write('reply');
    const closeMic = () => {
      ++captureEpoch; pendingMic = false;
      if (recording?.state === 'recording') recording.stop();
      tracksOff();
      if (alive) draw();
    };
    window.addEventListener('pagehide', closeMic);
    cleanup.push(() => {
      alive = false; window.removeEventListener('pagehide', closeMic); closeMic(); releaseUrl();
    });
    box.append(node('h4','我的解釋'), node('p','可用粵語錄音，最長兩分鐘，或用文字回應。','vf-note'),
      actions(start, stop, discard), upload, preview);
    if (stored) box.append(stored);
    box.append(info, writing.label, actions(submit, save), result);
    if (draft.revision) result.textContent = '已讀取暫存的草稿。';
    draw();
    return {box,dirty};
  }

  function teacherComposer(lines, adapter, apply) {
    const box = node('div', null, 'vf-compose'), label = node('label', null, 'vf-field'), pick = node('select');
    const prompt = field('給學生的問題', 400), suggest = btn('建議一句追問'), send = btn('發給學生', 'vf-primary');
    const quote = node('blockquote', null, 'vf-selection'), msg = status();
    lines.forEach((line, i) => pick.add(new Option(lineLabel(line) + '　' + line.text.slice(0,52), String(i))));
    label.append(node('span','追問哪一行？'), pick);
    let busy = false, id = null, key = '';
    const selected = () => lines[Number(pick.value)];
    const payload = () => { const {field,index,text} = selected(); return {field,index,quote:text}; };
    function update() {
      pick.disabled = suggest.disabled = busy; prompt.input.readOnly = busy;
      send.disabled = busy || !prompt.input.value.trim();
      quote.textContent = selected().text;
    }
    // Keep a separate question per line as the teacher compares pieces of work.
    const drafts = new Map(); let active = pick.value;
    pick.onchange = () => {
      drafts.set(active,prompt.input.value); active = pick.value; prompt.input.value = drafts.get(active) || '';
      msg.textContent = ''; update();
    };
    suggest.onclick = async () => {
      if (busy) return;
      if (prompt.input.value.trim() && !window.confirm('用新建議取代這個問題？')) return;
      busy = true; update(); msg.textContent = '正在準備問題…';
      try {
        const r = await adapter.suggest(payload());
        if (!r?.prompt) throw Error('未能取得建議，可直接寫下問題。');
        prompt.input.value = r.prompt;
        msg.textContent = (r.source === 'ai' ? 'AI 建議' : '操作建議') + '已填入，你可以修改後再發送。';
      } catch (e) { msg.textContent = trouble(e); }
      finally { busy = false; update(); prompt.input.focus(); }
    };
    prompt.input.oninput = () => { drafts.set(active,prompt.input.value); update(); };
    send.onclick = async () => {
      if (send.disabled) return;
      const body = {...payload(), prompt:prompt.input.value.trim()};
      const nextKey = JSON.stringify(body);
      if (nextKey !== key) { id = crypto.randomUUID().replaceAll('-',''); key = nextKey; }
      busy = true; update(); msg.textContent = '正在發給學生…';
      try { apply(await adapter.send({...body,requestId:id}), '問題已發給學生。'); }
      catch (e) { msg.textContent = trouble(e); }
      finally { busy = false; update(); }
    };
    prompt.input.placeholder = '例如：你由這一行去到下一行時，做了哪個運算？';
    box.append(label, quote, prompt.label, actions(send, suggest), msg); update();
    return {box,dirty:() => busy || !!prompt.input.value.trim() || [...drafts.values()].some(Boolean)};
  }
  function reviewEditor(turn, adapter, apply) {
    const box = node('div', null, 'vf-review'), feedback = field('給學生的回應（選填）', 1200);
    const more = field('再問學生一句', 400), toggle = btn('繼續追問'), finish = btn('完成跟進', 'vf-primary');
    const send = btn('發出下一個問題', 'vf-primary'), msg = status();
    more.label.hidden = send.hidden = true; toggle.setAttribute('aria-expanded','false');
    let busy = false;
    function update() {
      finish.disabled = busy; send.disabled = busy || !more.input.value.trim(); toggle.disabled = busy;
      feedback.input.readOnly = more.input.readOnly = busy;
    }
    toggle.onclick = () => {
      const open = more.label.hidden;
      more.label.hidden = send.hidden = !open; finish.hidden = open;
      toggle.textContent = open ? '返回完成跟進' : '繼續追問'; toggle.setAttribute('aria-expanded', String(open));
      if (open) more.input.focus(); update();
    };
    more.input.oninput = update;
    async function write(next) {
      if (busy) return;
      busy = true; update(); msg.textContent = '正在保存…';
      try {
        const payload = {id:turn.id,revision:turn.revision,feedback:feedback.input.value.trim()};
        if (next) payload.nextPrompt = more.input.value.trim();
        apply(await adapter.review(payload), next ? '下一個問題已發給學生。' : '已完成這次跟進。');
      } catch (e) { msg.textContent = trouble(e); }
      finally { busy = false; update(); }
    }
    finish.onclick = () => write(false); send.onclick = () => write(true);
    box.append(feedback.label, more.label, actions(finish, send, toggle), msg);
    update(); return {box,dirty:() => busy || !!feedback.input.value.trim() || !!more.input.value.trim()};
  }

  function mount(host, {role, adapter}) {
    mounted.get(host)?.destroy();
    const teacher = role === 'teacher', area = node('section', null, 'vf-panel');
    const heading = teacher ? '作答追問' : '老師的追問';
    area.setAttribute('aria-label', heading);
    const composer = node('div'), list = node('div', null, 'vf-list'), msg = status();
    area.append(node('h2', heading), composer, list, msg); host.replaceChildren(area);
    const cards = new Map();
    let data = {}, editor, composerKey = '', alive = true, serial = 0;
    function apply(update, note) {
      if (!alive) return;
      if (!update?.turn?.id) throw Error('未能核實保存結果，請再試。');
      ++serial;
      for (const turn of [update.turn, update.next].filter(Boolean)) {
        const index = data.turns.findIndex(t => t.id === turn.id);
        if (index < 0) data.turns.push(turn); else data.turns[index] = turn;
      }
      render(); msg.textContent = note;
    }
    function card(turn) {
      const cleanup = [], section = node('article', null, 'vf-turn');
      const head = node('div', null, 'vf-turn-head');
      const title = [turn.title, turn.number ? '第 ' + turn.number + ' 題' : ''].filter(Boolean).join(' · ');
      const state = {asked:'待學生回應',answered:'待老師跟進',reviewed:'老師已跟進'};
      head.append(node('h3', title || '作答紀錄'), node('span', state[turn.status] || '', 'vf-state'));
      section.dataset.state = turn.status; section.append(head);
      if (turn.questionText) section.append(node('p', turn.questionText, 'vf-question'));
      section.append(excerpt(turn), node('h4', turn.parentId ? '老師再問' : '老師的問題'), node('p',turn.prompt,'vf-copy'));
      if (turn.status !== 'asked') {
        section.append(node('h4',teacher ? '學生的解釋' : '我交回的解釋'));
        if (turn.answerText) section.append(node('p',turn.answerText,'vf-copy'));
        if (turn.hasAudio) section.append(audioPlayer(teacher ? '播放學生錄音' : '播放我的錄音', () => adapter.audio(turn.id), cleanup));
        if (turn.feedback) section.append(node('h4','老師回應'), node('p',turn.feedback,'vf-copy'));
      }
      const controls = !teacher && turn.status === 'asked' ? responseEditor(turn,adapter,apply,cleanup)
        : teacher && turn.status === 'answered' ? reviewEditor(turn,adapter,apply) : null;
      if (controls) section.append(controls.box);
      return {section,dirty:() => !!controls?.dirty(),release:() => cleanup.forEach(fn => fn())};
    }
    function render() {
      const turns = data.turns || [], lines = data.lines || [];
      const waiting = turns.some(t => t.status !== 'reviewed');
      const nextKey = teacher && data.released && lines.length && !waiting ? JSON.stringify(lines) : '';
      if (nextKey !== composerKey) {
        composerKey = nextKey;
        editor = nextKey ? teacherComposer(lines,adapter,apply) : null;
        composer.replaceChildren(...(editor ? [editor.box] : []));
      }
      if (teacher && !composerKey) {
        const note = !data.released ? '發布這份成績後，可選一行作答發給學生追問。'
          : !lines.length && !turns.length ? '這題未有可引用的作答文字。' : '';
        composer.textContent = note; composer.className = 'vf-note';
      } else composer.className = '';
      const used = new Set();
      const ordered = turns.slice().reverse();
      ordered.sort((a,b) => Number(b.status === (teacher?'answered':'asked')) - Number(a.status === (teacher?'answered':'asked')));
      for (const t of ordered) {
        const key = t.id + '/' + t.revision + '/' + (t.draft?.revision || 0);
        if (!cards.has(key)) cards.set(key,card(t));
        const element = cards.get(key).section;
        used.add(key);
        if (list.children[used.size-1] !== element) list.insertBefore(element,list.children[used.size-1] || null);
      }
      for (const [key,c] of cards) if (!used.has(key)) { c.release(); c.section.remove(); cards.delete(key); }
      area.hidden = !teacher && !turns.length;
    }
    async function refresh() {
      const ticket = ++serial; msg.textContent = '正在讀取追問…';
      try {
        const r = await adapter.load();
        if (!alive || serial !== ticket) return;
        if (!Array.isArray(r?.turns)) throw Error('未能讀取追問紀錄。');
        data = r; render(); msg.textContent = '';
      } catch (e) {
        if (!alive || serial !== ticket) return;
        area.hidden = false; const retry = btn('重新讀取'); retry.onclick = refresh;
        msg.replaceChildren(document.createTextNode(trouble(e) + ' '), retry);
      }
    }
    const instance = {refresh,isDirty:() => !!editor?.dirty() || [...cards.values()].some(c => c.dirty()),destroy() {
      if (!alive) return;
      alive = false; ++serial;
      for (const c of cards.values()) c.release();
      cards.clear(); area.remove(); instances.delete(instance); mounted.delete(host);
    },host,connected:host.isConnected};
    instances.add(instance); mounted.set(host,instance);
    instance.ready = refresh();
    return instance;
  }
  // Views embedded in the marking desk may disappear when its parent changes question.
  new MutationObserver(() => {
    for (const instance of instances) {
      if (instance.host.isConnected) instance.connected = true;
      else if (instance.connected) instance.destroy();
    }
  }).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pagehide', event => { if (!event.persisted) for (const instance of instances) instance.destroy(); });
  window.EduVoiceFollowup = {mount};
})();
