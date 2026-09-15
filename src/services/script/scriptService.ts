import {
  getScripts, createScript, updateScript, deleteScript, toggleScriptStatus, uploadScriptInlineImage,
} from "../../repositories/script/scriptRepository";
import type { Script, ScriptForm } from "../../types/script";

class ScriptService {
  async getAll(): Promise<Script[]> {
    return await getScripts();
  }

  async create(script: Partial<ScriptForm>): Promise<Script> {
    this.validate(script);
    return await createScript(script);
  }

  async update(id: string, script: Partial<ScriptForm>): Promise<Script> {
    if (!id) throw new Error("Invalid script id.");
    this.validate(script);
    return await updateScript(id, script);
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error("Invalid script id.");
    await deleteScript(id);
  }

  async setStatus(id: string, active: boolean): Promise<void> {
    if (!id) throw new Error("Invalid script id.");
    await toggleScriptStatus(id, active);
  }

  async uploadInlineImage(file: File): Promise<string> {
    return uploadScriptInlineImage(file);
  }

  private validate(script: Partial<ScriptForm>): void {
    if (!script.company_id) throw new Error("Company is required.");
    if (!script.title?.trim()) throw new Error("Title is required.");
  }
}

export const scriptService = new ScriptService();
