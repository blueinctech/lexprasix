"use client";

import { useEffect, useRef } from "react";

// Warns before leaving an editor with unsaved changes: closing or reloading the
// tab, and clicking links inside the admin (which don't trigger the browser's
// own warning). Saving the form clears the warning.
export function UnsavedChangesGuard() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    let dirty = false;
    const markDirty = () => (dirty = true);
    const clean = () => (dirty = false);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest("a");
      if (!a || a.target === "_blank" || !a.href || form.contains(a)) return;
      if (!window.confirm("You have unsaved changes to this article. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      } else clean();
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", clean);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", clean);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return <span ref={marker} hidden />;
}
