/**
 * Supabase embedded relations can resolve as an array or a single object,
 * depending on the relationship metadata. Normalize both shapes without
 * accessing a property on an unreachable TypeScript `never` branch.
 */
export function customerNameFromRelation(relation: unknown, fallback = 'Customer'): string {
  const customer: unknown = Array.isArray(relation) ? relation[0] : relation;
  if (typeof customer !== 'object' || customer === null || !('name' in customer)) {
    return fallback;
  }
  const name = customer.name;
  return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}
