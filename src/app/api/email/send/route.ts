import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import { createTransport } from 'nodemailer';
import DepositNotificationEmail from '@/components/emails/depositNotification';
import GuestDepositNotificationEmail from '@/components/emails/guestDepositNotification';
import { render } from '@react-email/render';

interface BaseEmailRequest {
  type: 'direct' | 'template';
  email: string;
}

interface DirectEmailRequest extends BaseEmailRequest {
  type: 'direct';
  subject: string;
  content: string;
}

interface TemplateEmailRequest extends BaseEmailRequest {
  type: 'template';
  template: 'DepositNotification' | 'GuestDepositNotification';
  data: {
    email: string;
    amount: string;
    token: string;
    senderEmail: string;
    inviteUrl?: string;
  };
}

type EmailRequest = DirectEmailRequest | TemplateEmailRequest;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
      return NextResponse.json({ 
        error: "Email configuration missing"
      }, { status: 500 });
    }

    const payload = await req.json() as EmailRequest;

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

    let html: string;
    let subject: string;
    let to: string;

    if (payload.type === 'template') {
      to = payload.data.email;
      
      switch (payload.template) {
        case 'DepositNotification':
          html = await render(DepositNotificationEmail({
            email: payload.data.email,
            amount: parseFloat(payload.data.amount),
            token: payload.data.token,
            senderName: payload.data.senderEmail
          }));
          subject = `You've received ${payload.data.amount} ${payload.data.token}`;
          break;
        
        case 'GuestDepositNotification':
          if (!payload.data.inviteUrl) {
            throw new Error('inviteUrl is required for guest notifications');
          }
          html = await render(GuestDepositNotificationEmail({
            inviteUrl: payload.data.inviteUrl,
            receiverEmail: payload.data.email,
            amount: payload.data.amount,
            token: payload.data.token,
            senderEmail: payload.data.senderEmail
          }));
          subject = `You've received ${payload.data.amount} ${payload.data.token}`;
          break;
          
        default:
          throw new Error(`Unsupported template: ${payload.template}`);
      }
    } else {
      to = payload.email;
      html = payload.content;
      subject = payload.subject;
    }

    const result = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId
    });
  } catch (error) {
    console.error("[EMAIL_SEND]", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to send email'
    }, { status: 500 });
  }
} 