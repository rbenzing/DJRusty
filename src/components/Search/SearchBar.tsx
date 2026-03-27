/**
 * SearchBar.tsx — Search form with text input and submit button.
 *
 * Submits on Enter key press or button click.
 * Disabled when the panel is locked (unauthenticated + no API key).
 *
 * STORY-012 additions:
 *   - Auto-focus the input on first render (autoFocus attribute).
 *   - Clear (×) button appears when the input has text; onClick resets
 *     the query in the parent via the onClear callback.
 */
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  /** Initial query value (controlled externally from the store). */
  initialQuery?: string;
  /** True while a search is in flight — disables input to prevent double-submit. */
  loading?: boolean;
  /** True when the panel is locked due to missing credentials. */
  disabled?: boolean;
  /** Called with the trimmed query string when the user submits. */
  onSearch: (query: string) => void;
  /**
   * Called when the user clicks the clear (×) button.
   * The parent should reset the store query and clear results.
   */
  onClear?: () => void;
}

export function SearchBar({
  initialQuery = '',
  loading = false,
  disabled = false,
  onSearch,
  onClear,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialQuery);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      onSearch(trimmed);
    }
  }

  function handleClear() {
    setInputValue('');
    onClear?.();
  }

  const isDisabled = disabled || loading;
  const showClear = inputValue.length > 0 && !isDisabled;

  return (
    <form
      role="search"
      className={styles.searchBar}
      onSubmit={handleSubmit}
      aria-label="Search YouTube"
    >
      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          placeholder="Search YouTube..."
          aria-label="Search YouTube"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          title={disabled ? 'Sign in with Google to search' : undefined}
          autoComplete="off"
          spellCheck={false}
          // STORY-012: auto-focus the search bar on app load.
          autoFocus
        />
        {showClear && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={0}
          >
            &times;
          </button>
        )}
      </div>
      <button
        type="submit"
        className={styles.button}
        disabled={isDisabled}
        aria-label="Search"
        title={disabled ? 'Sign in with Google to search' : 'Search YouTube'}
      >
        {loading ? '...' : 'SEARCH'}
      </button>
    </form>
  );
}

export default SearchBar;
