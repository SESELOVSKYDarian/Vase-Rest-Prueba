import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  try {
    const response = await fetch(`${apiUrl}/usuarios/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('authorization') || '', 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' }, body: JSON.stringify(await req.json()) });
    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Backend no disponible' }, { status: 503 }); }
}
