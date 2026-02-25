import type { CollectionReference, DocumentData, DocumentReference } from 'firebase/firestore';

export function userCollection(uid: string, name: string): CollectionReference<DocumentData>;
export function userDoc(uid: string, name: string, id: string): DocumentReference<DocumentData>;
