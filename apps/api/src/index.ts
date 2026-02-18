import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api_started', port }));
});
