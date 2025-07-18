export const PATCH_ANCHOR_CLICK = `
(function(){
  document.body.addEventListener('click', function () {
    const target = event.target || event.srcElement;
    if (target.nodeName.toLowerCase() === 'a') {
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            window.event.returnValue = true;
        }
        const url = target.getAttribute("href")
        window.location.href = url
    }
  });
})()
`;

export const PATCH_ANCHOR_TARGET = `
(function () {
  setTimeout(function () {
    Array.from(document.querySelectorAll('a[target="_blank"]'))
      .forEach(link => link.removeAttribute('target'));
  }, 50);
})();
`;
