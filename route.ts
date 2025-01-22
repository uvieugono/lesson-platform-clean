// api/proxy/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (!endpoint) {
    return NextResponse.json(
      { message: 'Missing endpoint parameter' },
      { status: 400 }
    );
  }

  const targetURL = `https://us-central1-solynta-academy.cloudfunctions.net/lessonManager/${endpoint}`;
  
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_ORIGIN || '*');
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const body = await request.json();
    const response = await fetch(targetURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers
    });
    
  } catch (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500, headers }
    );
  }
}