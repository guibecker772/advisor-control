import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

export function userCollection(uid, name) {
  return collection(db, "users", uid, name);
}

export function userDoc(uid, name, id) {
  return doc(db, "users", uid, name, id);
}
