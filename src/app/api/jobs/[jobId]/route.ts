import { prisma } from "@/lib/db";
import { jobIdSchema } from "@/lib/validators";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  if (!jobIdSchema.safeParse(jobId).success) {
    return Response.json({ error: "Invalid job." }, { status: 400 });
  }
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) return Response.json({ error: "Job not found." }, { status: 404 });
  return Response.json({
    id: job.id,
    status: job.status,
    stage: job.stage,
    completedUnits: job.completedUnits,
    totalUnits: job.totalUnits,
    cacheHits: job.cacheHits,
    warnings: job.warnings,
    error: job.error,
    leagueId: job.externalLeagueId,
  });
}
