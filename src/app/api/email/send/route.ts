import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { createTransport } from 'nodemailer';

interface EmailRequest {
  subject: string;
  content: string;
  recipients: string[];
}

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

    const { subject, content, recipients } = await req.json() as EmailRequest;

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

    const results = await Promise.allSettled(
      recipients.map(async (email) => {
        return transport.sendMail({
          from: `Colegio Saber Ver <${process.env.EMAIL_FROM}>`,
          to: email,
          subject,
          html: content,
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      summary: {
        total: recipients.length,
        successful,
        failed
      }
    });
  } catch (error) {
    console.error("[EMAIL_SEND]", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to send email'
    }, { status: 500 });
  }
} 