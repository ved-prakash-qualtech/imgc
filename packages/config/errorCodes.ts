/**
 * Every failure a server action or portal service can report, as a stable code.
 *
 * The code is the contract; the wording lives in the message catalogues
 * (`serverErrors.<CODE>` in packages/i18n/translations/*.json) and is resolved on the client by
 * `useServerErrorMessage()`. Services never return prose — a sentence cannot be tested,
 * logged or translated, and it ties the service layer to one language.
 *
 * When the Java backend takes these rules over it emits the same codes, so only the
 * producer changes and the catalogue stays put.
 */
export const SERVER_ERROR_CODES = [
  "ACCOUNT_ACCESS_REVOKED",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_OTHER_LENDER",
  "ADDRESS_UNKNOWN",
  "ADMIN_CONTEXT_REQUIRED",
  "ALREADY_ARCHIVED",
  "ALREADY_IN_BUCKET",
  "ALREADY_WAIVED",
  "AMOUNT_INVALID",
  "CASE_REQUIRED",
  "CLAIM_ALREADY_CLOSED",
  "CLAIM_APPROVE_NEEDS_APPROVALS",
  "CLAIM_CLOSED",
  "CLAIM_LENDER_ONLY",
  "CLAIM_NOT_FOUND",
  "CLAIM_NOT_INITIATED",
  "CLAIM_OTHER_LENDER",
  "CLAIM_REQUIRES_NPA",
  "CLAIM_SUBMIT_INCOMPLETE_BOTH",
  "CLAIM_SUBMIT_INCOMPLETE_DOCUMENTS",
  "CLAIM_SUBMIT_INCOMPLETE_FIELDS",
  "CLAIM_SUBMIT_NEEDS_APPROVALS",
  "CLAIM_TYPE_DRAFT_ONLY",
  "CONCURRENT_SAVE_CONFLICT",
  "CORRECTION_NOTE_REQUIRED",
  "DEMO_DATA_MISSING",
  "DOCUMENT_ALREADY_APPROVED",
  "DOCUMENT_ALREADY_LISTED",
  "DOCUMENT_ALREADY_UPLOADED",
  "DOCUMENT_ARCHIVE_NEEDS_REJECTED",
  "DOCUMENT_LISTED_TWICE",
  "DOCUMENT_NAME_DUPLICATE_ON_CLAIM",
  "DOCUMENT_NAME_REQUIRED",
  "DOCUMENT_NAME_REQUIRED_ALL",
  "DOCUMENT_NOT_ACCEPTED",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_NOT_REJECTED",
  "DOMAIN_INVALID",
  "DOMAIN_TAKEN",
  "DUE_DATE_INVALID",
  "EMAIL_ALREADY_HAS_ACCESS",
  "EMAIL_INVALID",
  "EMAIL_INVALID_VALUE",
  "EMAIL_NO_DOMAIN",
  "EMPLOYEE_ID_UNKNOWN",
  "FIELD_VALUE_REQUIRED",
  "FILE_ALREADY_REMOVED",
  "FILE_ARCHIVE_NEEDS_REJECTED",
  "FILE_DELETE_AFTER_SUBMIT",
  "FILE_DELETE_LENDER_ONLY",
  "FILE_EMPTY",
  "FILE_NOT_FOUND",
  "FILE_NO_DECISION_TO_UNDO",
  "FILE_REJECTION_REASON_REQUIRED",
  "FILE_REQUIRED",
  "FILE_STALE",
  "FILE_TOO_LARGE",
  "FILE_TYPE_UNSUPPORTED",
  "IDENTIFIER_REQUIRED",
  "IMGC_ONLY",
  "IMGC_STAFF_ONLY_FOR_LENDER",
  "LENDER_CONTEXT_REQUIRED",
  "LENDER_INVALID",
  "LENDER_NEEDS_ONE_DOCUMENT",
  "LENDER_NOT_FOUND",
  "LENDER_NOT_SELECTED",
  "LENDER_ONLY",
  "MANDATORY_DOCUMENTS_MISSING",
  "NOTE_REQUIRED",
  "NOTHING_TO_REVIEW",
  "NO_LENDER_ACCESS",
  "NO_REINSTATEMENT_REQUESTED",
  "NO_WAIVER_PENDING",
  "ONLY_ADDED_REQUIREMENT_WITHDRAWABLE",
  "ORG_DOMAIN_REQUIRED",
  "ORG_NAME_REQUIRED",
  "ORG_NAME_TAKEN",
  "ORG_NOT_FOUND",
  "OTP_EXPIRED",
  "OTP_LOCKED",
  "OTP_MISMATCH",
  "OTP_NO_CODE",
  "PASSWORD_WRONG",
  "PAS_FIELD_UNKNOWN",
  "QUERY_REASON_REQUIRED",
  "REFUND_ALREADY_RECORDED",
  "REFUND_NEEDS_APPROVED_CLAIM",
  "REINSTATEMENT_ALREADY_PENDING",
  "REINSTATE_LENDER_ONLY",
  "REJECTION_REASON_REQUIRED",
  "REMARK_EMPTY",
  "REQUIREMENT_NAME_DUPLICATE",
  "REQUIREMENT_NOT_FOUND",
  "REQUIREMENT_WITHDRAWN",
  "SAVE_FAILED",
  "STANDARD_CHECKLIST_LOCKED",
  "UPLOAD_NOT_FOUND",
  "UPLOAD_UNVERIFIED",
  "USER_NAME_REQUIRED",
  "UTR_REQUIRED",
  "WAIVER_DECLINE_REASON_REQUIRED",
  "WAIVER_REASON_REQUIRED",
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** Narrowing guard for a value that crossed a boundary (an action result, a fetch). */
export function isServerErrorCode(value: unknown): value is ServerErrorCode {
  return (
    typeof value === "string" &&
    (SERVER_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Values a parameterised message needs (see `serverErrors.CLAIM_SUBMIT_INCOMPLETE_*`). */
export type ServerErrorParams = Readonly<Record<string, string | number>>;

/**
 * The failure half of a service result.
 *
 * Built through a function rather than written as a literal because a literal in return position
 * widens `code` to `string`, which then will not satisfy `ServerErrorCode` at the call site. The
 * parameter type pins it.
 */
export function fail(
  code: ServerErrorCode,
  codeParams?: ServerErrorParams
): { ok: false; code: ServerErrorCode; codeParams?: ServerErrorParams } {
  return codeParams ? { ok: false, code, codeParams } : { ok: false, code };
}
