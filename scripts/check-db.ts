import { connectDB, getUsersCollection, closeDB } from "@workspace/db";

async function main() {
  await connectDB();
  const usersCol = await getUsersCollection();
  const users = await usersCol.find({}).toArray();
  console.log("Users in MongoDB:", users);
  await closeDB();
  process.exit(0);
}

main().catch((err) => {
  console.error("MongoDB check error:", err);
  process.exit(1);
});
