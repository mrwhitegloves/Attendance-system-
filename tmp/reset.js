const mongoose = require('mongoose');
const uri = "mongodb+srv://whiteglovesapp_db_user:CrwWb4sjTZiUSFn5@attendie.g3vmnhp.mongodb.net/Attendie?";

async function reset() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected.");

    const collections = ['attendances', 'leaverequests', 'counters', 'users'];
    
    for (const c of collections) {
      console.log(`Resetting collection: ${c}...`);
      try {
        await mongoose.connection.collection(c).deleteMany({});
        console.log(`Cleared ${c}.`);
      } catch (err) {
        console.log(`Collection ${c} might not exist yet.`);
      }
    }

    console.log("Data reset complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

reset();
