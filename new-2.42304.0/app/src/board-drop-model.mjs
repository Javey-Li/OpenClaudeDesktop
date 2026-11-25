const text = (value) => (typeof value === "string" ? value.trim() : "");
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

export function localInspirationEndpoint(base) {
  if (!text(base)) throw new Error("灵感池地址还没配。");
  let url;
  try { url = new URL(base); } catch { throw new Error("灵感池地址读不出来。"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("灵感池地址必须是 http 或 https。");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("灵感池只许发到本机：127.0.0.1、localhost 或 ::1。");
  if (url.username || url.password) throw new Error("灵感池地址不能带用户名或密码。");
  if (!url.pathname.replace(/\/$/, "").endsWith("/drop")) url.pathname = `${url.pathname.replace(/\/$/, "")}/drop`;
  return url.toString();
}

export function buildInspirationDraft({ mode = "note", text: value = "", image = null } = {}) {
  if (mode === "image") {
    if (!image?.name || !text(image.type).startsWith("image/")) return { ok: false, reason: "请选一张图片。" };
    if (typeof image.data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return { ok: false, reason: "图片没读好，请重新选。" };
    if (image.data.length * 3 / 4 > MAX_IMAGE_BYTES) return { ok: false, reason: "图片不能超过 16 MB。" };
    return { ok: true, payload: { kind: "image", value: image.name, name: image.name, data: image.data } };
  }
  const input = String(value ?? "").trim();
  if (!input) return { ok: false, reason: "先写点什么。" };
  if (mode === "link") {
    let url;
    try { url = new URL(input); } catch { return { ok: false, reason: "这个链接还读不出来。" }; }
    if (!/^https?:$/.test(url.protocol)) return { ok: false, reason: "只收 http 或 https 链接。" };
    return { ok: true, payload: { kind: "url", value: input } };
  }
  return { ok: true, payload: { kind: "note", value: input } };
}
