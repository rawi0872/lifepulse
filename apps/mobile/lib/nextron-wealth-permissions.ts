import { supabase } from "./supabase";
export type WealthNextronSection = "balances" | "cash_flow" | "transactions_summary" | "recurring_items" | "wealth_goals";
export const WEALTH_NEXTRON_SECTIONS: WealthNextronSection[] = ["balances","cash_flow","transactions_summary","recurring_items","wealth_goals"];
export interface WealthNextronPermissions { master: boolean; sections: WealthNextronSection[]; }

export async function loadWealthNextronPermissions(): Promise<WealthNextronPermissions> {
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) return { master:false, sections:[] };
  const { data } = await supabase.from("finance_preferences").select("nextron_access_enabled, nextron_allowed_sections").eq("user_id", user.id).maybeSingle();
  if(!data) return { master:false, sections:[] };
  return { master: !!data.nextron_access_enabled, sections: ((data.nextron_allowed_sections as string[]) ?? []).filter((s):s is WealthNextronSection=> (WEALTH_NEXTRON_SECTIONS as string[]).includes(s)) };
}
export async function setWealthNextronMaster(enabled:boolean){
  const { data:{user} } = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const cur = await loadWealthNextronPermissions().catch(()=> ({master:false, sections:[] as WealthNextronSection[]}));
  const payload: any = { user_id: user.id, nextron_access_enabled: enabled, nextron_allowed_sections: cur.sections };
  // if row missing, this creates it with current sections (possibly [])
  const { error } = await supabase.from("finance_preferences").upsert(payload, { onConflict:"user_id" });
  if(error) throw error;
}
export async function setWealthNextronSection(section: WealthNextronSection, enabled:boolean){
  const { data:{user} } = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const cur = await loadWealthNextronPermissions();
  let next = cur.sections.filter(s=>s!==section);
  if(enabled) next.push(section);
  next = Array.from(new Set(next)).filter(s=> (WEALTH_NEXTRON_SECTIONS as string[]).includes(s)) as WealthNextronSection[];
  const { error } = await supabase.from("finance_preferences").upsert({ user_id:user.id, nextron_allowed_sections: next }, { onConflict:"user_id" });
  if(error) throw error;
}
export function getEffectiveWealthNextronSections(perms: WealthNextronPermissions): WealthNextronSection[] {
  if(!perms.master) return [];
  return perms.sections.filter(s=> (WEALTH_NEXTRON_SECTIONS as string[]).includes(s));
}
// fail-closed helper for evidence builder
export function isWealthSectionEffective(perms: WealthNextronPermissions | null, section: WealthNextronSection): boolean {
  if(!perms || !perms.master) return false;
  return perms.sections.includes(section);
}
