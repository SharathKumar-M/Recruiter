import { db, usersTable } from "@workspace/db";

async function main() {
  const users = await db.select().from(usersTable);
  console.log("Users in DB:", users);
  process.exit(0);
}

main().catch(err => {
  console.error("DB check error:", err);
  process.exit(1);
});
