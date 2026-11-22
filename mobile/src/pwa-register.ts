// Android loads its bundled PWA assets. Updates arrive through APK installation,
// so a service worker must not cache an older native bundle.
export const registerSW = () => async () => {};
