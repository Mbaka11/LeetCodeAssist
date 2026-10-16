/** Opens the dashboard tab, or focuses it when it is already open. */
export async function openDashboard(hash = ''): Promise<void> {
  const url = chrome.runtime.getURL('/dashboard.html');
  const [existing] = await chrome.tabs.query({ url: `${url}*` });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, {
      active: true,
      ...(hash ? { url: `${url}${hash}` } : {}),
    });
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: `${url}${hash}` });
}
