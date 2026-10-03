// Model menu decisions (current 2.2553.1 shared-14 FS → AS/kS), kept pure so
// they can be tested without the portal-based SourceMenu.Popup.

const modelKey = (model) => model?.model || model?.id;

// Effort display name: Codex/Harness report ids (low, high, max…); the menu,
// the composer trigger ('Effort: High', c8e04f916 effortSelectorTrigger) and
// Settings capitalize them.
export const effortName = (value = "") => String(value).charAt(0).toUpperCase() + String(value).slice(1);

// Codex has no main/overflow catalog section, so the returned order is kept
// with the first-four convention; explicit catalog sections take precedence.
// showFast: shared-14 ES returns null when the model has no 'fast' option
// (:6634-6636, rendered `te && a ? F(ES, …) : null` :6949), so the separator,
// header and row exist only for a model with a Fast service tier.
export function modelMenuSections({ models = [], fastTier = null } = {}) {
  const available = (Array.isArray(models) ? models : []).filter((model) => typeof modelKey(model) === "string");
  const showFast = !!fastTier;
  if (available.some((model) => model.section === "main" || model.section === "overflow")) {
    return {
      primary: available.filter((model) => model.section !== "overflow"),
      overflow: available.filter((model) => model.section === "overflow"),
      showFast,
    };
  }
  return { primary: available.slice(0, 4), overflow: available.slice(4), showFast };
}
