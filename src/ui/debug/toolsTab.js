/**
 * Debug menu — Tools tab: action rows (Screenshot + markup, Clear saved game
 * with two-tap confirmation) and the desktop keyboard shortcut footer.
 */
export function buildToolsTab(pane, { menuItems, makeMenuRow }) {
  for (const item of menuItems) {
    if (item.type !== 'toggle') pane.appendChild(makeMenuRow(item));
  }
  const foot = document.createElement('div');
  foot.className = 'dm-foot';
  foot.textContent = 'Keys: F2 or ` menu • F3 overlay • Shift+F3 perf • F4 collision • Shift+F4 highlight • F8 street start • Shift+F8 clear save • F9 screenshot';
  pane.appendChild(foot);
}
