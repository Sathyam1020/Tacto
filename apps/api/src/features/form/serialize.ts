import {
  emptyFormDocument,
  readFormDocument,
  type FormDocument,
} from "@workspace/contracts/form";

/**
 * The published baseline document for a form — used both to seed a fresh draft
 * and as the dirty-check anchor (so a just-opened draft equals published → not
 * "dirty"). Kept identical to the create-time seed.
 */
export function buildFormDraft(form: {
  title: string;
  description: string | null;
  document: unknown;
}): FormDocument {
  return (
    readFormDocument(form.document) ??
    emptyFormDocument(form.title, form.description)
  );
}
