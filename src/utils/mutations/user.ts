import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

// POST /Add User
export const addUser = async (
  payload: {
    first_name?: string;
    email?: string;
    phone?: string;
    bvn?: string;
    password?: string;
    role?: "user" | "admin" | "super_admin";
  },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(API_ENDPOINTS.ADMIN.AddUser, "POST", payload, token);
};

//POST /admin/user/edit-user/{id}
export const editUser = async (
  id: number | string,
  payload:
    | FormData
    | {
        profile_picture?: string;
        first_name?: string;
        sur_name?: string;
        email?: string;
        phone?: string;
        bvn?: string;
        password?: string;
        referral?: string;
      },
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.EditUser(id),
    "POST",
    payload,
    token
  );
};

//PoDst To update User
export const updateUser = async (
  payload: FormData,
  token: string
): Promise<{ status: string; data: unknown; message: string }> => {
  return await apiCall(API_ENDPOINTS.ADMIN.UpdateUser, "POST", payload, token);
};
