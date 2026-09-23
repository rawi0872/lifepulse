import { supabase } from "./supabase";
import {
  WEALTH_NEXTRON_SECTIONS,
  getEffectiveWealthNextronSections,
  isWealthSectionEffective,
  sanitizeWealthNextronSections,
  DEFAULT_WEALTH_NEXTRON_PERMISSIONS,
} from "@lifepulse/domain";
import type { WealthNextronPermissions, WealthNextronSection } from "@lifepulse/domain";

export { WEALTH_NEXTRON_SECTIONS, getEffectiveWealthNextronSections, isWealthSectionEffective };
export type { WealthNextronPermissions, WealthNextronSection };

export async function loadWealthNextronPermissions(): Promise<WealthNextronPermissions> {
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) return DEFAULT_WEALTH_NEXTRON_PERMISSIONS;
  const { data } = await supabase.from("finance_preferences").select("nextron_access_enabled, nextron_allowed_sections").eq("user_id", user.id).maybeSingle();
  if(!data) return DEFAULT_WEALTH_NEXTRON_PERMISSIONS;
  return { master: !!(data as any).nextron_access_enabled, sections: sanitizeWealthNextronSections(((data as any).nextron_allowed_sections as string[]) ?? []) };
}
export async function setWealthNextronMaster(enabled:boolean){
  const { data:{user} } = await supabase.auth.getUser(); if(!user) throw new Error("not authed");
  const cur = await loadWealthNextronPermissions().catch(()=> DEFAULT_WEALTH_NEXTRON_PERMISSIONS);
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
  next = sanitizeWealthNextronSections(next);
  const { error } = await supabase.from("finance_preferences").upsert({ user_id:user.id, nextron_allowed_sections: next }, { onConflict:"user_id" });
  if(error) throw error;
}
