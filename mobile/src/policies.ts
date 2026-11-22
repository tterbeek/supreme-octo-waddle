export function nativeLinkTarget(value: string) {
  try {
    const link = new URL(value);
    if (link.protocol !== "movenotes:") return null;
    const target = "/" + (link.hostname + link.pathname).replace(/^\/+/, "");
    if (
      !/^\/(auth\/email-change|settings\/polar\/callback|auth\/strava\/callback|circle\/invite\/[^/]+|community\/join\/[^/]+)$/.test(
        target,
      )
    )
      return null;
    return target + link.search + link.hash;
  } catch {
    return null;
  }
}
export function shareExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "application/json") return "json";
  if (type === "text/csv") return "csv";
  throw Error("This file type is not supported for sharing.");
}
