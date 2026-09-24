export async function getAuthorizedAccountantClientIds(
  admin: any,
  userId: string,
  requestedClientId?: string | null
) {
  const { data: memberships, error: membershipError } = await admin
    .from('organization_members')
    .select('organization_id,role,accounting_access_role')
    .eq('user_id', userId)
    .in('role', ['owner', 'employee']);
  if (membershipError) throw membershipError;

  const membershipRows = memberships || [];
  const candidateOfficeIds = [...new Set(membershipRows.map((m: any) => String(m.organization_id)).filter(Boolean))];
  if (!candidateOfficeIds.length) return [] as string[];

  const { data: offices, error: officesError } = await admin
    .from('organizations')
    .select('id,organization_type')
    .in('id', candidateOfficeIds)
    .eq('organization_type', 'accounting');
  if (officesError) throw officesError;

  const officeIds = new Set((offices || []).map((o: any) => String(o.id)));
  const allowed = new Set<string>();

  for (const membership of membershipRows) {
    const officeId = String(membership.organization_id || '');
    if (!officeIds.has(officeId)) continue;

    const { data: officeAvailable, error: officeAccessError } = await admin.rpc(
      'organization_service_available',
      { org: officeId }
    );
    if (officeAccessError || !officeAvailable) continue;

    const { data: relations, error: relationError } = await admin
      .from('accountant_company')
      .select('client_organization_id')
      .eq('accountant_organization_id', officeId)
      .eq('status', 'active')
      .not('client_organization_id', 'is', null);
    if (relationError) throw relationError;

    const relationIds = new Set((relations || []).map((r: any) => String(r.client_organization_id)).filter(Boolean));
    if (!relationIds.size) continue;

    const isAdmin = membership.role === 'owner' ||
      (membership.role === 'employee' && membership.accounting_access_role === 'admin');

    if (isAdmin) {
      for (const id of relationIds) allowed.add(id);
      continue;
    }

    const { data: assignments, error: assignmentError } = await admin
      .from('accountant_client_assignments')
      .select('client_organization_id')
      .eq('accounting_organization_id', officeId)
      .eq('employee_user_id', userId);
    if (assignmentError) throw assignmentError;

    for (const row of assignments || []) {
      const id = String(row.client_organization_id || '');
      if (relationIds.has(id)) allowed.add(id);
    }
  }

  const candidates = requestedClientId
    ? (allowed.has(String(requestedClientId)) ? [String(requestedClientId)] : [])
    : [...allowed];

  const available: string[] = [];
  for (const clientId of candidates) {
    const { data, error } = await admin.rpc('organization_service_available', { org: clientId });
    if (!error && data) available.push(clientId);
  }
  return available;
}
