import { NextResponse } from 'next/server';
import { decryptPrivateKey } from '@/lib/utils/crypto';

export async function POST(request: Request) {
    try {
        const bodyText = await request.text();
        console.log('Request body received:', bodyText);

        let encryptedData;
        try {
            const body = JSON.parse(bodyText);
            encryptedData = body.encryptedData;
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return NextResponse.json({ 
                error: 'Invalid JSON format',
                details: parseError instanceof Error ? parseError.message : String(parseError)
            }, { status: 400 });
        }
        
        if (!encryptedData || !encryptedData.iv || !encryptedData.authTag || !encryptedData.data) {
            console.error('Invalid encrypted data format:', encryptedData);
            return NextResponse.json(
                { error: 'Invalid encrypted data format. Requires iv, authTag, and data properties.' },
                { status: 400 }
            );
        }

        const decrypted = decryptPrivateKey(encryptedData);
        
        return NextResponse.json({ 
            decrypted: decrypted.toString('base64'),
            success: true 
        });
    } catch (error) {
        console.error('Decryption error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to decrypt data',
                details: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        );
    }
} 