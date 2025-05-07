import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import TwoFactorEmail from '@/components/emails/twoFactor-email'

export async function sendTwoFactorEmail(email: string, url: string, token: string) {

    const parsedUrl = new URL(url);
    
    const transport = createTransport({
        host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD
        },
        debug: true,
        logger: true
    });

    const { host } = new URL(url);

    try {
        // const verifyResult = await transport.verify();

        const props = { host, url };

        const html = await render(TwoFactorEmail(props));
        const mailOptions = {
            to: email,
            from: `Maverick Capital Investment <${process.env.EMAIL_FROM}>`,
            subject: `2FA Verification Code`,
            text: `Enable 2FA for your account`,
            html,
        };

        const result = await transport.sendMail(mailOptions);

        return result;
    } catch (error) {
        console.error('Detailed send error:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as any).code,
            command: (error as any).command,
            responseCode: (error as any).responseCode,
            response: (error as any).response,
            responseData: (error as any).responseData,
            smtp: (error as any).smtp,
            smtpResponse: (error as any).smtpResponse
        });
        throw error;
    }
}