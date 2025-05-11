import crypto from "crypto";

import { prisma } from "@/lib/db";
// import { getTwoFactorTokenByEmail } from "@/lib/utils";

export const generateTwoFactorToken = async (email: string) => {
  const token = crypto.randomInt(100000, 1_000_000).toString();
  const expiresAt = new Date(new Date().getTime() + 3600 * 1000); //@todo set to 15mins or less

  // const existingToken = await getTwoFactorTokenByEmail(email);

  // if (existingToken) {
  //   await prisma.twoFactorToken.delete({
  //     where: { id: existingToken.id }
  //   })
  // }

  const twoFactorToken = await prisma.twoFactorToken.create({
    data: {
      email,
      token,
      expires: expiresAt
    }
  })

  return twoFactorToken;
}