import admin from "firebase-admin";

const app =
  admin.apps.length > 0
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });

const adminDb = admin.firestore(app);

export { adminDb };
export default admin;