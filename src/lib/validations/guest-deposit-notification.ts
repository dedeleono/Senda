import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import GuestDepositNotificationEmail from '@/components/emails/guestDepositNotification';

export async function sendGuestDepositNotificationEmail(
    receiverEmail: string,
    inviteUrl: string,
    senderEmail: string,
    amount: string,
    token: string,
    senderName?: string
) {
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
        inviteUrl,
        receiverEmail,
        senderEmail,
        amount,
        token,
        senderName,
    };

    const html = await render(GuestDepositNotificationEmail(props));

    await transport.sendMail({
        to: receiverEmail,
        from: process.env.EMAIL_FROM,
        subject: `You've received ${amount} ${token} through Senda`,
        text: `Click on the link below to withdraw the funds\n${inviteUrl}\n\n`,
        html,
    });
}