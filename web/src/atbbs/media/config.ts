import shared from "../../../../data/shared.json";

interface Cdn {
  url: string;
  image_format: string;
}

export const CDN = shared.cdn as Cdn;
