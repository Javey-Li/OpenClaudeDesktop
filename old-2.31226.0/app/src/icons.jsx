import React from "react";
import glyphs from "./generated/icons.json";
// Glyph mapping from shared-frame-DVFSKIcx.js Ka.icons (2.31226.0, in step with the vendored c0f671921-CWPPK3vl font);
// the optical weight formula (Ka.wght) is unchanged since 2.110.1.
export function Icon({
  name,
  size = 16,
  weight = "regular",
  className = "",
  style,
  glyphMap = glyphs,
  ...props
}) {
  const master = size <= 18 ? 16 : 20;
  // shared-frame ta/sa: nearest size token, with ties choosing the larger token.
  const token = [12, 16, 20, 24, 28, 32].reduce((best, px) => Math.abs(px - size) <= Math.abs(best - size) ? px : best, 12);
  const regular = { 12: .8, 16: 1, 20: 1.2, 24: 1.4, 28: 1.6, 32: 1.8 };
  const stroke = weight === "strong" && [16, 20].includes(token)
    ? token === 16 ? 1.25 : 1.5
    : regular[token];
  const [lo, hi] = master === 16 ? [0.8, 1.25] : [1.125, 1.8];
  const w =
    Math.round(
      Math.max(
        400,
        Math.min(
          700,
          400 + 300 * (((stroke * master) / size - lo) / (hi - lo)),
        ),
      ) * 10,
    ) / 10;
  return (
    <span
      aria-hidden="true"
      data-cds="Icon"
      className={className}
      style={{ fontSize: size, fontWeight: w, ...style }}
      {...props}
    >
      {String.fromCodePoint(glyphMap[name] || glyphMap.Placeholder)}
    </span>
  );
}
const make = (name) => (props) => <Icon name={name} {...props} />;
export const SidebarSimple = make("Sidebar"),
  ArrowLeft = make("ArrowLeft"),
  ArrowRight = make("ArrowRight"),
  Plus = make("Add"),
  Code = make("Code"),
  ChatCircle = make("Chat"),
  Folder = make("Folder"),
  FolderOpen = make("FolderOpen"),
  CaretDown = make("CaretDown"),
  CaretRight = make("CaretRight"),
  ArrowUp = make("ArrowUp"),
  Stop = make("Stop"),
  Check = make("Check"),
  Terminal = make("CommandLine"),
  FileText = make("File"),
  X = make("X"),
  MagnifyingGlass = make("Search"),
  Gear = make("Settings"),
  SquaresFour = make("Grid"),
  Sun = make("Sun"),
  Moon = make("Moon"),
  Paperclip = make("Attachment"),
  ArrowClockwise = make("ArrowClockwise"),
  GitBranch = make("GitBranch"),
  ShieldCheck = make("Trust"),
  Copy = make("Copy"),
  WarningCircle = make("WarningCircle"),
  Monitor = make("Laptop"),
  Files = make("Files"),
  Clock = make("Clock"),
  SignIn = make("User"),
  ArrowsOutSimple = make("ArrowsOut"),
  DotsThree = make("DotsHorizontal");
