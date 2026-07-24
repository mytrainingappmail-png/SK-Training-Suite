import {
  getItems,
  createItem as repoCreateItem,
  updateItem,
  deleteItem,
} from "../../repositories/brainstorming/brainstormingRepository";
import type { BrainstormingItem, BrainstormingItemForm } from "../../types/brainstorming";

export async function loadItems(): Promise<BrainstormingItem[]> {
  return getItems();
}

function validateForm(form: BrainstormingItemForm): void {
  if (!form.question.trim()) throw new Error("Question is required.");
  if (!form.answer.trim()) throw new Error("Answer is required.");
}

export async function saveItem(form: BrainstormingItemForm): Promise<BrainstormingItem> {
  validateForm(form);
  return repoCreateItem(form);
}

export async function editItem(id: string, form: Partial<BrainstormingItemForm>): Promise<BrainstormingItem> {
  if (!id) throw new Error("Invalid item ID.");
  return updateItem(id, form);
}

export async function removeItem(id: string): Promise<void> {
  await deleteItem(id);
}
