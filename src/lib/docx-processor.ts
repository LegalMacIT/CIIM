import mammoth from "mammoth";
import JSZip from "jszip";
import { BOOLEAN_KEYS } from "./fields";

// Heading text → boolean field key
const HEADING_TO_FIELD: Record<string, string> = {
  "Getting Started": "Getting_Started",
  "Create an Exchange Rule": "Exchange_Rule",
  "Review Checked Out Documents Report": "Checked_Out_Docs",
  "Review and Prepare for the Desktop Transition Process": "Desktop_Transition",
  "Enabling Auto Discovery on Windows DNS Server": "Auto_Discovery",
  "Upgrade iManage Work Desktop for Windows to v10.10": "Upgrading_imWork",
  "Configure Adobe Acrobat for iManage Integration": "Acrobat",
  "Prepare for iManage Workspace Generation": "Workspace_Gen",
  "Create SAML Application for iManage Share for Entra ID": "SAML_Share",
  "Creating a SAML SSO application for iManage Share on Okta": "SAML_Share_Okta",
  "Create a SAML SSO application for iManage Work on Entra ID": "SAML_Work",
  "Creating a SAML SSO application for iManage Work 10 on Okta": "saml_okta",
  "Create a SAML SCIM application for iManage Work": "SCIM",
  "Install and Configure iManage Drive": "Drive",
  "Conduct User Acceptance Testing (UAT)": "UAT",
  "Install iManage Work for iPad and iPhone": "iOS_Mobility",
  "Install iManage File Transfer Extension": "File_Transfer",
  "Go Live Issues to Anticipate": "Go_Live",
  "Installing and Configuring Litera Compare v11.16+": "Litera_Compare",
  "Installing and Integrating Tungsten Power PDF": "Power_PDF",
  "Integrating Foxit PDF Editor": "Foxit_PDF",
  "Approve Request for URL Redirection": "URL_Redirect",
  "Configure Next Generation Coauthoring on Word for Windows": "CoAuthoring",
  "Installing iManage Reporting Tool": "reporting_tool",
  "Best Practices for Citrix/Remote Desktop Services": "Citrix_RDS",
  "Plan for Integrated Third-Party Applications": "ThirdParty_Apps",
};

// ── Color preservation ──────────────────────────────────────────────────────
// Maps lower-cased Word hex colors (no #) to CSS class names used in style map below.
// Covers the standard Office color wheel + common CARM/professional document colors.
const WORD_COLOR_MAP: Record<string, string> = {
  "c00000": "wc-c00000", // Dark Red — warnings, important notes
  "ff0000": "wc-ff0000", // Red
  "9c0006": "wc-c00000", // Office "Bad" red — alias to same class
  "e26b0a": "wc-e26b0a", // Dark Orange
  "c55a11": "wc-c55a11", // CARM brand orange
  "ed7d31": "wc-ed7d31", // Office orange
  "ffc000": "wc-ffc000", // Amber/Gold
  "ff7200": "wc-e26b0a", // Orange alias
  "0070c0": "wc-0070c0", // Standard blue
  "4472c4": "wc-4472c4", // Office theme blue
  "2f75b6": "wc-0070c0", // Blue alias
  "00b0f0": "wc-00b0f0", // Light blue
  "17375e": "wc-17375e", // Navy
  "1f3864": "wc-17375e", // Dark navy alias
  "00b050": "wc-00b050", // Green
  "70ad47": "wc-70ad47", // Office light green
  "548235": "wc-548235", // Dark green
  "7030a0": "wc-7030a0", // Purple
  "8b4726": "wc-8b4726", // Dark brown/rust
  "595959": "wc-595959", // Dark gray
  "808080": "wc-595959", // Gray alias
  "404040": "wc-404040", // Charcoal
};

// Style map entries generated from the color map (appended to mammoth styleMap)
const COLOR_STYLE_MAP = Array.from(
  new Set(Object.values(WORD_COLOR_MAP))
).map((cls) => `r[style-name='${cls}'] => span.${cls}:fresh`);

// Transform: tag runs that have a Word colour with the mapped CSS class name as their styleName.
// This runs before the styleMap is applied, so the styleMap entries above will match.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammothTransforms = (mammoth as any).transforms;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildColorTransform(): ((doc: any) => any) | undefined {
  if (!mammothTransforms?.run) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mammothTransforms.run((run: any) => {
    const col: string | undefined = run.colour; // British spelling in mammoth
    if (col && col !== "auto" && col.toLowerCase() !== "000000" && !run.styleName) {
      const key = col.toLowerCase();
      const cls = WORD_COLOR_MAP[key];
      if (cls) return { ...run, styleName: cls };
    }
    return run;
  });
}

// ── Block parsing ──────────────────────────────────────────────────────────

function parseBlocks(html: string): string[] {
  const blocks: string[] = [];
  const pattern = /(<(?:h[1-4]|p|ul|ol|table)[^>]*>[\s\S]*?<\/(?:h[1-4]|p|ul|ol|table)>)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match.index > last) blocks.push(html.slice(last, match.index));
    blocks.push(match[1]);
    last = match.index + match[0].length;
  }
  if (last < html.length) blocks.push(html.slice(last));
  return blocks.filter((b) => b.trim());
}

function headingLevel(block: string): number | null {
  const m = block.match(/^<h([1-4])/);
  return m ? parseInt(m[1]) : null;
}

function headingText(block: string): string {
  return block.replace(/<[^>]+>/g, "").trim();
}

// ── "Important" note marking ───────────────────────────────────────────────
// Detects paragraphs that start with "Important" (with or without bold markup)
// and injects the class "note-important" for CSS icon + highlight treatment.

function markImportantNotes(html: string): string {
  return html.replace(
    /<p([^>]*)>((?:\s*<(?:strong|em|b|span)[^>]*>\s*)?Important\s*:)/gi,
    (_, attrs: string, prefix: string) => {
      if (attrs.includes("note-important")) return `<p${attrs}>${prefix}`;
      const newAttrs = /class="[^"]*"/.test(attrs)
        ? attrs.replace(/class="([^"]*)"/, 'class="$1 note-important"')
        : `${attrs} class="note-important"`;
      return `<p${newAttrs}>${prefix}`;
    }
  );
}

// ── Callout: orange IT Task boxes ──────────────────────────────────────────

function isCalloutItem(block: string): boolean {
  return (
    block.includes('class="callout-it"') ||
    block.includes('class="task-checkbox"') ||
    block.includes('class="task-checkbox-indent"')
  );
}

// Extract all cell content from a table block, discarding the table structure.
// Prevents Word layout-tables from creating visual columns inside callout boxes.
function flattenTableBlock(tableHtml: string): string {
  const parts: string[] = [];
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(tableHtml)) !== null) {
    const content = m[1].trim();
    if (content) parts.push(content);
  }
  return parts.join("\n");
}

function wrapITTaskBoxes(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const text = headingText(block);

    if (/\b(IT Tasks|Initial Setup Tasks)\s*$/.test(text)) {
      const boxItems: string[] = [];
      i++;
      // Skip any intermediate "IT Tasks" label paragraph (e.g. from a text-box anchor)
      // that is not itself a callout item
      if (
        i < blocks.length &&
        !isCalloutItem(blocks[i]) &&
        /\bIT\s+Tasks\b/.test(headingText(blocks[i]))
      ) {
        i++;
      }
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        const b = blocks[i++];
        boxItems.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
      }
      if (boxItems.length > 0) {
        // Strip any leading {{field}} prefix so the header never double-prints the firm name
        const baseLabel = text.trim().replace(/^\{\{[^}]+\}\}\s*/, "");
        output.push(
          `<div class="callout-it-box">` +
            `<div class="callout-it-header">{{firm_company_nickname}} ${baseLabel}</div>` +
            boxItems.join("") +
            `</div>`
        );
      }
      continue;
    }

    if (block.includes('class="callout-it"')) {
      const boxItems: string[] = [block.startsWith("<table") ? flattenTableBlock(block) : block];
      i++;
      while (i < blocks.length && isCalloutItem(blocks[i])) {
        const b = blocks[i++];
        boxItems.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
      }
      output.push(
        `<div class="callout-it-box">` +
          `<div class="callout-it-header">{{firm_company_nickname}} IT Tasks</div>` +
          boxItems.join("") +
          `</div>`
      );
      continue;
    }

    output.push(block);
    i++;
  }

  return output;
}

// ── Callout: blue Helpful Insights boxes ──────────────────────────────────

function wrapHelpfulInsights(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const text = headingText(block);

    if (text === "Helpful Insights") {
      const content: string[] = [];
      i++;
      while (i < blocks.length) {
        const b = blocks[i];
        if (b.match(/^<(?:p|ul|ol|table)[> ]/)) {
          content.push(b.startsWith("<table") ? flattenTableBlock(b) : b);
          i++;
        } else {
          break;
        }
      }
      output.push(
        `<div class="callout-info">` +
          `<div class="callout-info-header">Helpful Insights</div>` +
          content.join("") +
          `</div>`
      );
      continue;
    }

    output.push(block);
    i++;
  }

  return output;
}

// ── Editable blocks: heading-bounded free-text sections ───────────────────
// Content that differs per client engagement (or is purely narrative, with no
// checkboxes/toggle plumbing riding on it) is marked as a live-editable block
// (pencil icon in the manual) instead of being baked into the static template.
// Each spec's range spans from its own heading through the last block before
// the next heading at or above `stopAtLevel` — e.g. the h3 Cutover Checklist
// stops at the next h1/h2, while the h1 Project Plan intro stops only at the
// next h1 (so its "About this Document" h2 + intro paragraph are included).
// The spec's own heading is rendered OUTSIDE the editable div, as a fixed
// label — the editable-block sanitizer (src/app/actions/editable-blocks.ts)
// doesn't allow heading tags, so a heading living inside the editable region
// would degrade to plain text the first time anyone saves an edit. Keeping it
// outside means its styling never depends on what got saved, and it can't be
// accidentally deleted while editing the body below it.
interface EditableHeadingBlockSpec {
  heading: string;
  level: number;
  stopAtLevel: number;
  key: string;
}

const EDITABLE_HEADING_BLOCKS: EditableHeadingBlockSpec[] = [
  { heading: "Final Transition Cutover Checklist", level: 3, stopAtLevel: 2, key: "final_cutover_checklist" },
  { heading: "Project Plan and Instruction Set", level: 1, stopAtLevel: 1, key: "project_plan_intro" },
];

function wrapEditableBlocks(blocks: string[]): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const level = headingLevel(block);
    const spec =
      level !== null
        ? EDITABLE_HEADING_BLOCKS.find((s) => s.level === level && headingText(block) === s.heading)
        : undefined;

    if (spec) {
      const heading = block; // stays outside the editable div — see comment above
      const content: string[] = [];
      i++;
      while (i < blocks.length) {
        const nextLevel = headingLevel(blocks[i]);
        if (nextLevel !== null && nextLevel <= spec.stopAtLevel) break;
        content.push(blocks[i]);
        i++;
      }
      output.push(
        heading +
          `<div class="ciim-editable-block" data-editable-key="${spec.key}">` +
          content.join("") +
          `</div>`
      );
      continue;
    }

    output.push(block);
    i++;
  }

  return output;
}

// ── Editable block: Title Page ─────────────────────────────────────────────
// The cover page (client name, transition date, CARM contact info) is plain
// <p> content with no bounding heading, so it's matched by its own markers
// instead of headingLevel/headingText: starts at the "cover-title" paragraph
// ("Cloud iManage C2C Transition") and ends at the paragraph containing the
// carmconsulting.com link.
const TITLE_PAGE_KEY = "title_page";

function wrapTitlePageBlock(blocks: string[]): string[] {
  const startIdx = blocks.findIndex((b) => b.includes('class="cover-title"'));
  if (startIdx === -1) return blocks;

  let endIdx = -1;
  for (let i = startIdx; i < blocks.length; i++) {
    if (blocks[i].toLowerCase().includes("carmconsulting.com")) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return blocks;

  const content = blocks.slice(startIdx, endIdx + 1);
  const wrapped = `<div class="ciim-editable-block" data-editable-key="${TITLE_PAGE_KEY}">${content.join("")}</div>`;

  return [...blocks.slice(0, startIdx), wrapped, ...blocks.slice(endIdx + 1)];
}

// ── Editable sub-blocks within boolean-gated sections ──────────────────────
// These sections are already wrapped in <div data-section="KEY"> by wrapSections
// (drives the dashboard show/hide toggle) and some contain IT Tasks checklists
// whose checkboxes (data-task-id) drive per-task completion tracking. The
// editable-block sanitizer (src/app/actions/editable-blocks.ts) only allows
// plain-text formatting, so wrapping a checklist in it would flatten its
// checkboxes to text and break tracking the first time anyone saves an edit.
// To keep both features intact, this runs *after* wrapSections (string-level,
// not blocks-level) and carves out one or more editable regions per section via
// `startMarker`/`stopBeforeMarker`, leaving checklists (and any other untouched
// content) exactly as they were.
interface GatedRegionSpec {
  editableKey: string;
  /** Regex matching the exact start of this region (searched from the end of the
   *  previous region) — its match index becomes the boundary directly, so it must
   *  match from the true start of the containing tag. Use `headingStartMarker()`
   *  for heading-based starts: a plain text search landing mid-heading (e.g. right
   *  after a mammoth bookmark anchor's "</a>") would back up to that anchor's own
   *  "<", not the heading tag, and split the heading in half. Omit to start at the
   *  beginning of the section (or right after the previous region). */
  startMarker?: RegExp;
  /** Text marking where this region stops (exclusive) — a plain substring inside
   *  the following tag's own attributes (e.g. 'class="callout-it-box"'), safe to
   *  back up from since the nearest preceding "<" is that same tag's opening
   *  bracket. Omit to run through the end of the section. */
  stopBeforeMarker?: string;
}

interface GatedEditableSpec {
  sectionKey: string;
  regions: GatedRegionSpec[];
}

// Matches a heading tag optionally preceded by mammoth's empty bookmark anchors
// (e.g. <h3><a id="_Toc123"></a>Heading Text</h3>) so the match starts at the
// heading tag itself rather than drifting into a preceding anchor's "</a>".
function headingStartMarker(level: number, text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<h${level}>(?:<a[^>]*></a>)*${escaped}</h${level}>`);
}

const GATED_EDITABLE_BLOCKS: GatedEditableSpec[] = [
  {
    sectionKey: "Upgrading_imWork",
    regions: [{ editableKey: "upgrade_imwork_desktop", stopBeforeMarker: 'class="callout-it-box"' }],
  },
  {
    sectionKey: "Drive",
    regions: [
      { editableKey: "install_configure_drive", stopBeforeMarker: 'class="callout-it-box"' },
      {
        editableKey: "install_configure_drive_details",
        startMarker: headingStartMarker(3, "Installing and Configuring iManage Drive"),
      },
    ],
  },
  { sectionKey: "UAT", regions: [{ editableKey: "conduct_uat" }] },
  { sectionKey: "Go_Live", regions: [{ editableKey: "go_live_issues" }] },
];

// Find the </div> matching the div whose content starts at `contentStart` (the
// opening tag has already been consumed). Depth-aware so nested divs inside the
// block (e.g. callout boxes) don't terminate the match early.
function findMatchingDivEnd(html: string, contentStart: number): number {
  let depth = 1;
  let pos = contentStart;
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + 6;
    }
  }
  return -1;
}

// A marker's index points into the middle of text content; back up to the start
// of whatever tag encloses it so the editable region boundary doesn't split a tag.
function backUpToTagStart(html: string, idx: number): number {
  const tagStart = html.lastIndexOf("<", idx);
  return tagStart >= 0 ? tagStart : idx;
}

// If `html` starts with a heading tag, splits it off so it can be rendered as a
// fixed label outside the editable div instead of inside it — the editable-block
// sanitizer doesn't allow heading tags, so a heading left inside the editable
// region would degrade to plain text the first time anyone saves an edit.
function splitLeadingHeading(html: string): { heading: string; rest: string } {
  const m = /^<h([1-4])>.*?<\/h\1>/.exec(html);
  if (!m) return { heading: "", rest: html };
  return { heading: m[0], rest: html.slice(m[0].length) };
}

function wrapGatedEditableBlocks(html: string): string {
  let result = html;

  for (const spec of GATED_EDITABLE_BLOCKS) {
    const openRe = new RegExp(`<div data-section="${spec.sectionKey}"[^>]*>`);
    const m = openRe.exec(result);
    if (!m) continue;

    const contentStart = m.index + m[0].length;
    const contentEnd = findMatchingDivEnd(result, contentStart);
    if (contentEnd < 0) continue;

    const inner = result.slice(contentStart, contentEnd);
    let newInner = "";
    let cursor = 0;

    for (const region of spec.regions) {
      let regionStart = cursor;
      if (region.startMarker) {
        const match = region.startMarker.exec(inner.slice(cursor));
        if (!match) continue; // marker not found in this template — skip, leave content untouched
        regionStart = cursor + match.index;
      }

      let regionEnd = inner.length;
      if (region.stopBeforeMarker) {
        const markerIdx = inner.indexOf(region.stopBeforeMarker, regionStart);
        if (markerIdx >= 0) regionEnd = backUpToTagStart(inner, markerIdx);
      }

      const { heading, rest } = splitLeadingHeading(inner.slice(regionStart, regionEnd));

      newInner += inner.slice(cursor, regionStart);
      newInner += heading;
      newInner += `<div class="ciim-editable-block" data-editable-key="${region.editableKey}">${rest}</div>`;
      cursor = regionEnd;
    }

    newInner += inner.slice(cursor);
    result = result.slice(0, contentStart) + newInner + result.slice(contentEnd);
  }

  return result;
}

// ── Section wrapping + task ID assignment ─────────────────────────────────

// Exact match first; falls back to stripping {{placeholders}} and parenthetical
// clauses so headings like "Install and Configure iManage Drive (Network drive {{drive_letter}})"
// still match the simpler key "Install and Configure iManage Drive".
function lookupFieldKey(text: string): string | undefined {
  if (HEADING_TO_FIELD[text]) return HEADING_TO_FIELD[text];
  const stripped = text
    .replace(/^[^a-zA-Z0-9]+/, "")  // strip leading non-alpha markers (e.g. asterisk)
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return HEADING_TO_FIELD[stripped];
}

function wrapSections(blocks: string[]): string {
  const output: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const level = headingLevel(block);

    if (level !== null) {
      const text = headingText(block);
      const fieldKey = lookupFieldKey(text);

      if (fieldKey && BOOLEAN_KEYS.has(fieldKey)) {
        const section: string[] = [block];
        i++;
        let taskNum = 0;

        while (i < blocks.length) {
          const nextLevel = headingLevel(blocks[i]);
          if (nextLevel !== null && nextLevel <= level) break;

          // If this inner heading is itself a toggleable sub-section, wrap it independently
          if (nextLevel !== null) {
            const subText = headingText(blocks[i]);
            const subKey = lookupFieldKey(subText);
            if (subKey && BOOLEAN_KEYS.has(subKey)) {
              const subSection: string[] = [blocks[i]];
              i++;
              let subTaskNum = 0;
              while (i < blocks.length) {
                const subLevel = headingLevel(blocks[i]);
                if (subLevel !== null && subLevel <= nextLevel) break;
                const stamped = blocks[i].replace(/<input type="checkbox" \/>/g, () => {
                  subTaskNum++;
                  return `<input type="checkbox" data-task-id="${subKey}-task-${subTaskNum}" data-section="${subKey}" />`;
                });
                subSection.push(stamped);
                i++;
              }
              const cleanSubTitle = subText.replace(/^[^a-zA-Z0-9]+/, "").replace(/"/g, "&quot;");
              section.push(
                `<div data-section="${subKey}" data-section-title="${cleanSubTitle}" data-total-tasks="${subTaskNum}">` +
                  subSection.join("") +
                  `</div>`
              );
              continue;
            }
          }

          const stamped = blocks[i].replace(/<input type="checkbox" \/>/g, () => {
            taskNum++;
            return `<input type="checkbox" data-task-id="${fieldKey}-task-${taskNum}" data-section="${fieldKey}" />`;
          });
          section.push(stamped);
          i++;
        }

        const encodedTitle = text.replace(/"/g, "&quot;");
        output.push(
          `<div data-section="${fieldKey}" data-section-title="${encodedTitle}" data-total-tasks="${taskNum}">` +
            section.join("") +
            `</div>`
        );
        continue;
      }
    }

    output.push(block);
    i++;
  }

  return output.join("");
}

// ── Nested list cleanup ────────────────────────────────────────────────────
// mammoth sometimes wraps <ol> items in <ul><li>…</li></ul> when Word uses
// ListParagraph style for numbered content. Unwrap those spurious bullet shells.
// The original regex only handled a single <ol> inside the <li>; this version
// uses depth tracking so it correctly removes the wrapper even when the <li>
// contains multiple consecutive <ol> elements (as seen in SCIM attribute mapping).

function cleanupNestedLists(html: string): string {
  let result = html;
  let changed = true;

  while (changed) {
    changed = false;
    let i = 0;

    while (i < result.length) {
      // Must start with <ul><li> where the <li> content begins with <ol>
      if (!result.startsWith("<ul><li>", i)) { i++; continue; }

      const liContentStart = i + 8;
      if (!result.startsWith("<ol>", liContentStart)) { i++; continue; }

      // Find the matching </li> by tracking <li> depth
      let liDepth = 1;
      let j = liContentStart;
      while (j < result.length && liDepth > 0) {
        if (result.startsWith("<li", j) && (result[j + 3] === ">" || result[j + 3] === " ")) {
          liDepth++;
          j += 3;
        } else if (result.startsWith("</li>", j)) {
          liDepth--;
          if (liDepth === 0) break;
          j += 5;
        } else {
          j++;
        }
      }

      if (liDepth !== 0 || !result.startsWith("</li>", j)) { i++; continue; }

      const liContent = result.slice(liContentStart, j);

      // Only unwrap single-item <ul> (next tag after </li> must be </ul>)
      if (!result.startsWith("</ul>", j + 5)) { i++; continue; }

      result = result.slice(0, i) + liContent + result.slice(j + 10); // +10 skips </li></ul>
      changed = true;
    }
  }

  return result;
}

// ── Ordered list split continuation ───────────────────────────────────────
// mammoth creates a fresh <ol> (starting at 1) each time a numbered list is
// interrupted by a non-list paragraph (URL text, notes, images). This function
// detects consecutive <ol> elements separated only by <p> blocks, counts the
// items in the first list, and sets start="N" on the continuation so numbering
// flows continuously across the interruption. Handles nested lists correctly
// by tracking depth. Runs after cleanupNestedLists so <ul><li><ol> shells
// are already unwrapped before we look for split pairs.

function findOlEnd(html: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html[i] === "<") {
      if (html.startsWith("<ol", i) && (html[i + 3] === ">" || html[i + 3] === " ")) {
        depth++;
        i += 4;
      } else if (html.startsWith("</ol>", i)) {
        depth--;
        if (depth === 0) return i + 5;
        i += 5;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  return html.length;
}

function countTopLevelLi(content: string): number {
  let count = 0;
  let depth = 0;
  let i = 0;
  while (i < content.length) {
    if (content[i] === "<") {
      if (
        (content.startsWith("<ol", i) && (content[i + 3] === ">" || content[i + 3] === " ")) ||
        (content.startsWith("<ul", i) && (content[i + 3] === ">" || content[i + 3] === " "))
      ) {
        depth++;
        i += 4;
      } else if (content.startsWith("</ol>", i) || content.startsWith("</ul>", i)) {
        depth--;
        i += 5;
      } else if (
        content.startsWith("<li", i) &&
        (content[i + 3] === ">" || content[i + 3] === " ") &&
        depth === 0
      ) {
        count++;
        i += 3;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  return count;
}

function fixSplitOrderedLists(html: string): string {
  let result = html;
  let changed = true;

  while (changed) {
    changed = false;
    let i = 0;

    while (i < result.length) {
      const olStart = result.indexOf("<ol", i);
      if (olStart === -1) break;
      // Match <ol> and <ol start="N"> but not other tags starting with <ol
      if (result[olStart + 3] !== ">" && result[olStart + 3] !== " ") {
        i = olStart + 1;
        continue;
      }

      const olOpenTagEnd = result.indexOf(">", olStart) + 1;
      const olOpenTag = result.slice(olStart, olOpenTagEnd);
      const olEnd = findOlEnd(result, olStart);
      const olContent = result.slice(olOpenTagEnd, olEnd - 5); // between </opening-tag> and </ol>

      // Scan ahead: accept only whitespace and <p>...</p> blocks between two <ol>s
      let j = olEnd;
      let hasPContent = false;

      while (j < result.length) {
        const wsMatch = result.slice(j).match(/^\s+/);
        if (wsMatch) { j += wsMatch[0].length; continue; }

        if (result.startsWith("<p", j)) {
          const pClose = result.indexOf("</p>", j);
          if (pClose === -1) break;
          hasPContent = true;
          j = pClose + 4;
          continue;
        }
        break;
      }

      // Patch bare <ol> continuations whether separated by <p> tags or directly adjacent
      if (result.startsWith("<ol>", j)) {
        const liCount = countTopLevelLi(olContent);
        const startMatch = olOpenTag.match(/start="(\d+)"/);
        const firstStart = startMatch ? parseInt(startMatch[1]) : 1;
        const nextStart = firstStart + liCount;

        result = result.slice(0, j) + `<ol start="${nextStart}">` + result.slice(j + 4);
        changed = true;
        // Re-examine from the newly patched <ol> so chained splits are resolved
        i = j;
      } else {
        i = olEnd;
      }
    }
  }

  return result;
}

// ── TOC removal ───────────────────────────────────────────────────────────

function stripTOC(html: string): string {
  // Remove the "Table of Contents" heading (any h1-h4, with optional inline markup)
  html = html.replace(
    /<h[1-4][^>]*>(?:\s*<[^>]*>\s*)*\s*Table of Contents\s*(?:\s*<\/[^>]*>\s*)*<\/h[1-4]>/gi,
    ""
  );
  // Remove all TOC entry paragraphs (toc-1, toc-2, toc-3)
  html = html.replace(/<p class="toc-[123]"[^>]*>[\s\S]*?<\/p>/g, "");
  return html;
}

// ── Word MERGEFIELD repair ─────────────────────────────────────────────────
// When a merge code is inserted via Word's Insert > Quick Parts > Field (rather
// than typed as literal «field» text), Word stores it as a <w:fldSimple> element
// whose cached display value is the same «field» text we expect — but mammoth has
// no reader for <w:fldSimple> at all, so the whole element (including its cached
// text) is silently dropped. This leaves sentences that trail off mid-word (e.g.
// "test SSO by logging into  as ." in the CARM CIIM template). Complex fields
// (w:fldChar begin/separate/end) aren't affected — mammoth already passes their
// cached display runs through untouched — so only <w:fldSimple> needs unwrapping.
// We patch this before mammoth ever sees the document by unzipping the .docx,
// replacing each <w:fldSimple w:instr="... MERGEFIELD ...">…</w:fldSimple> with
// just its inner runs (dropping the field wrapper, keeping the cached «field»
// text), and re-zipping. The existing «field» → {{field}} regex below then picks
// up the recovered text exactly as it does for every other merge code.
const MERGEFIELD_XML_PART_RE = /^word\/(document|header\d*|footer\d*)\.xml$/;

function unwrapSimpleMergeFields(xml: string): string {
  return xml.replace(
    /<w:fldSimple\b[^>]*w:instr="[^"]*MERGEFIELD[^"]*"[^>]*>([\s\S]*?)<\/w:fldSimple>/g,
    "$1"
  );
}

async function repairMergeFields(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  for (const path of Object.keys(zip.files)) {
    if (!MERGEFIELD_XML_PART_RE.test(path)) continue;
    const file = zip.file(path);
    if (!file) continue;

    const xml = await file.async("string");
    const patched = unwrapSimpleMergeFields(xml);
    if (patched !== xml) {
      zip.file(path, patched);
      changed = true;
    }
  }

  return changed ? zip.generateAsync({ type: "nodebuffer" }) : buffer;
}

// ── Main export ────────────────────────────────────────────────────────────

export async function processDocx(buffer: Buffer | ArrayBuffer): Promise<string> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const repairedBuffer = await repairMergeFields(nodeBuffer);
  const input = { buffer: repairedBuffer };
  const colorTransform = buildColorTransform();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    styleMap: [
      "p[style-name='Title'] => p.cover-title:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Hang indent checkbox'] => p.task-checkbox:fresh",
      "p[style-name='Indent checkbox'] => p.task-checkbox-indent:fresh",
      "p[style-name='Indent checkbox2'] => p.task-checkbox-indent:fresh",
      "p[style-name='First CARM IT task'] => p.callout-it:fresh",
      "p[style-name='ALL_CAPS'] => p.code-line:fresh",
      "p[style-name='Fixed_Font'] => p.fixed-font:fresh",
      "p[style-name='Tight_Lines_Indent'] => p.tight-lines-indent:fresh",
      "p[style-name='List_Continue'] => p.list-continue:fresh",
      "r[style-name='Fixed font2'] => span.fixed-font:fresh",
      "r[style-name='Fixed_Font10pt'] => span.fixed-font:fresh",
      "r[style-name='Fixed_Font8pt'] => span.fixed-font-8pt:fresh",
      "r[style-name='Red font'] => span.red-font:fresh",
      "r[style-name='Blue_font'] => span.blue-font:fresh",
      "r[style-name='Copy_contents'] => span.copy-contents:fresh",
      "r[style-name='Orange font'] => span.orange-font:fresh",
      "r[style-name='Hyperlink8pt'] => span.hyperlink-8pt:fresh",
      "r[style-name='Hyperlink13pt'] => span.hyperlink-13pt:fresh",
      "r[style-name='Hyperlink'] => span.hyperlink-inline:fresh",
      "p[style-name='TOC 1'] => p.toc-1:fresh",
      "p[style-name='TOC 2'] => p.toc-2:fresh",
      "p[style-name='TOC 3'] => p.toc-3:fresh",
      ...COLOR_STYLE_MAP,
    ],
  };
  if (colorTransform) options.transformDocument = colorTransform;

  const { value: rawHtml } = await mammoth.convertToHtml(input, options);

  // When merge codes are formatted with a character style (e.g. Red font), mammoth
  // wraps each run in its own span, splitting «, fieldname, and » into separate elements.
  // Strip the span wrappers from just the guillemets so the merge code regex can match.
  let html = rawHtml
    .replace(/<span[^>]*>(«|»)<\/span>/g, "$1")
    // Field name may still be wrapped in a span — match and unwrap it too
    .replace(/«(?:<span[^>]*>)?([^»<]+?)(?:<\/span>)?»/g, (_, key: string) => `{{${key.trim()}}}`)
    // Handle any remaining unstyled «field» markers
    .replace(/«([^»]+)»/g, (_, key: string) => `{{${key.trim()}}}`);

  // Post-processing pipeline
  html = markImportantNotes(html);
  let blocks = parseBlocks(html);
  blocks = wrapITTaskBoxes(blocks);
  blocks = wrapHelpfulInsights(blocks);
  blocks = wrapTitlePageBlock(blocks);
  blocks = wrapEditableBlocks(blocks);
  html = wrapSections(blocks);
  html = wrapGatedEditableBlocks(html);
  html = cleanupNestedLists(html);
  html = fixSplitOrderedLists(html);
  html = stripTOC(html);

  return html;
}
