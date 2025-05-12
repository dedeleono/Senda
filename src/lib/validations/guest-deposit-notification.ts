import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import GuestDepositNotificationEmail from '@/components/emails/guestDepositNotification';

export async function sendGuestDepositNotificationEmail(email: string, inviteUrl: string, receiverEmail: string, amount: string, token: string, senderName?: string) {

    const { host } = new URL(inviteUrl);

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
        inviteUrl: inviteUrl,
        receiverEmail: receiverEmail,
        senderEmail: email,
        amount: amount,
        token: token,
        senderName: senderName,
    };

    const html = await render(GuestDepositNotificationEmail(props));

    await transport.sendMail({
        to: email,
        from: process.env.EMAIL_FROM,
        subject: `Someone made a deposit to you`,
        text: `Make click on the link below to withdraw the funds\n${inviteUrl}\n\n`,
        html,
    });
}