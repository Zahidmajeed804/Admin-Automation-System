import { User } from "../models/index.js";
import { normalizePhone } from "../utils/phone.js";
import { logger } from "../utils/logger.js";

/**
 * Data fixes that keep an existing database in step with the models. Run by
 * `npm run seed` after the RBAC catalog; every step is safe to repeat.
 */
export async function runDataMigrations() {
  await migrateUserContactFields();
}

// AAS-468: email became optional and phone unique (both via partial unique indexes),
// and phones are stored normalized. Existing data needs:
//   1. "" / null emails and phones removed (the partial indexes skip missing fields),
//   2. phones rewritten in the normalized form,
//   3. the old plain unique `email_1` index replaced (syncIndexes drops indexes whose
//      options no longer match the schema and builds the new ones).
// Duplicate phones (two people with the same number) are reported, not merged: the
// phone index is only built once they're fixed and the seed is run again.
export async function migrateUserContactFields() {
  const collection = User.collection;

  const blankEmails = await collection.updateMany({ email: { $in: ["", null] } }, { $unset: { email: "" } });
  const blankPhones = await collection.updateMany({ phone: { $in: ["", null] } }, { $unset: { phone: "" } });

  let normalized = 0;
  const withPhone = await collection.find({ phone: { $type: "string" } }, { projection: { phone: 1 } }).toArray();
  for (const doc of withPhone) {
    const phone = normalizePhone(doc.phone);
    if (phone !== doc.phone) {
      await collection.updateOne({ _id: doc._id }, phone ? { $set: { phone } } : { $unset: { phone: "" } });
      normalized += 1;
    }
  }

  const duplicates = await collection
    .aggregate([
      { $match: { phone: { $type: "string" } } },
      { $group: { _id: "$phone", users: { $push: "$name" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicates.length) {
    for (const d of duplicates) {
      logger.warn(`Phone ${d._id} is shared by ${d.users.join(", ")} — give each person their own number.`);
    }
    logger.warn("Phone numbers must be unique: fix the duplicates above, then run `npm run seed` again.");
  }

  try {
    await User.syncIndexes();
  } catch (err) {
    if (err.code !== 11000) throw err;
    logger.warn(`User indexes not fully updated (duplicate value): ${err.message}`);
  }

  logger.info(
    `User contact fields: ${blankEmails.modifiedCount} blank email(s) and ${blankPhones.modifiedCount} blank phone(s) cleared, ` +
      `${normalized} phone(s) normalized, ${duplicates.length} duplicate phone(s).`
  );
  return { duplicates: duplicates.length, normalized };
}
