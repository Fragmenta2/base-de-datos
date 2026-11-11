import { NextResponse } from 'next/server';
import { handleError } from '@/lib/http';
import { listCollections } from '@/lib/pos';

export async function GET() {
  try {
    return NextResponse.json(await listCollections());
  } catch (err) {
    return handleError(err);
  }
}
