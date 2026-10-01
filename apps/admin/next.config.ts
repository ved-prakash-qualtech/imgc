import { fileURLToPath } from "node:url";

import { createNextConfig } from "../../tooling/createNextConfig";

export default createNextConfig({
  zone: "admin",
  appDir: fileURLToPath(new URL(".", import.meta.url)),
});
