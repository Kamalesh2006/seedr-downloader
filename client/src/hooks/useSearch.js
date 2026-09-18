import { useState } from 'react';
import api from '../api/client';

export default function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  const search = async (query, source = 'global') => {
    if (!query || !query.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setLastQuery(query.trim());
    try {
      const sourceParam = source ? `&source=${encodeURIComponent(source)}` : '';
      const response = await api.get(`/search?q=${encodeURIComponent(query.trim())}${sourceParam}`);
      setResults(response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setHasSearched(false);
    setLastQuery('');
    setError(null);
  };

  return { results, loading, error, search, hasSearched, lastQuery, clearResults };
}
