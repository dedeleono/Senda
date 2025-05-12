import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import DepositNotificationEmail from '@/components/emails/depositNotification';

export async function sendDepositNotificationEmail(email: string, amount: number, token: string, senderName?: string) {

    // const transport = createTransport({
    //     host: "smtp.gmail.com",
    //     port: 587,
    //     secure: false,
    //     auth: {
    //         user: process.env.EMAIL_USER,
    //         pass: process.env.SECRET_KEY_THRU_APP_EMAIL
    //     }
    // });

    const transport = createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        tls: {
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2'
        },
        auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD
        }
    });

    const props = {
        email: email,
        amount: amount,
        token: token,
        senderName: senderName,
    };

    const html = await render(DepositNotificationEmail(props));

    await transport.sendMail({
        to: email,
        from: process.env.EMAIL_FROM,
        subject: `Someone made a deposit to you`,
        text: `Login to your Senda account to withdraw the funds`,
        html,
    });
}