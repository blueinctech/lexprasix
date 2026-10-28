"use client";

import { useState } from "react";
import { saveMenu } from "@/app/admin/_actions/menus";
import type { MenuItem } from "@/db/schema";
import { Icon } from "@/components/ui/Icon";
import { ActionForm, btn, SubmitButton } from "./ui";

// Tree editor for one menu. Items can be edited inline, moved up/down,
// indented under the item above (up to `depth` levels) or outdented.

export type LinkOption = { label: string; href: string; group: string };

type Path = number[];

const newId = () => `m${Math.random().toString(36).slice(2, 10)}`;

function clone(items: MenuItem[]): MenuItem[] {
  return structuredClone(items);
}

function levelOf(items: MenuItem[]): number {
  return items.length ? 1 + Math.max(...items.map((i) => (i.children?.length ? levelOf(i.children) : 0))) : 0;
}

export function MenuEditor({ menuKey, initial, depth, options }: { menuKey: string; initial: MenuItem[]; depth: number; options: LinkOption[] }) {
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [quick, setQuick] = useState("");

  const mutate = (fn: (draft: MenuItem[]) => void) =>
    setItems((prev) => {
      const draft = clone(prev);
      fn(draft);
      return draft;
    });

  const parentList = (draft: MenuItem[], path: Path) => {
    const parent = path.slice(0, -1);
    if (!parent.length) return draft;
    let node = draft[parent[0]];
    for (const i of parent.slice(1)) node = node.children![i];
    node.children ??= [];
    return node.children;
  };

  const update = (path: Path, patch: Partial<MenuItem>) =>
    mutate((d) => {
      const list = parentList(d, path);
      list[path[path.length - 1]] = { ...list[path[path.length - 1]], ...patch };
    });

  const remove = (path: Path) =>
    mutate((d) => {
      parentList(d, path).splice(path[path.length - 1], 1);
    });

  const move = (path: Path, dir: -1 | 1) =>
    mutate((d) => {
      const list = parentList(d, path);
      const i = path[path.length - 1];
      const j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });

  const indent = (path: Path) =>
    mutate((d) => {
      const list = parentList(d, path);
      const i = path[path.length - 1];
      if (i === 0) return;
      const [item] = list.splice(i, 1);
      const target = list[i - 1];
      target.children = [...(target.children ?? []), item];
    });

  const outdent = (path: Path) =>
    mutate((d) => {
      if (path.length < 2) return;
      const list = parentList(d, path);
      const [item] = list.splice(path[path.length - 1], 1);
      const grand = parentList(d, path.slice(0, -1));
      grand.splice(path[path.length - 2] + 1, 0, item);
    });

  const add = (item: Omit<MenuItem, "id">) => setItems((prev) => [...prev, { id: newId(), ...item }]);

  const tooDeep = levelOf(items) > depth;

  function renderList(list: MenuItem[], path: Path) {
    return (
      <ol className={path.length ? "mt-2 grid gap-2 border-l-2 border-slate-200 pl-4" : "grid gap-2"}>
        {list.map((item, i) => {
          const p = [...path, i];
          const level = p.length;
          return (
            <li key={item.id}>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_1.3fr_auto]">
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Label
                    <input value={item.label} onChange={(e) => update(p, { label: e.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-900" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-600">
                    Link
                    <input value={item.href} onChange={(e) => update(p, { href: e.target.value })} placeholder="/page-slug/" className="h-9 rounded-md border border-slate-300 px-2 font-mono text-xs text-slate-900" />
                  </label>
                  <div className="flex items-end gap-1">
                    <IconButton label="Move up" icon="chevron-down" rotate onClick={() => move(p, -1)} disabled={i === 0} />
                    <IconButton label="Move down" icon="chevron-down" onClick={() => move(p, 1)} disabled={i === list.length - 1} />
                    <IconButton label="Indent under the item above" icon="chevron-right" onClick={() => indent(p)} disabled={i === 0 || level >= depth} />
                    <IconButton label="Outdent" icon="chevron-left" onClick={() => outdent(p)} disabled={level === 1} />
                    <IconButton label={`Remove ${item.label || "item"}`} icon="x" danger onClick={() => remove(p)} />
                  </div>
                </div>
                {depth > 1 && (
                  <label className="mt-2 grid gap-1 text-xs font-medium text-slate-600">
                    Description (optional)
                    <input value={item.description ?? ""} onChange={(e) => update(p, { description: e.target.value || undefined })} className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-900" />
                  </label>
                )}
                {item.children?.length ? renderList(item.children, p) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <ActionForm action={saveMenu}>
      <input type="hidden" name="key" value={menuKey} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {items.length ? renderList(items, []) : <p className="text-sm text-slate-500">This menu is empty.</p>}
      {tooDeep && <p className="text-sm text-red-700">This menu supports at most {depth} level(s).</p>}
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
        <button type="button" className={btn("secondary", true)} onClick={() => add({ label: "New link", href: "/" })}>
          Add custom link
        </button>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Or add a page
          <select value={quick} onChange={(e) => setQuick(e.target.value)} className="h-8 max-w-72 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Choose…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <option key={o.href} value={o.href}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={btn("secondary", true)}
          disabled={!quick}
          onClick={() => {
            const o = options.find((x) => x.href === quick);
            if (o) add({ label: o.label, href: o.href });
            setQuick("");
          }}
        >
          Add
        </button>
      </div>
      <div>
        <SubmitButton>Save menu</SubmitButton>
      </div>
    </ActionForm>
  );
}

function IconButton({ label, icon, onClick, disabled, danger, rotate }: { label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean; rotate?: boolean }) {
  return (
    <button type="button" title={label} onClick={onClick} disabled={disabled} className={`grid size-9 place-items-center rounded-md border border-slate-200 disabled:opacity-30 ${danger ? "text-red-700 hover:bg-red-50" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon name={icon} className={`size-4 ${rotate ? "rotate-180" : ""}`} label={label} />
    </button>
  );
}
