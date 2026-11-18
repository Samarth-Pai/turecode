import { NextResponse } from "next/server";
import { compileDslToStubs } from "@/lib/dsl";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dslSource = String(body.dslSource ?? "");
    const result = compileDslToStubs(dslSource);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        valid: false,
        errors: [err instanceof Error ? err.message : "Invalid request payload"],
        warnings: [],
      },
      { status: 400 }
    );
  }
}
