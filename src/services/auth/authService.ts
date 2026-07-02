import type { User } from "../../types/app";
import { setCurrentUser } from "./session";

export async function login(
  employeeId: string,
  password: string
): Promise<User | null> {

  if (employeeId === "admin" && password === "admin") {

    const user: User = {
      id: "1",
      employeeId: "admin",

      companyId: "CMP001",

      branchId: "BR001",

      departmentId: "DEP001",

      designationId: "DES001",

      roleId: "ROLE001",

      firstName: "Super",

      lastName: "Admin",

      email: "admin@sk.com",

      mobile: "9999999999",

      profileImage: "",

      status: "active",
    };

    setCurrentUser(user);

    return user;
  }

  return null;
}