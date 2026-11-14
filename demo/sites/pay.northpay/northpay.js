// Mock payment provider script, loaded by Trailhead Outfitters and Harbour Books.
document.querySelectorAll('[data-northpay]').forEach((el) => {
  el.innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:6px;font:12px system-ui,sans-serif;color:#475569">' +
    '<span style="width:18px;height:18px;border-radius:4px;background:#0ea5e9;color:#fff;display:grid;place-items:center;font-weight:700;font-size:10px">N</span>' +
    'Secured by Northpay</span>';
});
