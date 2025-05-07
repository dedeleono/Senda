import { getEnvVar } from "@/utils/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const auth_key = await getEnvVar("AUTH_SECRET", { serverOnly: true });
const aesKey = Buffer.from(auth_key, "base64");
if (aesKey.length !== 32) {
    throw new Error("AUTH_SECRET must decode to 32 bytes");
}

export function encryptPrivateKey(
    privateKey: Buffer
): { iv: string; authTag: string; data: string } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, aesKey, iv);

    const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        data: encrypted.toString("base64"),
    };
}

export function decryptPrivateKey(input: {
    iv: string;
    authTag: string;
    data: string;
}): Buffer {
    const iv = Buffer.from(input.iv, "base64");
    const authTag = Buffer.from(input.authTag, "base64");
    const encryptedData = Buffer.from(input.data, "base64");

    const decipher = createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
    ]);
    return decrypted;
}
