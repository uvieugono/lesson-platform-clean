// api/proxy/route.ts
import { NextResponse } from 'next/server';
import Cors from 'cors';

const cors = Cors({
  methods: ['POST', 'GET', 'OPTIONS'],
  origin: process.env.NEXT_PUBLIC_ORIGIN || 'https://solynta-academy-learning-page.vercel.app'
});

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

  const targetURL = `https://us-central1-solynta-academy.cloudfunctions.net/lessonManager/${endpoint}`;
  
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
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
}