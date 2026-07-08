export interface Admin {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  bvn: string;
  password: string;
  image: string;
  role: string;
  dateJoined: string;
  activity: Activity[];
}

export interface Activity {
  id: string;
  description: string;
  date: string;
}
