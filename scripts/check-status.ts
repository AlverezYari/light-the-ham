import { and, eq, isNotNull } from 'drizzle-orm';
import { contributions, db, properties, propertyPhotos } from '../src/lib/db';

async function check() {
  // Check pending properties
  const pendingProps = await db
    .select({ id: properties.id, address: properties.address, status: properties.status })
    .from(properties)
    .where(eq(properties.status, 'pending'));
  console.log('Pending Properties:', pendingProps);

  // Check approved properties
  const approvedProps = await db
    .select({ id: properties.id, address: properties.address, status: properties.status })
    .from(properties)
    .where(eq(properties.status, 'approved'));
  console.log('Approved Properties:', approvedProps.length);

  // Check pending photos
  const pendingPhotos = await db
    .select({ id: propertyPhotos.id, url: propertyPhotos.url, status: propertyPhotos.status })
    .from(propertyPhotos)
    .where(eq(propertyPhotos.status, 'pending'));
  console.log('Pending Photos:', pendingPhotos.length);

  // Check pending tips
  const pendingTips = await db
    .select({ id: contributions.id, tip: contributions.tip, status: contributions.status })
    .from(contributions)
    .where(and(eq(contributions.status, 'pending'), isNotNull(contributions.tip)));
  console.log('Pending Tips:', pendingTips.length);

  // Check approved photos
  const approvedPhotos = await db
    .select({ id: propertyPhotos.id, url: propertyPhotos.url })
    .from(propertyPhotos)
    .where(eq(propertyPhotos.status, 'approved'));
  console.log('Approved Photos:', approvedPhotos);

  // Check approved tips
  const approvedTips = await db
    .select({ id: contributions.id, tip: contributions.tip })
    .from(contributions)
    .where(and(eq(contributions.status, 'approved'), isNotNull(contributions.tip)));
  console.log('Approved Tips:', approvedTips);
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
