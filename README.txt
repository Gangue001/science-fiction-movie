What Should I Watch? — Sci-Fi Movie Finder

Open index.html in a modern browser. Keep app.js, background.js and style.css beside it.
An internet connection is required for TMDB movie data and poster images.

Search by movie title, select a Mood, or combine both. Leave the title empty
to discover movies. Any mood removes the mood restriction.
All results must be science fiction. Mood is the only optional filter.
There are no runtime, rating or additional genre filters.
Surprise Me has been removed.

Mood mapping (any one related genre qualifies):
Exciting: Action, Adventure, Thriller
Funny: Comedy
Relaxing: Comedy, Family, Animation
Scary: Horror, Thriller
Emotional: Drama, Romance
Mysterious: Mystery, Thriller

Released, non-adult sci-fi movies are loaded in pages without a six-result cap.
Select Load more to append the next page; loaded movies remain visible and duplicates
are removed. Title search also continues beyond its former 100-candidate limit.
TMDB allows at most 500 pages per query; the page states when that limit is reached.
Failed page loads can be retried without losing previous results.
Movie Details includes the poster, synopsis, cast and other movie information.
Missing or failed posters show “No poster available”.
On HTTP hosting the URL saves only title and mood.
Old genre, time and rating URL parameters are ignored.

The supplied API key remains in app.js for this front-end prototype.
This product uses the TMDB API but is not endorsed or certified by TMDB.

Editing the title or mood keeps the current results visible until Find My Movie
is selected. Load more continues to use the applied search.
A notice indicates when input changes have not yet been applied.

Background: adapted from the shader example supplied for this project, with
procedural noise, mint stars and a deep blue/teal nebula. Uses native WebGL;
no Three.js, remote noise image or recording library is required. Animation
pauses in hidden tabs and respects reduced motion. CSS stars are the fallback.

Display typography: Skyline by SonAji, supplied in skyline-font/. Original
font information and license are retained in that folder. Used for the brand,
hero heading and results heading; body text retains a readable system font.

Performance update: movie lists use discovery/search data directly; runtime
and credits load on opening details. Cards are clickable across their entire
area, with native button keyboard support. Background uses four star layers,
no fractal cloud calculation, a 1000px longest-edge cap and a 24fps limit.
Current display font: Trench from trench-font/ (replaces Skyline).

Current display font: Azonix from azonix-font/. Scroll parallax and card
entrance animations are removed; search jumps directly to results.
