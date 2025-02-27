import { createHandler } from "../../../lib/handler";
import Deposit from "../../../models/Deposit";

export const GET = createHandler(async () => {
  console.log("Fetching lottery pot...");
  const deposits = await Deposit.find();
  console.log("Deposits found:", deposits);
  const totalPot = deposits.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
  console.log("Calculated total pot:", totalPot);
  return { pot: totalPot };
});