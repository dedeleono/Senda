import { NextResponse } from 'next/server';
import { encryptPrivateKey } from '@/lib/utils/crypto';

export async function POST(request: Request) {
    try {
        const { privateKey } = await request.json();
        
        if (!privateKey) {
            return NextResponse.json(
                { error: 'Private key is required' },
                { status: 400 }
            );
        }

        const encrypted = encryptPrivateKey(Buffer.from(privateKey, 'base64'));
        
        return NextResponse.json({ encrypted });
    } catch (error) {
        console.error('Encryption error:', error);
        return NextResponse.json(
            { error: 'Failed to encrypt data' },
            { status: 500 }
        );
    }
} 