import type { User } from "../../types/app";

let currentUser: User | null = null;

export function setCurrentUser(user: User) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

export function logout() {
  currentUser = null;
}