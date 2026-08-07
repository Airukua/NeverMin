import * as vscode from 'vscode';

/** Kolom editor yang sedang dipakai user — jangan paksa Beside (bikin window/split baru). */
export function preferredViewColumn(): vscode.ViewColumn {
  return (
    vscode.window.activeTextEditor?.viewColumn ??
    vscode.window.tabGroups.activeTabGroup?.viewColumn ??
    vscode.ViewColumn.Active
  );
}

/** Reveal webview di kolomnya sendiri jika sudah ada; kalau belum, di kolom aktif. */
export function revealExistingPanel(panel: vscode.WebviewPanel): void {
  panel.reveal(panel.viewColumn ?? preferredViewColumn(), false);
}

/** Buka / fokusus dokumen di kolom aktif (preview tab, tanpa paksa Beside). */
export async function showDocumentInActiveColumn(
  document: vscode.TextDocument,
  options: { preview?: boolean; selection?: vscode.Range | vscode.Selection } = {}
): Promise<vscode.TextEditor> {
  return vscode.window.showTextDocument(document, {
    preview: options.preview ?? true,
    viewColumn: preferredViewColumn(),
    selection: options.selection,
    preserveFocus: false
  });
}
