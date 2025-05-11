import { router } from "./trpc";
import userRouter from "./routers/user";
import walletRouter from "./routers/wallet";
import transactionRouter from "./routers/transaction";
import sendaRouter from "./routers/senda";

export const appRouter = router({
    userRouter,
    walletRouter,
    transactionRouter,
    sendaRouter,
});

export type AppRouter = typeof appRouter;