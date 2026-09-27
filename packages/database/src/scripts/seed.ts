import { newId } from '@hrms/domain';
import { sql } from 'drizzle-orm';

import { rawQuery } from '../client';
import { migrateDatabase } from '../migrate';
import { closeScriptDatabase, createScriptDatabase } from './_runtime';

interface SeededTenant {
  tenantId: string;
  companyId: string;
  employeeId: string;
}

async function seedTenant(
  db: Awaited<ReturnType<typeof createScriptDatabase>>,
  input: {
    slug: string;
    name: string;
    companyName: string;
    companyCode: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  },
): Promise<SeededTenant> {
  const [tenant] = await rawQuery<{ id: string }>(
    db,
    sql`insert into tenants (id, name, slug, status, primary_timezone, default_currency)
        values (${newId()}, ${input.name}, ${input.slug}, 'active', 'Asia/Kolkata', 'INR')
        on conflict (slug) do update
          set name = excluded.name,
              status = excluded.status,
              primary_timezone = excluded.primary_timezone,
              default_currency = excluded.default_currency
        returning id`,
  );

  const tenantId = tenant!.id;
  const [company] = await rawQuery<{ id: string }>(
    db,
    sql`insert into companies (id, tenant_id, legal_name, code, country, timezone, currency, status)
        values (${newId()}, ${tenantId}, ${input.companyName}, ${input.companyCode}, 'IN',
                'Asia/Kolkata', 'INR', 'active')
        on conflict on constraint companies_tenant_code_unique do update
          set legal_name = excluded.legal_name,
              country = excluded.country,
              timezone = excluded.timezone,
              currency = excluded.currency,
              status = excluded.status
        returning id`,
  );

  const companyId = company!.id;
  const [employee] = await rawQuery<{ id: string }>(
    db,
    sql`insert into employees (id, tenant_id, company_id, employee_code, first_name, last_name,
                               work_email, status, date_of_joining)
        values (${newId()}, ${tenantId}, ${companyId}, ${input.employeeCode}, ${input.firstName},
                ${input.lastName}, ${`${input.employeeCode.toLowerCase()}@${input.slug}.example`},
                'active', '2025-01-01')
        on conflict on constraint employees_tenant_company_code_unique do update
          set first_name = excluded.first_name,
              last_name = excluded.last_name,
              work_email = excluded.work_email,
              status = excluded.status
        returning id`,
  );

  return { tenantId, companyId, employeeId: employee!.id };
}

const db = await createScriptDatabase();

try {
  await migrateDatabase(db);
  const seeded = await Promise.all([
    seedTenant(db, {
      slug: 'tenant-alpha',
      name: 'Tenant Alpha',
      companyName: 'Alpha Technologies Pvt Ltd',
      companyCode: 'ALPHA-IN',
      employeeCode: 'A001',
      firstName: 'Asha',
      lastName: 'Iyer',
    }),
    seedTenant(db, {
      slug: 'tenant-beta',
      name: 'Tenant Beta',
      companyName: 'Beta Consulting Pvt Ltd',
      companyCode: 'BETA-IN',
      employeeCode: 'B001',
      firstName: 'Bilal',
      lastName: 'Khan',
    }),
  ]);

  console.warn(`Seeded ${seeded.length} tenants with isolated companies and employees.`);
} finally {
  await closeScriptDatabase(db);
}
