import {
  readFormDocument,
  submissionInputSchema,
  validateSubmission,
} from "@workspace/contracts/form";
import { Prisma, prisma } from "@workspace/db";
import { Router } from "express";
import { z } from "zod";

import { rateLimit } from "../../lib/rate-limit.js";
import { AppError } from "../../middleware/error.js";

/**
 * Public form endpoints — no auth. Reading a published form, a start beacon, and
 * submissions (server-authoritative validation). Counters increment
 * fire-and-forget so they never block the response. Mirrors the public guide
 * router. See docs/plans/phase-11-forms-rfc.md.
 */
export const formPublicRouter: Router = Router();

const shareParamSchema = z.object({ shareId: z.string() });

/** Fetch a published form for filling. */
formPublicRouter.get("/api/public/forms/:shareId", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);
  const form = await prisma.form.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      document: true,
      documentVersion: true,
    },
  });
  const document = form ? readFormDocument(form.document) : null;
  if (!form || !document) throw new AppError(404, "NOT_FOUND", "Form not found");

  void prisma.form
    .update({ where: { id: form.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  res.json({
    form: {
      shareId,
      title: form.title,
      description: form.description,
      document,
      version: form.documentVersion,
    },
  });
});

/** First-interaction beacon — counts a "start". Best-effort; never errors. */
formPublicRouter.post("/api/public/forms/:shareId/start", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);
  const form = await prisma.form.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    select: { id: true },
  });
  if (form) {
    void prisma.form
      .update({ where: { id: form.id }, data: { startCount: { increment: 1 } } })
      .catch(() => {});
  }
  res.json({ ok: true });
});

/** Submit a response — validated against the published fields. */
formPublicRouter.post("/api/public/forms/:shareId/submissions", async (req, res) => {
  const { shareId } = shareParamSchema.parse(req.params);
  const ip = req.ip ?? "unknown";
  if (!rateLimit(`submit:${ip}:${shareId}`, 20, 60_000)) {
    throw new AppError(429, "RATE_LIMITED", "Too many submissions — try again shortly");
  }
  const input = submissionInputSchema.parse(req.body);

  const form = await prisma.form.findFirst({
    where: { shareId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, document: true, documentVersion: true },
  });
  const document = form ? readFormDocument(form.document) : null;
  if (!form || !document) throw new AppError(404, "NOT_FOUND", "Form not found");
  if (!document.settings.acceptingSubmissions) {
    throw new AppError(403, "CLOSED", "This form is no longer accepting responses");
  }

  const errors = validateSubmission(document.fields, input.answers);
  if (errors.length > 0) {
    res.status(400).json({ error: { code: "INVALID_SUBMISSION", errors } });
    return;
  }

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      anonId: input.anonId ?? null,
      answers: input.answers as Prisma.InputJsonValue,
      formVersion: form.documentVersion,
      durationMs: input.durationMs ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  void prisma.form
    .update({ where: { id: form.id }, data: { submitCount: { increment: 1 } } })
    .catch(() => {});

  res.status(201).json({ ok: true, submissionId: submission.id });
});
