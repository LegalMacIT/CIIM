"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { toggleTaskCompletion } from "@/app/actions/tasks";
import { addComment, deleteComment } from "@/app/actions/comments";
import { saveBooleanField } from "@/app/actions/form-values";
import type { ManualParts, ManualSection } from "@/lib/template-engine";
import type { SectionCommentRow } from "@/lib/database.types";
import { FIELD_GROUPS, CREDENTIAL_KEYS } from "@/lib/fields";

// ── Gamification ──────────────────────────────────────────────────────────────

const LEVELS = [
  { min: 0,   max: 0,   label: "Ready to Begin",   color: "#9ca3af" },
  { min: 1,   max: 24,  label: "Getting Started",  color: "#f59e0b" },
  { min: 25,  max: 49,  label: "In Progress",      color: "#3b82f6" },
  { min: 50,  max: 74,  label: "On Track",         color: "#8b5cf6" },
  { min: 75,  max: 99,  label: "Almost There",     color: "#C55A11" },
  { min: 100, max: 100, label: "Migration Master", color: "#16a34a" },
];

function getLevel(percent: number) {
  return LEVELS.find((l) => percent >= l.min && percent <= l.max) ?? LEVELS[0];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  parts: ManualParts;
  initialCompletedIds: string[];
  initialComments: SectionCommentRow[];
  userInitials: string;
  allValues: Record<string, string>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManualClient({
  parts,
  initialCompletedIds,
  initialComments,
  userInitials,
  allValues,
}: Props) {
  // Live task completion state (drives progress bars)
  const [completedIds, setCompletedIds] = useState(() => new Set(initialCompletedIds));

  // Ref kept in sync with current completedIds — used by SectionContent on remount
  const completedIdsRef = useRef(new Set(initialCompletedIds));
  useEffect(() => { completedIdsRef.current = completedIds; }, [completedIds]);

  // Manually-completed section keys (for sections with totalTasks === 0)
  const [manuallyCompleted, setManuallyCompleted] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const id of initialCompletedIds) {
      if (id.endsWith("-section")) s.add(id.slice(0, -8));
    }
    return s;
  });

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState(initialComments);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [activeCommentSection, setActiveCommentSection] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [achievement, setAchievement] = useState<string | null>(null);

  const achievementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPercentRef = useRef(0);
  const prevCompletedSections = useRef<Set<string>>(new Set());

  const { coverHtml, preambleHtml, sections } = parts;

  // Tracks which sections are currently enabled — initialised from server-side isEnabled flags,
  // then updated live when the user toggles sections in the summary panel.
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.isEnabled).map((s) => s.key))
  );

  const enabledSections = sections.filter((s) => enabledKeys.has(s.key));
  const totalTasks = enabledSections.reduce((sum, s) => sum + s.totalTasks, 0);

  const completedCount = [...completedIds].filter((id) => {
    const key = id.split("-task-")[0];
    return enabledSections.some((s) => s.key === key);
  }).length;

  const overallPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const xp = completedCount * 10;
  const level = getLevel(overallPercent);

  // ── Achievements ──────────────────────────────────────────────────────────

  const showAchievement = useCallback((msg: string) => {
    setAchievement(msg);
    if (achievementTimerRef.current) clearTimeout(achievementTimerRef.current);
    achievementTimerRef.current = setTimeout(() => setAchievement(null), 4500);
  }, []);

  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    const prevP = prevPercentRef.current;
    if (overallPercent > prevP) {
      for (const m of milestones) {
        if (prevP < m && overallPercent >= m) {
          showAchievement(
            m === 100
              ? "🏆 Migration Master! All tasks complete!"
              : `🎯 ${m}% milestone reached — keep going!`
          );
        }
      }
    }
    prevPercentRef.current = overallPercent;

    enabledSections.forEach((s) => {
      if (s.totalTasks === 0) return;
      const count = [...completedIds].filter((id) => id.startsWith(s.key + "-task-")).length;
      const isFull = count === s.totalTasks;
      const wasFull = prevCompletedSections.current.has(s.key);
      if (isFull && !wasFull) {
        showAchievement(`✓ "${s.title}" complete!`);
        prevCompletedSections.current = new Set([...prevCompletedSections.current, s.key]);
      } else if (!isFull && wasFull) {
        const next = new Set(prevCompletedSections.current);
        next.delete(s.key);
        prevCompletedSections.current = next;
      }
    });
  }, [completedIds, overallPercent, enabledSections, showAchievement]);

  // ── Task toggle (bidirectional) ───────────────────────────────────────────

  const handleToggleTask = useCallback((taskId: string, checked: boolean) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
    toggleTaskCompletion(taskId, checked);
  }, []);

  // ── Manual section complete (for sections with no tasks) ──────────────────

  const handleToggleManualComplete = useCallback((sectionKey: string) => {
    setManuallyCompleted((prev) => {
      const next = new Set(prev);
      const taskId = `${sectionKey}-section`;
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
        toggleTaskCompletion(taskId, false);
      } else {
        next.add(sectionKey);
        toggleTaskCompletion(taskId, true);
      }
      return next;
    });
  }, []);

  // ── Copy-to-clipboard (delegated — covers cover, preamble, and all sections) ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as Element).closest(".ciim-copy-btn") as HTMLButtonElement | null;
      if (!btn) return;
      const text = btn.dataset.copy ?? "";
      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add("copied");
        setTimeout(() => btn.classList.remove("copied"), 1500);
      }).catch(() => {});
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Scroll-spy TOC ────────────────────────────────────────────────────────

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    enabledSections.forEach((s) => {
      const el = document.getElementById(`section-${s.key}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSectionKey(s.key); },
        { rootMargin: "-15% 0px -65% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [enabledSections]);

  // ── Toggle section visibility from summary panel ──────────────────────────

  const handleToggleSection = useCallback((sectionKey: string) => {
    setEnabledKeys((prev) => {
      const wasEnabled = prev.has(sectionKey);
      const next = new Set(prev);
      if (wasEnabled) next.delete(sectionKey);
      else next.add(sectionKey);
      saveBooleanField(sectionKey, !wasEnabled);
      return next;
    });
  }, []);

  // ── Print section ─────────────────────────────────────────────────────────

  const handlePrintSection = useCallback((sectionKey: string) => {
    const toHide: HTMLElement[] = [];

    // Hide all other sections
    document.querySelectorAll<HTMLElement>("[data-ciim-section]").forEach((el) => {
      if (el.getAttribute("data-ciim-section") !== sectionKey) {
        el.classList.add("ciim-print-hidden");
        toHide.push(el);
      }
    });

    // Hide cover, preamble, and progress / gamification elements
    document.querySelectorAll<HTMLElement>(
      ".ciim-cover, .ciim-preamble, .ciim-overall-progress, .ciim-comments-panel, .ciim-achievement"
    ).forEach((el) => {
      el.classList.add("ciim-print-hidden");
      toHide.push(el);
    });

    const cleanup = () => toHide.forEach((el) => el.classList.remove("ciim-print-hidden"));
    // afterprint fires when the dialog is dismissed (print or cancel) — safer than synchronous cleanup
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }, []);

  // ── Comments ──────────────────────────────────────────────────────────────

  const handleAddComment = useCallback(async () => {
    if (!activeCommentSection || !commentDraft.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await addComment(activeCommentSection, commentDraft.trim(), userInitials);
      setComments((prev) => [...prev, newComment]);
      setCommentDraft("");
      setActiveCommentSection(null);
      setCommentsPanelOpen(true);
    } finally {
      setSubmittingComment(false);
    }
  }, [activeCommentSection, commentDraft, userInitials]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await deleteComment(commentId);
  }, []);

  const scrollToSection = useCallback((key: string) => {
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ciim-layout">
      {/* ── TOC Sidebar ── */}
      <nav className="ciim-toc print:hidden" aria-label="Section navigation">
        <div className="ciim-toc-header">Sections</div>
        <ul className="ciim-toc-list">
          {enabledSections.map((s) => {
            const sCount = [...completedIds].filter((id) => id.startsWith(s.key + "-task-")).length;
            const isDone =
              (s.totalTasks > 0 && sCount === s.totalTasks) ||
              (s.totalTasks === 0 && manuallyCompleted.has(s.key));
            const isActive = activeSectionKey === s.key;
            return (
              <li key={s.key}>
                <button
                  onClick={() => scrollToSection(s.key)}
                  className={[
                    "ciim-toc-item",
                    isActive ? "ciim-toc-item--active" : "",
                    isDone ? "ciim-toc-item--done" : "",
                  ].join(" ")}
                >
                  <span className="ciim-toc-check">{isDone ? "✓" : ""}</span>
                  <span className="ciim-toc-text">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Main content ── */}
      <div className="ciim-main">
        {/* Achievement toast */}
        {achievement && (
          <div className="ciim-achievement print:hidden" key={achievement}>
            {achievement}
          </div>
        )}

        {/* ── Overall progress + gamification ── */}
        {totalTasks > 0 && (
          <div className="ciim-overall-progress print:hidden">
            <span className="ciim-xp-badge" style={{ background: level.color }}>
              {level.label}
            </span>
            <div className="ciim-overall-progress-track">
              <div className="ciim-overall-progress-fill" style={{ width: `${overallPercent}%` }} />
            </div>
            <span className="ciim-overall-progress-label">
              {completedCount}/{totalTasks} · {xp} XP · {overallPercent}%
            </span>
          </div>
        )}

        {/* ── Comments panel ── */}
        {comments.length > 0 && (
          <div className="ciim-comments-panel print:hidden">
            <button className="ciim-comments-toggle" onClick={() => setCommentsPanelOpen((p) => !p)}>
              <span>{commentsPanelOpen ? "▲" : "▼"}</span>
              <span>Comments ({comments.length})</span>
            </button>
            {commentsPanelOpen && (
              <div className="ciim-comments-grid-wrapper">
                <div className="ciim-comments-grid">
                  <div className="ciim-comments-col-head">Section</div>
                  <div className="ciim-comments-col-head">By</div>
                  <div className="ciim-comments-col-head">Date</div>
                  <div className="ciim-comments-col-head">Comment</div>
                  <div />
                  {comments.map((c) => {
                    const section = sections.find((s) => s.key === c.section_key);
                    return (
                      <>
                        <div key={c.id + "-s"} className="ciim-comments-cell">{section?.title ?? c.section_key}</div>
                        <div key={c.id + "-i"} className="ciim-comments-cell ciim-comment-initials">{c.user_initials}</div>
                        <div key={c.id + "-d"} className="ciim-comments-cell ciim-comment-date">
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                        <div key={c.id + "-t"} className="ciim-comments-cell">{c.comment_text}</div>
                        <div key={c.id + "-x"} className="ciim-comments-cell">
                          <button onClick={() => handleDeleteComment(c.id)} className="ciim-comment-delete" title="Delete">×</button>
                        </div>
                      </>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Cover page (bordered card) ── */}
        {coverHtml && (
          <div className="ciim-cover" dangerouslySetInnerHTML={{ __html: coverHtml }} />
        )}

        {/* ── Preamble (TOC, Important Links, etc.) ── */}
        {preambleHtml && (
          <div className="ciim-preamble" dangerouslySetInnerHTML={{ __html: preambleHtml }} />
        )}

        {/* ── Sections ── */}
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.key);
          const sectionCompleted = [...completedIds].filter((id) =>
            id.startsWith(section.key + "-task-")
          ).length;
          const sectionPercent =
            section.totalTasks > 0 ? Math.round((sectionCompleted / section.totalTasks) * 100) : 0;
          const isSectionComplete =
            (section.totalTasks > 0 && sectionCompleted === section.totalTasks) ||
            (section.totalTasks === 0 && manuallyCompleted.has(section.key));
          const sectionComments = comments.filter((c) => c.section_key === section.key);

          if (!enabledKeys.has(section.key)) return null;

          return (
            <div
              key={section.key}
              id={`section-${section.key}`}
              data-ciim-section={section.key}
              className="ciim-section"
            >
              {/* Title bar */}
              <div className={`ciim-section-bar print:hidden${isSectionComplete ? " ciim-section-bar--done" : ""}`}>
                <button
                  className="ciim-collapse-btn"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.key)) next.delete(section.key);
                      else next.add(section.key);
                      return next;
                    })
                  }
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? "▶" : "▼"}
                </button>

                <div className="ciim-section-bar-title">
                  <span className="ciim-section-name">{section.title}</span>
                  {isSectionComplete && (
                    <span className="ciim-section-done-badge">✓ Complete</span>
                  )}
                </div>

                <div className="ciim-section-bar-right">
                  {/* Progress meter for task-based sections */}
                  {section.totalTasks > 0 && (
                    <div className="ciim-section-meter" title={`${sectionPercent}%`}>
                      <div className="ciim-section-meter-track">
                        <div className="ciim-section-meter-fill" style={{ width: `${sectionPercent}%` }} />
                      </div>
                      <span className="ciim-section-meter-label">{sectionCompleted}/{section.totalTasks}</span>
                    </div>
                  )}

                  {/* Manual complete toggle for sections with no tasks */}
                  {section.totalTasks === 0 && (
                    <button
                      className={`ciim-manual-done-btn${isSectionComplete ? " is-done" : ""}`}
                      onClick={() => handleToggleManualComplete(section.key)}
                      title={isSectionComplete ? "Mark incomplete" : "Mark complete"}
                    >
                      {isSectionComplete ? "✓ Done" : "Mark Done"}
                    </button>
                  )}

                  <button
                    className={`ciim-comment-btn${sectionComments.length > 0 ? " has-comments" : ""}`}
                    onClick={() => { setActiveCommentSection(section.key); setCommentDraft(""); }}
                    title={sectionComments.length > 0 ? `${sectionComments.length} comment${sectionComments.length > 1 ? "s" : ""}` : "Add comment"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    {sectionComments.length > 0 && <sup>{sectionComments.length}</sup>}
                  </button>

                  <button
                    className="ciim-print-btn"
                    onClick={() => handlePrintSection(section.key)}
                    title="Print this section"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Section content */}
              {!isCollapsed && (
                <SectionContent
                  section={section}
                  completedIdsRef={completedIdsRef}
                  onToggle={handleToggleTask}
                />
              )}
            </div>
          );
        })}

        {/* ── Comment modal ── */}
        {activeCommentSection && (
          <div
            className="ciim-modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) setActiveCommentSection(null); }}
          >
            <div className="ciim-modal">
              <h3 className="ciim-modal-title">Add Comment</h3>
              <p className="ciim-modal-section-name">
                {sections.find((s) => s.key === activeCommentSection)?.title}
              </p>
              <textarea
                className="ciim-modal-textarea"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Type your comment…"
                rows={4}
                autoFocus
              />
              <div className="ciim-modal-actions">
                <button
                  className="ciim-modal-save"
                  onClick={handleAddComment}
                  disabled={!commentDraft.trim() || submittingComment}
                >
                  {submittingComment ? "Saving…" : "Save Comment"}
                </button>
                <button className="ciim-modal-cancel" onClick={() => setActiveCommentSection(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right summary panel ── */}
      <aside className="ciim-summary-panel">
        <div className="ciim-summary-header">Configuration</div>

        {/* Text field groups */}
        {FIELD_GROUPS.filter((g) => g.fields[0]?.type !== "boolean").map((group) => {
          const textFields = group.fields.filter((f) => !CREDENTIAL_KEYS.has(f.key));
          if (!textFields.length) return null;
          return (
            <div key={group.title} className="ciim-summary-section">
              <div className="ciim-summary-group-title">{group.title}</div>
              {textFields.map((field) => {
                const val = allValues[field.key];
                return (
                  <div key={field.key} className="ciim-summary-row">
                    <span className="ciim-summary-key" title={field.label}>{field.label}</span>
                    <span
                      className={`ciim-summary-val${val ? "" : " ciim-summary-val--empty"}`}
                      title={val || "not set"}
                    >
                      {val || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Section toggles — checking/unchecking updates the TOC and content live */}
        <div className="ciim-summary-section">
          <div className="ciim-summary-group-title">Manual Sections</div>
          {sections.map((section) => {
            const isOn = enabledKeys.has(section.key);
            return (
              <label key={section.key} className="ciim-summary-toggle-item">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => handleToggleSection(section.key)}
                  className="ciim-summary-toggle-cb"
                />
                <span className={isOn ? "ciim-summary-section-on" : "ciim-summary-section-off"}>
                  {section.title}
                </span>
              </label>
            );
          })}
        </div>
      </aside>

    </div>
  );
}

// ── Section content ───────────────────────────────────────────────────────────
// Memoized so it never re-renders when ManualClient state changes.

const SectionContent = React.memo(function SectionContent({
  section,
  completedIdsRef,
  onToggle,
}: {
  section: ManualSection;
  completedIdsRef: React.RefObject<Set<string>>;
  onToggle: (taskId: string, checked: boolean) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);

  // Restore checkbox states on mount (runs on expand after collapse too)
  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    const ids = completedIdsRef.current;
    div
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-task-id]')
      .forEach((cb) => { cb.checked = ids?.has(cb.dataset.taskId!) ?? false; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Event delegation — bidirectional toggle
  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    const handler = (e: Event) => {
      const cb = e.target as HTMLInputElement;
      if (cb.type !== "checkbox" || !cb.dataset.taskId) return;
      onToggle(cb.dataset.taskId, cb.checked);
    };
    div.addEventListener("change", handler);
    return () => div.removeEventListener("change", handler);
  }, [onToggle]);

  return (
    <div
      ref={divRef}
      className="ciim-section-content"
      dangerouslySetInnerHTML={{ __html: section.html }}
    />
  );
});
