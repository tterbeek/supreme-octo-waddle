/** Local Edge SDKs sign against Docker's internal Kong URL. Browsers use the
 * same signed path/token through the app's configured Supabase gateway. */
export function socialMediaUrl(value: string, supabaseUrl: string): string {
  const signed = new URL(value, supabaseUrl);
  const internal = signed.hostname === 'kong' || /^supabase[_-]kong(?:[_-]|$)/.test(signed.hostname);
  if (internal && signed.pathname.startsWith('/storage/v1/object/sign/')) {
    const gateway = new URL(supabaseUrl);
    signed.protocol = gateway.protocol;
    signed.host = gateway.host;
    return signed.toString();
  }
  return value;
}
