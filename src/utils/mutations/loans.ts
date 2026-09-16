import { apiCall } from "../customApiCall";
import { API_ENDPOINTS } from "../../../apiConfig";

// POST /send-to-partner/{loanId}
export const sendLoanToPartner = async (
  loanId: number | string,
  payload: { partner_id: number },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.SendToPartner(loanId),
    "POST",
    payload,
    token
  );
};

//POst / Loan Grant

export const loanGrant = async (
  id: number | string,
  payload: { distribute_amount: number; status: string },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.LoanGrant(id),
    "POST",
    payload,
    token
  );
};

//POST /send to Loan Disburesement
export const distributeLoan = async (
  calcId: number | string,
  payload: { distribute_amount: number; status: string },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.LoanDistribute(calcId),
    "POST",
    payload,
    token
  );
};

//POST /admin/send-to-partner/{id}
export const sendToPartnerDetail = async (
  id: number | string,
  payload: {
    partner_id?: number;
    partner_ids?: number[];
    loan_application_id?: number;
  },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.SendToPartnerDetail(id),
    "POST",
    payload,
    token
  );
};

//POST - Mono Loan Calculation Approval
export const postMonoLoanCalculationApproval = async (
  id: number | string,
  payload: { amount: string; duration: string },
  token: string
): Promise<any> => {
  return await apiCall(
    API_ENDPOINTS.ADMIN.MonoLoanCalculationApproval(id),
    "POST",
    payload,
    token
  );
};

