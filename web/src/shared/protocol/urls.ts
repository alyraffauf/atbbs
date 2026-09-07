import { CDN } from "../../atproto/config";

export function blobUrl(pds: string, did: string, cid: string): string {
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
}

export function cdnImageUrl(did: string, cid: string): string {
  return `${CDN.url}/img/feed_fullsize/plain/${did}/${cid}@${CDN.image_format}`;
}
