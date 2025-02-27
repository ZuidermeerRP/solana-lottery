import { createHandler } from "../../../lib/handler";
import Deposit from "../../../models/Deposit";

export const GET = createHandler(async () => {
  console.log("Fetching participants...");
  const deposits = await Deposit.find({}, "walletAddress");
  console.log("Deposits found:", deposits);
  const participants = deposits.map(deposit => deposit.walletAddress);
  console.log("Participants:", participants);
  return { participants };
});