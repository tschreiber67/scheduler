import { createServer } from './api.js';

const port = Number(process.env.PORT) || 8103;
const host = process.env.HOST || '127.0.0.1';
const srv = createServer();
srv.listen(port, host, () => {
  console.log(`Resource Scheduler on http://${host}:${port}`);
});
