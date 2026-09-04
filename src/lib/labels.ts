import type {
  ClientType,
  ContactActivityType,
  ContactType,
  ContractPeriodDayType,
  DeductibilityStatus,
  DocumentStatus,
  DocumentType,
  PaymentMethod,
  ShowingStatus,
  TaskPriority,
  TaskStatus,
  TransactionEventType,
  TransactionStatus,
  TransactionType,
} from "@/generated/prisma/enums";

// Centralized display labels for enum values used across list, detail,
// and form views — one place to keep the label text in sync with the
// schema instead of an ad-hoc Record in every page that shows one.

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  LEAD: "Lead",
  ACTIVE_CLIENT: "Active client",
  INACTIVE_CLIENT: "Inactive client",
  PAST_CLIENT: "Past client",
  VENDOR: "Vendor",
  OTHER: "Other",
};

// Which statuses count as an operational client — the same distinction
// Client.status used to draw, now folded into ContactType. Used anywhere
// that needs to gate a client-only feature (starting a transaction,
// showing the Buyer/Seller type field) without hardcoding the three values.
export const CLIENT_CONTACT_TYPES: readonly ContactType[] = ["ACTIVE_CLIENT", "INACTIVE_CLIENT", "PAST_CLIENT"];

export const CONTACT_ACTIVITY_TYPE_LABELS: Record<ContactActivityType, string> = {
  CREATED: "Created",
  NOTE_ADDED: "Note",
  STATUS_CHANGED: "Status changed",
  SYNCED: "Synced",
  OTHER: "Other",
  CALL: "Call",
  EMAIL: "Email",
  TEXT: "Text",
  SHOWING: "Showing",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  BUYER_AND_SELLER: "Buyer & Seller",
  OTHER: "Other",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  OTHER: "Other",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const SHOWING_STATUS_LABELS: Record<ShowingStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TRANSACTION_EVENT_TYPE_LABELS: Record<TransactionEventType, string> = {
  CONTRACT_EFFECTIVE: "Contract Effective Date",
  EARNEST_MONEY_DUE: "Earnest Money Due",
  INSPECTION_PERIOD_START: "Inspection Period Starts",
  INSPECTION_PERIOD_END: "Inspection Period Ends",
  FINANCING_DEADLINE: "Financing Deadline",
  APPRAISAL_DEADLINE: "Appraisal Deadline",
  TITLE_DEADLINE: "Title Deadline",
  CLOSING_DATE: "Closing Date",
  FINAL_WALKTHROUGH: "Final Walkthrough",
  POSSESSION_DATE: "Possession Date",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRACT: "Contract",
  DISCLOSURE: "Disclosure",
  ADDENDUM: "Addendum",
  INSPECTION_REPORT: "Inspection",
  APPRAISAL: "Appraisal",
  TITLE_DOCUMENT: "Title",
  CLOSING_STATEMENT: "Closing",
  RECEIPT: "Receipt",
  OTHER: "Other",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Uploaded",
  REVIEWED: "Reviewed",
  ARCHIVED: "Archived",
  PENDING_DELETION: "Pending deletion",
};

export const CONTRACT_PERIOD_DAY_TYPE_LABELS: Record<ContractPeriodDayType, string> = {
  CALENDAR: "Calendar days",
  BUSINESS: "Business days (Mon–Fri, holidays not excluded)",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BUSINESS_BANK_ACCOUNT: "Business Bank Account",
  BUSINESS_CREDIT_CARD: "Business Credit Card",
  PERSONAL_CARD: "Personal Card",
  CASH: "Cash",
  CHECK: "Check",
  OTHER: "Other",
};

// Record-keeping labels only — see DeductibilityStatus's schema comment.
// "Deductible" here reflects the status the user (or their tax
// professional) has entered, never a determination this app makes.
export const DEDUCTIBILITY_STATUS_LABELS: Record<DeductibilityStatus, string> = {
  NEEDS_REVIEW: "Needs Review",
  DEDUCTIBLE: "Deductible",
  NOT_DEDUCTIBLE: "Not Deductible",
};
