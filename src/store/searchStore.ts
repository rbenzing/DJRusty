import { create } from 'zustand';
import type { SearchState, TrackSummary } from '../types/search';

interface SearchStoreActions {
  /** Update the search query string. */
  setQuery: (query: string) => void;

  /** Set the search results (replaces existing results). */
  setResults: (results: TrackSummary[], nextPageToken: string | null) => void;

  /** Append additional results (for "Load Next Page"). */
  appendResults: (results: TrackSummary[], nextPageToken: string | null) => void;

  /** Set loading state. */
  setLoading: (loading: boolean) => void;

  /** Set an error message. */
  setError: (error: string | null) => void;

  /** Clear search results and reset state. */
  clearResults: () => void;
}

type SearchStore = SearchState & SearchStoreActions;

const INITIAL_STATE: SearchState = {
  query: '',
  results: [],
  nextPageToken: null,
  loading: false,
  error: null,
};

export const useSearchStore = create<SearchStore>((set) => ({
  ...INITIAL_STATE,

  setQuery: (query) => {
    set({ query });
  },

  setResults: (results, nextPageToken) => {
    set({ results, nextPageToken, error: null });
  },

  appendResults: (results, nextPageToken) => {
    set((state) => ({
      results: [...state.results, ...results],
      nextPageToken,
    }));
  },

  setLoading: (loading) => {
    set({ loading });
  },

  setError: (error) => {
    set({ error, loading: false });
  },

  clearResults: () => {
    set({ results: [], nextPageToken: null, error: null });
  },
}));
