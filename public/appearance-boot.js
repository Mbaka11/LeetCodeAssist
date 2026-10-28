// Applies the device-local appearance (theme and text size) before the first paint, from the copy that
// src/lib/appearance.ts keeps in localStorage. Same values and attribute names as applyAppearance().
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('leetcodeAssist.appearance.mirror') || 'null');
    if (!saved) return;
    var root = document.documentElement;
    if (saved.theme === 'dark' || saved.theme === 'light') root.setAttribute('data-theme', saved.theme);
    if (saved.textSize === 'small' || saved.textSize === 'large') root.setAttribute('data-text-size', saved.textSize);
  } catch (error) {
    // Defaults (system theme, normal size) apply.
  }
})();
