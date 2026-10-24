/**
 * Says a search's result count through the page's announcer once typing pauses, and only when it
 * says something new, so a screen reader hears what changed without a word per keystroke.
 */
export function createAnnouncer(announcer = document.getElementById('announcer'), delay = 500) {
  let timer = null;
  let said = null;
  return text => {
    clearTimeout(timer);
    if (text === said) return;
    timer = setTimeout(() => {
      said = text;
      announcer.textContent = text;
    }, delay);
  };
}
