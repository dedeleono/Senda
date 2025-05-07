import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';

import AuthEmail from '@/components/emails/auth-email'

export async function sendAuthEmail(email: string, url: string) {
    console.log('\n\n🔔 EMAIL SEND REQUESTED 🔔');
    console.log('Starting email send process for:', { email, url });

    try {
        const parsedUrl = new URL(url);
        console.log('Parsed verification URL:', {
            protocol: parsedUrl.protocol,
            host: parsedUrl.host,
            pathname: parsedUrl.pathname,
            search: parsedUrl.search,
            token: parsedUrl.searchParams.get('token'),
            callbackUrl: parsedUrl.searchParams.get('callbackUrl')
        });
    } catch (error) {
        console.error('Invalid URL format:', error);
    }

    const { host } = new URL(url);
    console.log('Extracted host:', host);

    if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
        console.error('Missing email configuration:', {
            hasEmailUser: !!process.env.EMAIL_SERVER_USER,
            hasEmailPassword: !!process.env.EMAIL_SERVER_PASSWORD,
            emailHost: process.env.EMAIL_SERVER_HOST,
            emailPort: process.env.EMAIL_SERVER_PORT
        });
        throw new Error('Email configuration is missing');
    }

    console.log('Creating email transport with config:', {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        user: process.env.EMAIL_SERVER_USER,
        hasPassword: !!process.env.EMAIL_SERVER_PASSWORD,
        secure: true
    });

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

    try {
        // const verifyResult = await transport.verify();

        const props = { host, url, email };

        const html = await render(AuthEmail(props));
        const mailOptions = {
            to: email,
            from: `Maverick Capital Investment <${process.env.EMAIL_FROM}>`,
            subject: `Sign in to ${host}`,
            text: `Sign in to ${host}\n${url}\n\n`,
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