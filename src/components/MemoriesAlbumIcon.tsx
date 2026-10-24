import albumMark from "../assets/icons/memories-album.svg";

/** Supplied album vector, masked so it inherits the navigation's current color. */
export default function MemoriesAlbumIcon() {
  return <span aria-hidden="true" className="inline-block h-6 w-6 shrink-0 bg-current"
    style={{ mask: `url("${albumMark}") center / contain no-repeat`, WebkitMask: `url("${albumMark}") center / contain no-repeat` }} />;
}
