import { createHandler } from "../../../lib/handler";
import Winner from "../../../models/Winner";

export const GET = createHandler(async () => {
  console.log("Fetching latest winner...");
  const latestWinner = await Winner.findOne().sort({ drawnAt: -1 });
  console.log("Latest winner:", latestWinner);
  return {
    winner: latestWinner ? latestWinner.walletAddress : null,
    amount: latestWinner ? latestWinner.amount : 0,
    drawnAt: latestWinner ? latestWinner.drawnAt : null,
  };
});