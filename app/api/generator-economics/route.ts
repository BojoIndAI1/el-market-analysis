import { NextResponse } from "next/server";
import { fetchGeneratorEconomicsCards } from "@/lib/db";

export async function GET() {
  const cards = await fetchGeneratorEconomicsCards();
  return NextResponse.json({ cards });
}
