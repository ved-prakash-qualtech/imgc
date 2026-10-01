import { fileURLToPath } from "node:url";

import { createNextConfig } from "../../tooling/createNextConfig";

export default createNextConfig({
  zone: "loans",
  appDir: fileURLToPath(new URL(".", import.meta.url)),
});
