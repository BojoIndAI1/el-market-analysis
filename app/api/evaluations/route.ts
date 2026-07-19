import { NextRequest, NextResponse } from "next/server";
import { fetchZoneEvaluations } from "@/lib/db";
import { assembleEvaluations } from "@/lib/evaluationAssemble";

export async function GET(request: NextRequest) {
  const zonesParam = request.nextUrl.searchParams.get("zones") ?? "";
  const zoneCodes = zonesParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  const data = await fetchZoneEvaluations(zoneCodes);
  const evaluations = assembleEvaluations(data);
  return NextResponse.json({ evaluations });
}
