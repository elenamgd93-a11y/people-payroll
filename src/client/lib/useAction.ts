import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "@/client/lib/format";

/** Runs a change, then reloads the page's data; keeps the error to show. */
export function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setPending(true);
    try {
      const result = await work();
      await router.invalidate();
      return result;
    } catch (e) {
      setError(errorMessage(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, error, setError, pending };
}
