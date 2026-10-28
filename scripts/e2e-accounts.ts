// Creates the throwaway e2e staff accounts outside Playwright (for manual QA).
import setup from "../tests/e2e/global-setup";
await setup();
console.log("Test accounts written to .data/e2e-users.json");
