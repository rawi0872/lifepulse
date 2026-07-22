// Life Pulse Results — TypeScript contracts (Phase 1)
// No UI, no hooks, no Supabase queries, no templates, no adapters

export type ResultDomain =
  | 'body'
  | 'mind'
  | 'finance'
  | 'business'
  | 'learning'
  | 'skills'
  | 'passions'
  | 'goals'
  | 'custom';

export type ResultValueKind =
  | 'number'
  | 'count'
  | 'percentage'
  | 'duration'
  | 'currency'
  | 'rating';

export type ResultTargetDirection =
  | 'increase'
  | 'decrease'
  | 'maintain'
  | 'none';

export type ResultCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'
  | 'none';

/** Row from metric_definitions table. */
export interface MetricDefinitionRow {
  id: string;
  user_id: string;
  domain: ResultDomain;
  name: string;
  description: string | null;
  value_kind: ResultValueKind;
  unit: string;
  baseline_value: string | number | null;
  target_value: string | number | null;
  target_direction: ResultTargetDirection;
  cadence: ResultCadence;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Input for creating/updating a metric definition. */
export interface MetricDefinitionInput {
  domain: ResultDomain;
  name: string;
  description?: string | null;
  value_kind: ResultValueKind;
  unit: string;
  baseline_value?: string | number | null;
  target_value?: string | number | null;
  target_direction?: ResultTargetDirection;
  cadence?: ResultCadence;
}

/** Row from metric_entries table. */
export interface MetricEntryRow {
  id: string;
  user_id: string;
  metric_definition_id: string;
  value: string | number;
  recorded_at: string;
  notes: string | null;
  created_at: string;
}

/** Input for creating a metric entry. */
export interface MetricEntryInput {
  metric_definition_id: string;
  value: string | number;
  recorded_at?: string;
  notes?: string;
}

/** Type guards. */
export function isResultDomain(v: string): v is ResultDomain {
  return ['body','mind','finance','business','learning','skills','passions','goals','custom'].includes(v);
}

export function isResultValueKind(v: string): v is ResultValueKind {
  return ['number','count','percentage','duration','currency','rating'].includes(v);
}

export function isResultTargetDirection(v: string): v is ResultTargetDirection {
  return ['increase','decrease','maintain','none'].includes(v);
}

export function isResultCadence(v: string): v is ResultCadence {
  return ['daily','weekly','monthly','quarterly','yearly','custom','none'].includes(v);
}
