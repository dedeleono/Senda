import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import InvitationEmail from '@/components/emails/invitation-email'

export async function sendInvitationEmail(email: string, url: string) {
    const { host } = new URL(url);

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
        userEmail: email,
        inviteUrl: url,
        host,
        url
    };

    const html = await render(InvitationEmail(props));

    await transport.sendMail({
        to: email,
        from: process.env.EMAIL_FROM,
        subject: `Someone made a deposit to you`,
        text: `Make click on the link below to withdraw the funds\n${url}\n\n`,
        html,
    });
}