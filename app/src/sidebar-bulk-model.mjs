// Session row menus: the multi-selection items (Claude Desktop 2.31226.0 c39a247c4 ve, readable 66-300; ce4f4374c Me /
// Ne, readable 1098-1340) and the single row's Move to group submenu (shared-21 lz / cz, readable 11042-11128).

/** k / d(): the 1-9 digit of a numbered submenu row (none from the tenth on). */
export const digitFor = (index) => (index < 9 ? String(index + 1) : undefined);

/** X(e, starred, pin): the selected sessions a Pin {count} (pin true) or Unpin {count} (pin false) would change. */
export function pinTargets(sessions = [], metadata = {}, pin = true) {
  return sessions.filter((session) => session?.id && session.canPin !== false && (metadata[session.id]?.pinned === true) !== pin);
}

/** _e: the open session goes last, so a bulk change reaches the session on screen after the others. */
export function openSessionLast(sessions = [], currentId = null) {
  if (!currentId) return [...sessions];
  return [...sessions.filter((session) => session.id !== currentId), ...sessions.filter((session) => session.id === currentId)];
}

/** ve(): the multi payload Me renders. pin / unpin exist only when some selected session would change. */
export function multiMenuState(sessions = [], metadata = {}) {
  const count = sessions.length;
  const pin = pinTargets(sessions, metadata, true).length, unpin = pinTargets(sessions, metadata, false).length;
  return { count, pin: pin > 0 ? { count: pin } : undefined, unpin: unpin > 0 ? { count: unpin } : undefined };
}

/** Me hotkeys: p pins (else unpins), u marks unread, a archives (or unarchives), d deletes. */
export function multiHotkeys(state, { allArchived = false } = {}) {
  const keys = [];
  if (state.pin) keys.push(["p", "pin"]);
  else if (state.unpin) keys.push(["p", "unpin"]);
  keys.push(["u", "mark-unread"], ["a", allArchived ? "unarchive" : "archive"], ["d", "delete"]);
  return keys;
}

/**
 * lz: the Move to group submenu of one session. Every custom group is a radio row (checked when the session is in
 * it); 'Ungrouped' (cz: always "Ungrouped" for code custom groups, never checked) follows a separator while the session
 * is assigned (u = currentGroupId !== undefined); 'New group…' closes it. With hotkeys every row is numbered 1-9 in
 * that order. Returns the rows ({ kind: "group" | "ungrouped" | "create" | "separator" }).
 */
export function moveToGroupRows({ customGroups = [], currentGroupId, canCreate = true, numbered = true } = {}) {
  const showUngrouped = currentGroupId !== undefined && currentGroupId !== null;
  const rows = [], digit = (index) => (numbered ? digitFor(index) : undefined);
  customGroups.forEach((group, index) => rows.push({ kind: "group", id: group.id, name: group.name, checked: currentGroupId === group.id, digit: digit(index) }));
  if (customGroups.length > 0 && showUngrouped) rows.push({ kind: "separator" });
  if (showUngrouped) rows.push({ kind: "ungrouped", id: null, checked: false, digit: digit(customGroups.length) });
  if (canCreate) {
    if (customGroups.length > 0 && !showUngrouped) rows.push({ kind: "separator" });
    rows.push({ kind: "create", digit: digit(customGroups.length + (showUngrouped ? 1 : 0)) });
  }
  return rows;
}
