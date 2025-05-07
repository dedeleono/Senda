import { router } from "./trpc";
import userRouter from "./routers/user";
import walletRouter from "./routers/wallet";
import transactionRouter from "./routers/transaction";

export const appRouter = router({
    userRouter,
    walletRouter,
    transactionRouter,
});

export type AppRouter = typeof appRouter;