// What Should I Watch?: plain HTML + CSS + browser JavaScript. No server required.
const MovieData = (() => {
const MOODS = {
  any: [],
  exciting: [28, 12, 53],
  funny: [35],
  relaxing: [35, 10751, 16],
  scary: [27, 53],
  emotional: [18, 10749],
  mysterious: [9648, 53],
};
const memo = new Map();
class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
function filters(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const mood = url.searchParams.get("mood") || "any";
  if (q.length > 120 || !Object.hasOwn(MOODS, mood))
    throw new ApiError("Please enter a shorter title or select a valid mood.", 400);
  return { q, mood, moodGenres: MOODS[mood] };
}
// The key is deliberately public in this front-end-only prototype.
const API_KEY = "9351d749196501cae516867904c46dc0";
async function tmdb(path, params, context = {}) {
  if (context.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const query = new URLSearchParams({api_key: API_KEY, language: "en-US", ...params});
  const cacheKey = path + "?" + query;
  const cached = memo.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.data;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  context.signal?.addEventListener("abort", cancel, {once:true});
  const timer = setTimeout(cancel, 20000);
  try {
    // Direct browser request to TMDB. No backend, Bearer token, or custom headers.
    const response = await fetch("https://api.themoviedb.org/3" + path + "?" + query, {
      signal: controller.signal
    });
    if (!response.ok) throw new ApiError(response.status === 401
      ? "The API key is invalid or inactive. Check API_KEY in app.js."
      : response.status === 429 ? "Too many requests. Wait a moment and try again."
      : "TMDB could not complete this request. Please try again.", response.status);
    const data = await response.json();
    if (memo.size >= 300) memo.delete(memo.keys().next().value);
    memo.set(cacheKey, {data, until:Date.now()+600000});
    return data;
  } catch (error) {
    if (context.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (error.name === "AbortError") throw new Error("TMDB took too long to respond. Please try again.");
    if (error instanceof ApiError) throw error;
    throw new Error("Cannot reach TMDB. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
    context.signal?.removeEventListener("abort", cancel);
  }
}
const genreNames = {28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Science Fiction",10770:"TV Movie",53:"Thriller",10752:"War",37:"Western"};
function publicMovie(m) {
  return {
    id: m.id,
    title: m.title,
    originalTitle: m.original_title,
    year: (m.release_date || "").slice(0, 4),
    releaseDate: m.release_date || null,
    runtime: m.runtime || null,
    rating: m.vote_count ? m.vote_average : null,
    votes: m.vote_count || 0,
    overview: m.overview || "",
    posterPath: m.poster_path || null,
    genres: (m.genres || (m.genre_ids || []).map(id => ({id, name: genreNames[id] || "Other"}))).map((g) => ({ id: g.id, name: g.name })),
    directors: (m.credits?.crew || []).filter((c) => c.job === "Director").map((c) => c.name),
    cast: (m.credits?.cast || []).slice(0, 6).map((c) => c.name),
    language: m.original_language || "",
    countries: (m.production_countries || []).map((c) => c.name),
    tagline: m.tagline || "",
  };
}
async function details(id, env) {
  return publicMovie(await tmdb("/movie/" + id, { append_to_response: "credits" }, env));
}
function matchesGenres(ids, f) {
  return ids.includes(878) && (!f.moodGenres.length || f.moodGenres.some((id) => ids.includes(id)));
}
function matches(m, f) {
  return matchesGenres(m.genres.map((g) => g.id), f);
}
function candidateMatches(m, f) {
  return (
    !m.adult &&
    matchesGenres(m.genre_ids || [], f) &&
    !!m.release_date &&
    m.release_date <= new Date().toISOString().slice(0, 10)
  );
}
async function find(f, env, page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > 500)
    throw new ApiError("Invalid result page.", 400);
  // Each branch requires science fiction AND one mood genre.
  const branches = f.q ? [null] : (f.moodGenres.length ? f.moodGenres : [null]);
  const pages = await Promise.all(branches.map(async (genre) => {
    const path = f.q ? "/search/movie" : "/discover/movie";
    const params = f.q
      ? { query: f.q, include_adult: "false" }
      : {
          with_genres: genre ? "878," + genre : "878",
          include_adult: "false", include_video: "false",
          sort_by: "popularity.desc",
          "primary_release_date.lte": new Date().toISOString().slice(0, 10),
        };
    const first = await tmdb(path, { ...params, page: "1" }, env);
    if (!Array.isArray(first.results)) throw new ApiError("Unexpected movie data.");
    if (page === 1) return first;
    if (page > first.total_pages) return { results: [], total_pages: first.total_pages };
    const data = await tmdb(path, { ...params, page: String(page) }, env);
    if (!Array.isArray(data.results)) throw new ApiError("Unexpected movie data.");
    return data;
  }));
  const candidates = [...new Map(pages.flatMap((p) => p.results)
    .filter((m) => candidateMatches(m, f)).map((m) => [m.id, m])).values()];
  // List endpoints already provide posters, genres, ratings and summaries.
  // Fetch credits and runtime only when a movie is opened.
  const results = candidates.map(publicMovie);
  const totalPages = Math.max(0, ...pages.map((p) => p.total_pages || 0));
  return {
    results,
    nextPage: page < Math.min(totalPages, 500) ? page + 1 : null,
    capped: totalPages > 500,
  };
}

return {
  async request(operation, params = {}, signal) {
    const context = {signal};
    if(operation === "find") {
      const url = new URL("https://local.invalid/?" + new URLSearchParams(params));
      return find(filters(url), context, Number(params.page || 1));
    }
    if(/^movie\/\d+$/.test(operation)) {
      const id=Number(operation.split("/")[1]);
      if(!Number.isSafeInteger(id)||id<1)throw new Error("Invalid movie ID.");
      return {movie:await details(id,context)};
    }
    throw new Error("Unknown operation.");
  }
};
})();

function safeReplaceState(...args) {
  if(location.protocol === "file:") return;
  try { history.replaceState(...args); } catch { /* URL persistence is optional. */ }
}
// Interface logic. The API key is visible in this prototype by design.
const $ = (selector) => document.querySelector(selector);
const moodLabels = {
  any: "Any mood",
  exciting: "Exciting",
  funny: "Funny",
  relaxing: "Relaxing",
  scary: "Scary",
  emotional: "Emotional",
  mysterious: "Mysterious",
};
let generation = 0, detailGeneration = 0;
let nextPage = null, activeFilters = null, loading = false;
const shownIds = new Set();
const requests = new Map();
const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
function poster(movie) {
  const box = node("div", "poster", "No poster available");
  if (typeof movie.posterPath !== "string" || !/^\/[a-zA-Z0-9._-]+$/.test(movie.posterPath))
    return box;
  const img = node("img");
  img.alt = movie.title + " poster";
  img.loading = "lazy";
  img.decoding = "async";
  img.width = 342;
  img.height = 513;
  img.onerror = () => box.replaceChildren(document.createTextNode("No poster available"));
  img.src = "https://image.tmdb.org/t/p/w342" + movie.posterPath;
  box.replaceChildren(img);
  return box;
}
function truncate(text, max = 230) {
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}
function meta(m) {
  return [
    m.year || "Year unavailable",
    m.runtime ? m.runtime + " min" : "Runtime unavailable",
    m.rating !== null ? Number(m.rating).toFixed(1) + " / 10" : "Not rated",
  ].join(" · ");
}
function clearError() {
  $("#form-error").hidden = true;
  $("#query").removeAttribute("aria-invalid");
}
function error(message) {
  $("#form-error").textContent = message;
  $("#form-error").hidden = false;
  $("#query").setAttribute("aria-invalid", "true");
  $("#query").focus();
}
function readFilters() {
  return { q: $("#query").value.trim(), mood: $("#mood").value };
}
function parseInput() {
  const f = readFilters();
  if (f.q.length > 120) throw Error("Please use a title of 120 characters or fewer.");
  if (!Object.hasOwn(moodLabels, f.mood)) throw Error("Please select a valid mood.");
  return f;
}
function saveUrl(f) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v && v !== "any") p.set(k, v);
  });
  safeReplaceState(null, "", location.pathname + (p.size ? "?" + p : ""));
}
async function api(path, params = {}, channel = "find") {
  requests.get(channel)?.abort();
  const c = new AbortController();
  requests.set(channel, c);
  const timer = setTimeout(() => c.abort(), 60000);
  try {
    return await MovieData.request(path, params, c.signal);
  } catch (e) {
    if (e.name === "AbortError" && requests.get(channel) !== c) throw e;
    throw Error(e.name === "AbortError" ? "The request timed out. Please try again." : e.message);
  } finally {
    clearTimeout(timer);
  }
}
function empty(container, title, message, retry) {
  const panel = node("div", "empty");
  panel.append(node("h3", "", title), node("p", "", message));
  if (retry) {
    const b = node("button", "secondary", "Try again");
    b.type = "button";
    b.onclick = retry;
    panel.append(b);
  }
  container.replaceChildren(panel);
}
function movieButton(movie) {
  const b = node("button", "secondary", "Movie Details");
  b.type = "button";
  b.setAttribute("aria-label", "View details for " + movie.title);
  b.onclick = () => openDetails(movie.id);
  return b;
}
const cardReveal = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      entry.target.animate([
        { opacity: 0.25, translate: "0 24px" },
        { opacity: 1, translate: "0 0" }
      ], { duration: 550, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
    cardReveal.unobserve(entry.target);
  }
}, { threshold: 0.08 }) : null;
function card(movie) {
  const box = node("article", "movie-card");
  const artwork = node("div", "card-artwork");
  artwork.append(poster(movie));
  if (movie.rating !== null) artwork.append(node("span", "rating-badge", "★ " + Number(movie.rating).toFixed(1)));
  const info = node("div", "card-body");
  info.append(node("p", "card-kicker", movie.genres.slice(0, 2).map(g => g.name).join(" / ")),
    node("h3", "", movie.title),
    node("p", "meta", movie.year || "Year unavailable"),
    node("p", "overview", truncate(movie.overview || "No synopsis is available.", 160)), movieButton(movie));
  box.append(artwork, info);
  cardReveal?.observe(box);
  return box;
}

function dirty() {
  // Draft inputs do not change the applied search or its pagination.
  const draft = readFilters();
  $("#pending-filters").hidden = !activeFilters ||
    (draft.q === activeFilters.q && draft.mood === activeFilters.mood);
  clearError();
}

async function find(f, id, page = 1) {
  loading = true;
  $("#load-more").disabled = true;
  $("#results").setAttribute("aria-busy", "true");
  $("#results-status").textContent = "Loading matching sci-fi movies…";
  try {
    const data = await api("find", { ...f, page }, "find");
    if (id !== generation) return;
    const fragment = document.createDocumentFragment();
    for (const movie of data.results) {
      if (shownIds.has(movie.id)) continue;
      shownIds.add(movie.id);
      fragment.append(card(movie));
    }
    $("#results").append(fragment);
    nextPage = data.nextPage;
    $("#load-more").hidden = !nextPage;
    $("#load-more").textContent = "Load more";
    $("#result-count").textContent = shownIds.size + " movies loaded";
    $("#results-status").textContent = nextPage
      ? (data.results.length ? "More results are available. Select Load more."
          : "No new matches on this page. Select Load more to continue.")
      : data.capped
        ? "Reached TMDB’s 500-page limit. Refine your title or mood to explore more."
        : shownIds.size ? "All matching results have been loaded." : "No matching sci-fi movies. Try another title or mood.";
    return data;
  } catch (e) {
    if (id !== generation) return;
    nextPage = page;
    $("#load-more").hidden = false;
    $("#load-more").textContent = "Try again";
    $("#results-status").textContent = e.message + " Your loaded movies have been kept.";
    return { error: e.message };
  } finally {
    if (id === generation) {
      loading = false;
      $("#load-more").disabled = false;
      $("#results").setAttribute("aria-busy", "false");
    }
  }
}
async function submit(scrollToResults = false) {
  let f;
  try {
    f = parseInput();
    clearError();
  } catch (e) {
    error(e.message);
    return { error: e.message };
  }
  const id = ++generation;
  activeFilters = f;
  dirty();
  nextPage = null;
  shownIds.clear();
  cardReveal?.disconnect();
  $("#results").replaceChildren();
  $("#result-count").textContent = "";
  $("#load-more").hidden = true;
  saveUrl(f);
  $("#matches-section").hidden = false;
  if (scrollToResults) {
    $("#matches-heading").focus({ preventScroll: true });
    $("#matches-section").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  return find(f, id);
}
$("#load-more").onclick = () => {
  if (!loading && nextPage && activeFilters) find(activeFilters, generation, nextPage);
};
async function openDetails(id) {
  const version = ++detailGeneration;
  $("#detail-content").replaceChildren(node("p", "loading", "Loading movie details…"));
  if (!$("#detail").open) $("#detail").showModal();
  try {
    const { movie: m } = await api("movie/" + id, {}, "detail");
    if (version !== detailGeneration || !$("#detail").open) return;
    const layout = node("div", "detail-layout"),
      info = node("div"),
      title = node("h2", "", m.title);
    title.id = "detail-title";
    info.append(node("p", "eyebrow", "THE STORY BEYOND THE STARS"), title);
    if (m.tagline) info.append(node("p", "tagline", m.tagline));
    if (m.originalTitle !== m.title) info.append(node("p", "help", m.originalTitle));
    const dl = node("dl");
    const fields = [
      ["Year", m.year || "Not available"],
      ["Release date", m.releaseDate || "Not available"],
      ["Director", m.directors.join(", ") || "Not available"],
      ["Runtime", m.runtime ? m.runtime + " minutes" : "Not available"],
      [
        "Rating",
        m.rating !== null
          ? Number(m.rating).toFixed(1) + " / 10 (" + m.votes.toLocaleString() + " votes)"
          : "Not rated",
      ],
      ["Genres", m.genres.map((g) => g.name).join(", ")],
      ["Cast", m.cast.join(", ") || "Not available"],
      ["Countries", m.countries.join(", ") || "Not available"],
    ];
    for (const [label, value] of fields) dl.append(node("dt", "", label), node("dd", "", value));
    info.append(
      dl,
      node("h3", "", "Synopsis"),
      node("p", "overview", m.overview || "No synopsis is available."),
    );
    const a = node("a", "", "View on TMDB");
    a.href = "https://www.themoviedb.org/movie/" + m.id;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    info.append(a);
    layout.append(poster(m), info);
    $("#detail-content").replaceChildren(layout);
  } catch (e) {
    if (version !== detailGeneration) return;
    empty($("#detail-content"), "Details unavailable", e.message, () => openDetails(id));
  }
}
$("#close-detail").onclick = () => $("#detail").close();
$("#detail").addEventListener("close", () => {
  detailGeneration++;
  requests.get("detail")?.abort();
});
$("#query").oninput = dirty;
$("#mood").addEventListener("change", dirty);
$("#finder-form").onsubmit = (e) => {
  e.preventDefault();
  submit(true);
};
const urlParams = new URLSearchParams(location.search);
$("#query").value = (urlParams.get("q") || "").slice(0, 120);
if (Object.hasOwn(moodLabels, urlParams.get("mood")))
  $("#mood").value = urlParams.get("mood");
if (urlParams.has("q") || urlParams.has("mood")) submit();
