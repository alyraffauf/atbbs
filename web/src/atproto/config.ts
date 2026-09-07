import shared from "../../../data/shared.json";

export interface Services {
  slingshot: string;
  constellation: string;
  lightrail: string;
}

export const SERVICES = shared.services as Services;
