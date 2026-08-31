export type ContractStatus = "NOT_UPLOADED" | "UPLOADED" | "AWAITING_CONFIRMATION" | "CONFIRMED";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  NOT_UPLOADED: "Not uploaded",
  UPLOADED: "Uploaded",
  AWAITING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
};

interface ContractDocumentLike {
  id: string;
  contractInformation: { id: string; confirmedAt: Date | null } | null;
}

/**
 * Derives the transaction's overall contract status from real records —
 * there is no stored status column to drift out of sync. Considers every
 * CONTRACT-type document (not just the first), so a transaction with one
 * confirmed contract and one still-draft amendment correctly reads as
 * "Confirmed" — the confirmed one is what governs the transaction today.
 */
export function deriveContractStatus(contractDocuments: ContractDocumentLike[]): {
  status: ContractStatus;
  current: ContractDocumentLike | null;
} {
  if (contractDocuments.length === 0) {
    return { status: "NOT_UPLOADED", current: null };
  }

  const confirmed = contractDocuments.find((doc) => doc.contractInformation?.confirmedAt);
  if (confirmed) {
    return { status: "CONFIRMED", current: confirmed };
  }

  const withDraftInfo = contractDocuments.find((doc) => doc.contractInformation);
  if (withDraftInfo) {
    return { status: "AWAITING_CONFIRMATION", current: withDraftInfo };
  }

  return { status: "UPLOADED", current: contractDocuments[0] };
}
