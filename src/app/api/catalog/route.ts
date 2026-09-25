import { NextRequest, NextResponse } from 'next/server';
import { catalogHandbookAction } from '@/lib/actions';

export const maxDuration = 60; // 60 secondi timeout max

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content = '', photoDataUri } = body;
    const res = await catalogHandbookAction(content, photoDataUri);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error("API /api/catalog Error:", error);
    return NextResponse.json({
      success: false,
      data: null,
      error: typeof error === 'string' ? error : (error?.message || 'Servizio IA temporaneamente sovraccarico. Riprova tra qualche secondo.')
    }, { status: 200 });
  }
}
