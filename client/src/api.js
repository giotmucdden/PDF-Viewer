const BASE =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:4000");

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData
      ? undefined
      : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Songs
  getSongs: () => request("/api/songs"),
  uploadSong: (formData) =>
    request("/api/songs", { method: "POST", body: formData }),
  deleteSong: (id) => request(`/api/songs/${id}`, { method: "DELETE" }),

  // Setlists
  getSetlists: (month) =>
    request(`/api/setlists${month ? `?month=${month}` : ""}`),
  createSetlist: (name, date) =>
    request("/api/setlists", {
      method: "POST",
      body: JSON.stringify({ name, date }),
    }),
  deleteSetlist: (id) => request(`/api/setlists/${id}`, { method: "DELETE" }),
  getSetlistSongs: (id) => request(`/api/setlists/${id}/songs`),
  addSongToSetlist: (setlistId, songId) =>
    request(`/api/setlists/${setlistId}/songs`, {
      method: "POST",
      body: JSON.stringify({ song_id: songId }),
    }),
  removeSongFromSetlist: (setlistId, entryId) =>
    request(`/api/setlists/${setlistId}/songs/${entryId}`, { method: "DELETE" }),

  // Annotations
  getAnnotations: (songId, page) =>
    request(`/api/songs/${songId}/annotations?page=${page}`),
  clearAnnotations: (songId, page) =>
    request(`/api/songs/${songId}/annotations?page=${page}`, { method: "DELETE" }),
};
