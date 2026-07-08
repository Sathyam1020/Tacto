// env must be imported first — it validates configuration and fails fast.
import { env } from "./env.js";

import { createApp } from "./app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`tacto api listening on http://localhost:${env.PORT}`);
});
