import { API_ORIGIN } from "../../apiConfig";

export const userProfileImageUrl = (profilePicture?: string | null): string => {
  if (!profilePicture) {
    return "/assets/images/profile.png";
  }
  if (profilePicture.startsWith("http") || profilePicture.startsWith("/")) {
    return profilePicture;
  }
  return `${API_ORIGIN}/users/${profilePicture}`;
};

export const formatUserActivityDate = (dateStr: string): string => {
  return new Date(dateStr)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\//g, "-")
    .replace(",", "/");
};
