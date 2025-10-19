import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { completeOnboarding, fetchDraft, saveDraft } from "../lib/api";
import type { OnboardingDraftData } from "./types";

const STORAGE_KEY = "apgms:onboarding:draft-token";

type DraftSaveResult = Awaited<ReturnType<typeof saveDraft>> | null;

type CompletionResult = Awaited<ReturnType<typeof completeOnboarding>>;

interface OnboardingContextValue {
  data: OnboardingDraftData;
  token: string | null;
  isSaving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  completion: CompletionResult | null;
  updateSection<K extends keyof OnboardingDraftData>(
    section: K,
    value: OnboardingDraftData[K]
  ): void;
  complete: () => Promise<CompletionResult>;
  clearError: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingDraftData>({});
  const [token, setToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [initialised, setInitialised] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingSaveRef = useRef<Promise<DraftSaveResult> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    tokenRef.current = token;
    if (typeof window !== "undefined" && token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setInitialised(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
          window.localStorage.setItem(STORAGE_KEY, urlToken);
          params.delete("token");
          const nextSearch = params.toString();
          const nextUrl = `${window.location.pathname}${
            nextSearch ? `?${nextSearch}` : ""
          }${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
        }

        const storedToken =
          urlToken ?? window.localStorage.getItem(STORAGE_KEY) ?? undefined;

        if (storedToken) {
          try {
            const draft = await fetchDraft(storedToken);
            if (cancelled || !mountedRef.current) {
              return;
            }
            setToken(draft.token);
            setData((draft.data ?? {}) as OnboardingDraftData);
            setLastSavedAt(draft.updatedAt);
          } catch (fetchError) {
            if ((fetchError as { status?: number }).status === 404) {
              window.localStorage.removeItem(STORAGE_KEY);
              setToken(null);
              setData({});
            } else {
              setError("We couldn't load your saved draft. Please try again.");
            }
          }
        }
      } finally {
        if (!cancelled) {
          setInitialised(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistDraft = useCallback(async (): Promise<DraftSaveResult> => {
    if (!initialised) {
      return null;
    }

    setIsSaving(true);
    try {
      const response = await saveDraft({
        token: tokenRef.current,
        data,
      });
      if (!mountedRef.current) {
        return response;
      }
      setToken(response.token);
      setLastSavedAt(response.updatedAt);
      setError(null);
      return response;
    } catch (persistError) {
      if (!mountedRef.current) {
        throw persistError;
      }
      setError("Saving draft failed. Changes are stored locally until retried.");
      throw persistError;
    } finally {
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [data, initialised]);

  const runPersist = useCallback(() => {
    const promise = persistDraft().finally(() => {
      if (pendingSaveRef.current === promise) {
        pendingSaveRef.current = null;
      }
    });
    pendingSaveRef.current = promise;
    return promise;
  }, [persistDraft]);

  useEffect(() => {
    if (!initialised) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      runPersist().catch(() => undefined);
    }, 600);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, initialised, runPersist]);

  const flushDraft = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (pendingSaveRef.current) {
      try {
        await pendingSaveRef.current;
      } catch (error) {
        // error already surfaced via context state
      }
    }
    return runPersist();
  }, [runPersist]);

  const updateSection = useCallback(
    <K extends keyof OnboardingDraftData>(
      section: K,
      value: OnboardingDraftData[K]
    ) => {
      setData((previous) => ({
        ...previous,
        [section]: value,
      }));
    },
    []
  );

  const complete = useCallback(async () => {
    const draft = await flushDraft();
    const activeToken = draft?.token ?? tokenRef.current ?? token;

    if (!activeToken) {
      throw new Error("Unable to resolve onboarding draft token");
    }

    const result = await completeOnboarding({
      token: activeToken,
      data,
    });

    setCompletion(result);
    setData((current) => ({
      ...current,
      status: result.status,
      completedAt: result.completedAt,
    }));
    setToken(activeToken);
    return result;
  }, [data, flushDraft, token]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      token,
      isSaving,
      lastSavedAt,
      error,
      completion,
      updateSection,
      complete,
      clearError: () => setError(null),
    }),
    [completion, data, error, isSaving, lastSavedAt, token, updateSection, complete]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
