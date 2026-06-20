/** Shared SWR fetcher — includes cookies and throws on API errors. */
export async function jsonFetcher(url: string) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.error?.message === "string"
          ? data.error.message
          : "Request failed";
    throw new Error(message);
  }
  return data;
}
