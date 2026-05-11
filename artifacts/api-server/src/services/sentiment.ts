import { openai } from "@workspace/integrations-openai-ai-server";
import { db, parentFeedbackTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface SentimentResult {
  score: number;
  label: "positive" | "neutral" | "negative";
  note: string;
}

export async function analyzeFeedbackSentiment(
  improvementNote: string | null | undefined,
  rating: number,
  classExperience: number,
  teacherEngagement: number,
  safetyRating: number
): Promise<SentimentResult> {
  const avgRating = (rating + classExperience + teacherEngagement + safetyRating) / 4;

  const prompt = `You are analyzing parent feedback for a children's church ministry. Score the overall sentiment.

Numeric ratings (1-5 scale):
- Overall experience: ${rating}/5
- Class quality: ${classExperience}/5
- Teacher engagement: ${teacherEngagement}/5
- Safety perception: ${safetyRating}/5
- Average: ${avgRating.toFixed(1)}/5
${improvementNote ? `\nWritten comment: "${improvementNote}"` : "\nNo written comment provided."}

Respond with a JSON object only, no markdown:
{
  "score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "label": <"positive" | "neutral" | "negative">,
  "note": <one concise sentence insight about this feedback, max 20 words>
}

Rules:
- Weight written comments heavily if present
- Without a comment, base score on ratings: >=4 avg = positive, 2.5-3.9 = neutral, <2.5 = negative
- "positive": score >= 0.2, "neutral": -0.2 to 0.2, "negative": score <= -0.2`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-nano",
    max_completion_tokens: 300,
    messages: [
      {
        role: "system",
        content: "You are a sentiment analyzer. Always respond with valid JSON only, no markdown, no explanation.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  // Try to extract a JSON object from anywhere in the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0].trim() : "";

  if (!jsonStr) {
    // Fall back to rating-based heuristic if model returned nothing parseable
    const label: "positive" | "neutral" | "negative" =
      avgRating >= 4 ? "positive" : avgRating >= 2.5 ? "neutral" : "negative";
    const score = avgRating >= 4 ? 0.75 : avgRating >= 2.5 ? 0.0 : -0.65;
    const note =
      avgRating >= 4
        ? "High ratings indicate strong satisfaction with the service."
        : avgRating >= 2.5
        ? "Mixed ratings suggest an average experience."
        : "Low ratings indicate significant dissatisfaction.";
    return { score, label, note };
  }

  const parsed = JSON.parse(jsonStr) as SentimentResult;
  return {
    score: Math.max(-1, Math.min(1, Number(parsed.score))),
    label: parsed.label,
    note: parsed.note,
  };
}

export async function scoreFeedbackRecord(feedbackId: number): Promise<void> {
  const [fb] = await db
    .select()
    .from(parentFeedbackTable)
    .where(eq(parentFeedbackTable.id, feedbackId));

  if (!fb) return;

  try {
    const result = await analyzeFeedbackSentiment(
      fb.improvementNote,
      Number(fb.rating),
      Number(fb.classExperience),
      Number(fb.teacherEngagement),
      Number(fb.safetyRating)
    );

    await db
      .update(parentFeedbackTable)
      .set({
        sentimentScore: String(result.score),
        sentimentLabel: result.label,
        sentimentNote: result.note,
      })
      .where(eq(parentFeedbackTable.id, feedbackId));
  } catch (err) {
    logger.error({ err, feedbackId }, "Failed to score feedback sentiment");
  }
}

export async function scoreAllUnscoredFeedback(): Promise<{ analyzed: number; skipped: number }> {
  const unscored = await db
    .select()
    .from(parentFeedbackTable)
    .where(isNull(parentFeedbackTable.sentimentLabel));

  let analyzed = 0;
  let skipped = 0;

  for (const fb of unscored) {
    try {
      const result = await analyzeFeedbackSentiment(
        fb.improvementNote,
        Number(fb.rating),
        Number(fb.classExperience),
        Number(fb.teacherEngagement),
        Number(fb.safetyRating)
      );
      await db
        .update(parentFeedbackTable)
        .set({
          sentimentScore: String(result.score),
          sentimentLabel: result.label,
          sentimentNote: result.note,
        })
        .where(eq(parentFeedbackTable.id, fb.id));
      analyzed++;
    } catch {
      skipped++;
    }
  }

  return { analyzed, skipped };
}
