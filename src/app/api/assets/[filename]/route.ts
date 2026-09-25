
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @fileOverview Router per servire gli asset salvati nella cartella persistente 'data/assets'
 * o nella directory pubblica 'public'. Risolve con percorsi multipli e fallback per
 * Docker Standalone, Raspberry Pi, ARM64 e server di produzione.
 */

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const rawParams = await params;
    const rawFilename = rawParams.filename || '';
    const filename = decodeURIComponent(rawFilename);

    if (!filename || filename.includes('..')) {
        return new NextResponse('Richiesta non valida', { status: 400 });
    }

    // Cartella base determinata da DATABASE_URL o data/
    const baseDir = process.env.DATABASE_URL 
        ? path.dirname(process.env.DATABASE_URL.replace('file:', '')) 
        : path.join(process.cwd(), 'data');

    // Lista esaustiva di percorsi candidati per trovare il file su qualsiasi ambiente server
    const candidatePaths = [
        path.join(baseDir, 'assets', filename),
        path.join(process.cwd(), 'data', 'assets', filename),
        path.join(process.cwd(), 'public', filename),
        path.resolve('/app', 'data', 'assets', filename),
        path.resolve('/app', 'public', filename),
        path.resolve('./data/assets', filename),
        path.resolve('./public', filename),
        path.resolve('../public', filename),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            foundPath = p;
            break;
        }
    }

    if (!foundPath) {
        return new NextResponse('File non trovato', { status: 404 });
    }

    try {
        const fileBuffer = fs.readFileSync(foundPath);
        const mimeType = getMimeType(filename);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('[Assets Route] Errore lettura file:', foundPath, error);
        return new NextResponse('Errore server', { status: 500 });
    }
}

function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.svg':
            return 'image/svg+xml';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        default:
            return 'application/octet-stream';
    }
}
