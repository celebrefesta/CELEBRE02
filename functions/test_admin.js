const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (getApps().length === 0) {
    initializeApp({ projectId: "celebre-9f5c9" });
}
const db = getFirestore();

async function test() {
  try {
    const snap = await db.collection("usuarios").where("email", "==", "thidovi12@gmail.com").get();
    console.log("Found:", snap.size);
    snap.forEach(d => {
      console.log("ID:", d.id);
      console.log("Data:", JSON.stringify(d.data(), null, 2));
    });
  } catch (e) {
    console.error("Admin error:", e.message);
  }
}

test();
