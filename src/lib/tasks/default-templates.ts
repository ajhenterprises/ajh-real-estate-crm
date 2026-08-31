/**
 * Default transaction checklist templates.
 *
 * These are general real-estate transaction *workflow* items — organizational
 * reminders for an agent to track a deal, not legal advice and not
 * contractually-required deadlines. Nothing here is a substitute for reading
 * the actual signed contract or consulting the applicable brokerage/legal
 * requirements for a transaction.
 *
 * This is reference/configuration data, not a hard-coded UI list: it's
 * seeded into the `TaskTemplate` table (see prisma/seed.ts) and every page
 * that generates or displays a checklist reads from that table, never from
 * this array directly. Editing a real deployment's checklist means editing
 * the `task_templates` rows, not this file or a React component.
 *
 * Due dates are intentionally left unset for every item here — this phase
 * does not invent relative "days after X" deadlines. The schema
 * (dueDateOffsetDays / dueDateAnchor) exists so a later phase can assign
 * them deliberately, or derive them from agent-confirmed contract dates.
 */

export interface DefaultTaskTemplate {
  key: string;
  category: string;
  title: string;
  description?: string;
}

const buyerUnderContract: DefaultTaskTemplate[] = [
  { key: "buyer_review_contract", title: "Review fully executed contract" },
  { key: "buyer_send_contract_lender", title: "Send contract to lender" },
  { key: "buyer_send_contract_title", title: "Send contract to title/closing company" },
  { key: "buyer_confirm_earnest_money", title: "Confirm earnest money instructions" },
  { key: "buyer_confirm_inspection_appt", title: "Confirm inspection appointment" },
  { key: "buyer_confirm_contract_dates", title: "Confirm important contract dates" },
  { key: "buyer_add_deadlines_crm", title: "Add transaction deadlines to CRM" },
].map((t) => ({ ...t, category: "Under Contract / Initial" }));

const buyerInspection: DefaultTaskTemplate[] = [
  { key: "buyer_confirm_inspection_scheduled", title: "Confirm inspection scheduled" },
  { key: "buyer_review_inspection_report", title: "Review inspection report" },
  { key: "buyer_discuss_inspection_findings", title: "Discuss inspection findings with client" },
  {
    key: "buyer_determine_repairs_credits",
    title: "Determine whether repairs/credits need to be addressed",
  },
  { key: "buyer_track_inspection_resolution", title: "Track inspection resolution" },
].map((t) => ({ ...t, category: "Inspection" }));

const buyerFinancing: DefaultTaskTemplate[] = [
  { key: "buyer_confirm_loan_application", title: "Confirm loan application submitted" },
  { key: "buyer_monitor_lender_milestones", title: "Monitor lender milestones" },
  { key: "buyer_confirm_appraisal_ordered", title: "Confirm appraisal ordered" },
  { key: "buyer_confirm_appraisal_completed", title: "Confirm appraisal completed" },
  { key: "buyer_confirm_financing_progress", title: "Confirm financing progress" },
  { key: "buyer_confirm_clear_to_close", title: "Confirm clear-to-close" },
].map((t) => ({ ...t, category: "Financing" }));

const buyerClosingPrep: DefaultTaskTemplate[] = [
  { key: "buyer_confirm_title_closing_status", title: "Confirm title/closing status" },
  { key: "buyer_confirm_closing_date", title: "Confirm closing date" },
  { key: "buyer_schedule_final_walkthrough", title: "Schedule final walkthrough" },
  { key: "buyer_complete_final_walkthrough", title: "Complete final walkthrough" },
  { key: "buyer_confirm_closing_instructions", title: "Confirm closing instructions" },
  { key: "buyer_confirm_client_closing_logistics", title: "Confirm client knows closing logistics" },
].map((t) => ({ ...t, category: "Closing Preparation" }));

const buyerClosing: DefaultTaskTemplate[] = [
  { key: "buyer_attend_confirm_closing", title: "Attend/confirm closing" },
  { key: "buyer_confirm_transaction_closed", title: "Confirm transaction closed" },
  { key: "buyer_record_actual_closing_date", title: "Record actual closing date" },
  { key: "buyer_post_closing_follow_up", title: "Complete post-closing follow-up" },
].map((t) => ({ ...t, category: "Closing" }));

export const BUYER_CHECKLIST_TEMPLATES: DefaultTaskTemplate[] = [
  ...buyerUnderContract,
  ...buyerInspection,
  ...buyerFinancing,
  ...buyerClosingPrep,
  ...buyerClosing,
];

const sellerUnderContract: DefaultTaskTemplate[] = [
  { key: "seller_review_contract", title: "Review fully executed contract" },
  { key: "seller_send_contract_parties", title: "Send contract to appropriate parties" },
  { key: "seller_confirm_closing_title_contact", title: "Confirm closing company/title contact" },
  { key: "seller_confirm_contract_dates", title: "Confirm important contract dates" },
  { key: "seller_add_deadlines_crm", title: "Add transaction deadlines to CRM" },
].map((t) => ({ ...t, category: "Under Contract / Initial" }));

const sellerInspection: DefaultTaskTemplate[] = [
  { key: "seller_receive_inspection_requests", title: "Receive inspection-related requests" },
  { key: "seller_review_repair_credit_requests", title: "Review repair/credit requests" },
  { key: "seller_discuss_requests_with_seller", title: "Discuss requests with seller" },
  { key: "seller_track_negotiated_resolution", title: "Track negotiated resolution" },
].map((t) => ({ ...t, category: "Inspection" }));

const sellerAppraisalFinancing: DefaultTaskTemplate[] = [
  { key: "seller_monitor_appraisal_status", title: "Monitor appraisal status" },
  { key: "seller_monitor_buyer_financing", title: "Monitor buyer financing progress" },
  { key: "seller_track_major_milestones", title: "Track major transaction milestones" },
].map((t) => ({ ...t, category: "Appraisal / Financing" }));

const sellerClosingPrep: DefaultTaskTemplate[] = [
  { key: "seller_confirm_title_closing_status", title: "Confirm title/closing status" },
  { key: "seller_confirm_closing_date", title: "Confirm closing date" },
  { key: "seller_confirm_closing_requirements", title: "Confirm seller closing requirements" },
  { key: "seller_confirm_possession_arrangements", title: "Confirm possession arrangements" },
  {
    key: "seller_confirm_final_walkthrough_arrangements",
    title: "Confirm final walkthrough arrangements",
  },
].map((t) => ({ ...t, category: "Closing Preparation" }));

const sellerClosing: DefaultTaskTemplate[] = [
  { key: "seller_confirm_closing", title: "Confirm closing" },
  { key: "seller_record_actual_closing_date", title: "Record actual closing date" },
  { key: "seller_post_closing_follow_up", title: "Complete post-closing follow-up" },
].map((t) => ({ ...t, category: "Closing" }));

export const SELLER_CHECKLIST_TEMPLATES: DefaultTaskTemplate[] = [
  ...sellerUnderContract,
  ...sellerInspection,
  ...sellerAppraisalFinancing,
  ...sellerClosingPrep,
  ...sellerClosing,
];
