import { installLocalImages } from "./local-images";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { nativeLinkTarget, shareExtension } from "./policies";
import { overlayStack, formLeaves } from "../../src/lib/formLifecycle";

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.movenotesPlatform = Capacitor.getPlatform();
  void App.addListener("backButton", ({ canGoBack }) => {
    if (
      overlayStack.count() > 0 ||
      document.querySelector('[aria-modal="true"]')
    ) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      return;
    }
    const back = () => {
      if (canGoBack && location.pathname !== "/") history.back();
      else if (location.pathname !== "/") {
        history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else void App.minimizeApp();
    };
    const leave = formLeaves.current();
    if (leave) leave.request(back, () => {});
    else back();
  });
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    }
  });
  const openLink = async (url: string) => {
    const target = nativeLinkTarget(url);
    if (
      !target ||
      location.pathname + location.search + location.hash === target
    )
      return;
    await Browser.close().catch(() => {});
    location.assign(target);
  };
  void App.addListener("appUrlOpen", ({ url }) => {
    void openLink(url);
  });
  void App.getLaunchUrl().then((value) => {
    if (value) void openLink(value.url);
  });
  // Preserve the PWA's share preview and selected fields; only transport changes.
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: (data: ShareData) =>
      !!data && (data.files?.every((f) => f instanceof File) ?? true),
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (data: ShareData) => {
      const files: string[] = [];
      for (const file of data.files || []) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("Could not prepare this file."));
          reader.readAsDataURL(file);
        });
        const saved = await Filesystem.writeFile({
          path: `movenotes-share-${crypto.randomUUID()}.${shareExtension(file.type)}`,
          data: base64,
          directory: Directory.Cache,
        });
        files.push(saved.uri);
      }
      try {
        await Share.share({
          title: data.title,
          text: data.text,
          url: data.url,
          files,
          dialogTitle: "Share from MoveNotes",
        });
      } catch (error) {
        if (/cancel/i.test(String((error as Error).message)))
          throw new DOMException("Sharing cancelled", "AbortError");
        throw error;
      }
    },
  });
}

if (Capacitor.isNativePlatform()) installLocalImages();
