export const GOOGLE_PICKER_API_SCRIPT_URL = "https://apis.google.com/js/api.js";

let apiScriptPromise: Promise<void> | null = null;
let pickerModulePromise: Promise<void> | null = null;

function isPickerReady(): boolean {
  return Boolean(window.google?.picker?.PickerBuilder);
}

function isGapiReady(): boolean {
  return Boolean(window.gapi?.load);
}

export function resetGooglePickerLoaderForTests() {
  apiScriptPromise = null;
  pickerModulePromise = null;
}

export function loadGoogleApiScript(): Promise<void> {
  if (isGapiReady()) return Promise.resolve();
  if (apiScriptPromise) return apiScriptPromise;

  apiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_PICKER_API_SCRIPT_URL}"]`);
    const script = existing ?? document.createElement("script");

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      if (isGapiReady()) resolve();
      else reject(new Error("GAPI_UNAVAILABLE"));
    };
    const onError = () => {
      cleanup();
      apiScriptPromise = null;
      if (!existing) script.remove();
      reject(new Error("SCRIPT_LOAD_FAILED"));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.src = GOOGLE_PICKER_API_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }).catch((error) => {
    apiScriptPromise = null;
    throw error;
  });

  return apiScriptPromise;
}

export async function loadGooglePickerModule(): Promise<void> {
  if (isPickerReady()) return;
  if (pickerModulePromise) return pickerModulePromise;

  pickerModulePromise = loadGoogleApiScript().then(() => new Promise<void>((resolve, reject) => {
    window.gapi?.load("picker", () => {
      if (isPickerReady()) resolve();
      else reject(new Error("PICKER_LOAD_FAILED"));
    });
  })).catch((error) => {
    pickerModulePromise = null;
    throw error;
  });

  return pickerModulePromise;
}
