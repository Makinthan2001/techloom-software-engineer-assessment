import 'dotenv/config';
import { env } from './config/index.js';
import app from './app.js';
import { startReservationExpirySweeper } from './jobs/reservationExpirySweeper.js';

app.listen(env.PORT, () => {
  console.log(`🚀 POS Backend Server running at http://localhost:${env.PORT}`);
  startReservationExpirySweeper(30000);
});
