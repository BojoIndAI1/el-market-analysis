import { NextResponse } from "next/server";
import { fetchZoneRanking, fetchZoneRankingExcluded } from "@/lib/db";

export async function GET() {
  const [ranked, excluded] = await Promise.all([fetchZoneRanking(), fetchZoneRankingExcluded()]);
  return NextResponse.json({ ranked, excluded });
}
