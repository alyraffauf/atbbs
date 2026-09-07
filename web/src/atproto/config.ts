import shared from "../../../data/shared.json";

export interface Services {
  slingshot: string;
  constellation: string;
  lightrail: string;
}

export interface Cdn {
  url: string;
  image_format: string;
}

export const SERVICES = shared.services as Services;
export const CDN = shared.cdn as Cdn;
