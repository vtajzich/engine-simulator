export function createToaster(host) {
  const box = document.createElement('div');
  box.id = 'toasts';
  host.appendChild(box);
  return function toast(text, kind = 'info', ms = 3600) {
    for (const t of box.children) if (t.textContent === text) { t.remove(); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  };
}
