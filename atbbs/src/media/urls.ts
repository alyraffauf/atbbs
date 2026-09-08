import { CDN } from "../config";

export function avatarUrl(did: string, cid: string): string {
  return `${CDN.url}/img/avatar/plain/${did}/${cid}`;
}

export function cdnImageUrl(did: string, cid: string): string {
  return `${CDN.url}/img/feed_fullsize/plain/${did}/${cid}@${CDN.image_format}`;
}
