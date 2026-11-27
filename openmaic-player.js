(function (global) {
  'use strict';
  const classroomUrl = new URL('openmaic-printing.html', document.currentScript.src);
  function mount(container) {
    const frame = document.createElement('iframe');
    frame.src = classroomUrl.href;
    frame.title = 'OpenMAIC 小課堂：哪一份報價較划算？';
    frame.allow = 'fullscreen';
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'display:block;width:100%;height:clamp(550px,72vh,700px);border:1px solid #cedad8;border-radius:8px;background:white';
    container.replaceChildren(frame);
    return { destroy() { frame.remove(); } };
  }
  global.EduOpenClass = Object.freeze({mount});
})(window);
