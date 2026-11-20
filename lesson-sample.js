(() => {
  const sheet = document.getElementById('sheet');
  const slides = document.getElementById('slides');
  const pages = [...slides.querySelectorAll('.sample-slide')];
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const print = document.getElementById('print');
  let index = 0;
  function showPage(i) {
    index = Math.min(pages.length - 1, Math.max(0, i));
    pages.forEach((page, j) => { page.hidden = j !== index; });
    previous.disabled = index === 0;
    next.disabled = index === pages.length - 1;
    document.getElementById('page-number').textContent = '第 ' + (index + 1) + ' / ' + pages.length + ' 頁';
  }
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.onclick = () => {
      const showSlides = button.dataset.mode === 'slides';
      sheet.hidden = showSlides;
      slides.hidden = !showSlides;
      print.textContent = showSlides ? '列印三頁簡報' : '列印工作紙';
      document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    };
  }
  previous.onclick = () => showPage(index - 1);
  next.onclick = () => showPage(index + 1);
  print.onclick = () => window.print();
})();
