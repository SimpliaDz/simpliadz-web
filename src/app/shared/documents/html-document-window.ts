/**
 * Printable HTML documents come from authenticated endpoints, so they cannot be opened by a plain
 * link. Open the window synchronously inside the click handler (so the popup blocker allows it),
 * then write the document once the request completes.
 */
export function openDocumentWindow(): Window | null {
  const win = window.open('', '_blank');
  if (win) {
    win.document.title = 'Simplia';
  }
  return win;
}

export function writeDocumentWindow(win: Window | null, html: string): boolean {
  if (!win || win.closed) {
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
