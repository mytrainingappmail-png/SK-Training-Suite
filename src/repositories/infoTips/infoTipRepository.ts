// "i" tips. Reading uses the normal employee client (the table is readable by anyone);
// writing is allowed by the database ONLY for the platform operator.

import { supabase } from "../../lib/supabase";
import type { InfoTip, InfoTipInput } from "../../types/infoTip";

const COLUMNS = "id, route, label, title, body, active";

function fail(label: string, error: { message: string; code?: string }): never {
  console.error(`[infoTipRepository] ${label}:`, error);
  if (error.code === "23505") throw new Error("A tip for this control already exists on this screen. Edit that one instead.");
  if (error.code === "42501") throw new Error("Only the platform owner can change tips.");
  throw new Error(error.message);
}

export async function fetchInfoTips(): Promise<InfoTip[]> {
  const { data, error } = await supabase.from("info_tips").select(COLUMNS).order("route").order("label");
  if (error) fail("fetchInfoTips", error);
  return (data ?? []) as InfoTip[];
}

/** True only for a logged-in employee of the platform-operator company. */
export async function checkInfoTipOwner(): Promise<boolean> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return false;
  const { data, error } = await supabase.rpc("info_tips_is_owner");
  if (error) return false;
  return data === true;
}

export async function saveInfoTip(input: InfoTipInput): Promise<void> {
  const row = {
    route: input.route.trim(),
    label: input.label.trim(),
    title: input.title.trim() || null,
    body: input.body.trim(),
    active: input.active,
  };
  if (input.id) {
    const { error } = await supabase.from("info_tips").update(row).eq("id", input.id);
    if (error) fail("saveInfoTip(update)", error);
  } else {
    const { error } = await supabase.from("info_tips").insert(row);
    if (error) fail("saveInfoTip(insert)", error);
  }
}

export async function setInfoTipActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("info_tips").update({ active }).eq("id", id);
  if (error) fail("setInfoTipActive", error);
}

export async function deleteInfoTip(id: string): Promise<void> {
  const { error } = await supabase.from("info_tips").delete().eq("id", id);
  if (error) fail("deleteInfoTip", error);
}
