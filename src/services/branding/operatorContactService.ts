import { getPublicOperatorContact } from "../../repositories/branding/operatorContactRepository";
import type { PublicOperatorContact } from "../../repositories/branding/operatorContactRepository";

export async function loadOperatorContact(): Promise<PublicOperatorContact | null> {
  return getPublicOperatorContact();
}
