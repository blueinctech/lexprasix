// Menus the site renders, and how many levels each supports.
export const MENU_KEYS = {
  header: { label: "Header", depth: 3, help: "Main navigation. Top items can open a dropdown; a dropdown item with its own links becomes a column in the mega-menu." },
  "footer-services": { label: "Footer: services", depth: 1, help: "Service links in the footer." },
  "footer-company": { label: "Footer: firm", depth: 1, help: "Firm and help links in the footer." },
  "footer-legal": { label: "Footer: legal", depth: 1, help: "Privacy, terms and other legal links at the very bottom." },
} as const;

export type MenuKey = keyof typeof MENU_KEYS;
