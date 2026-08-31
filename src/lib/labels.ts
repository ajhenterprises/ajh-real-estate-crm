import type {
  ClientStatus,
  ClientType,
  ContactType,
  ContractPeriodDayType,
  DocumentStatus,
  DocumentType,
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
  CLIENT: "Client",
  PAST_CLIENT: "Past client",
  VENDOR: "Vendor",
  OTHER: "Other",
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PAST: "Past",
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
  OTHER: "Other",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Uploaded",
  REVIEWED: "Reviewed",
  ARCHIVED: "Archived",
};

export const CONTRACT_PERIOD_DAY_TYPE_LABELS: Record<ContractPeriodDayType, string> = {
  CALENDAR: "Calendar days",
  BUSINESS: "Business days (Mon–Fri, holidays not excluded)",
};
