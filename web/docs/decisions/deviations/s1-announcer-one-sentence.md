# S1 · The announcer says one sentence per change, so Undo keeps the restored selection

**Legacy behaviour.** `render()` built a sentence on every call, and the dissection panel held a changed hidden-part count for the rest of the task (`viewer/ui/panels/dissection.js:36-42`). Undo renders twice in one task: `model.undoDissection()` emits `change` (render 1), then `display()` renders again (`app.js:1277`, 221-228). Render 1 said "Selected: Precuneus, left. All parts shown"; render 2, finding the selection unchanged, reached `else if (dissectionSaid) announce(dissectionSaid)` (app.js:1676) and overwrote it with "All parts shown". The restored selection was never heard (measured in the legacy viewer: Hide then Undo on `#region=destrieux:left:30`).

**New behaviour.** One effect builds one sentence per batch of changes, so the count is joined to the selection or notice once ("Selected: Precuneus, left. All parts shown") and nothing overwrites it. Hide is unchanged ("Selection cleared — Precuneus is no longer shown. 1 part hidden").

**Standard.** WCAG 2.2 SC 4.1.3 Status Messages (AA): a status message must reach assistive technology without being replaced by a later, less complete one. `app.js:1670` already states the intent that the count joins the sentence so one announcer speaks once.
