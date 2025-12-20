/**
 * Make Admin Users Script
 * Run with: npx tsx scripts/make-admins.ts email1@example.com email2@example.com
 * Or set ADMIN_EMAILS env var: ADMIN_EMAILS="email1@example.com,email2@example.com"
 */

import { db, users } from '../src/lib/db';
import { eq } from 'drizzle-orm';

// Get emails from command line args or environment variable
const argsEmails = process.argv.slice(2);
const envEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];
const ADMIN_EMAILS = argsEmails.length > 0 ? argsEmails : envEmails;

if (ADMIN_EMAILS.length === 0) {
  console.error('Usage: npx tsx scripts/make-admins.ts email1@example.com email2@example.com');
  console.error('   Or: ADMIN_EMAILS="email1,email2" npx tsx scripts/make-admins.ts');
  process.exit(1);
}

async function makeAdmins() {
  console.log('Setting up admin users...\n');

  for (const email of ADMIN_EMAILS) {
    const result = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email))
      .returning({ id: users.id, email: users.email });

    if (result.length > 0) {
      console.log(`✓ Made ${email} an admin`);
    } else {
      console.log(`- ${email} not found (will be admin when they sign up)`);
    }
  }

  // Show all admins
  const admins = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.role, 'admin'));

  console.log('\nCurrent admins:', admins);
}

makeAdmins()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
